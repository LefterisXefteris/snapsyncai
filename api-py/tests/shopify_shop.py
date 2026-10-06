"""An in-memory Shopify shop: a `ShopifyGraphQL` transport answering only what Push sends.

Operations are told apart by their GraphQL operation name. Anything else raises.
"""

import re
from dataclasses import dataclass, field
from itertools import count
from typing import Any

ONLINE_STORE = "gid://shopify/Publication/1"
POINT_OF_SALE = "gid://shopify/Publication/2"
SHOP_APP = "gid://shopify/Publication/3"
WAREHOUSE = "gid://shopify/Location/10"
SHOP_FLOOR = "gid://shopify/Location/11"

_OPERATION = re.compile(r"\b(?:query|mutation)\s+(\w+)")
_FIRST = re.compile(r"\bfirst:\s*(\d+)")


@dataclass
class Variant:
    id: str
    inventory_item: str
    tracked: bool
    sku: str | None = None


@dataclass
class Product:
    id: str
    status: str
    variants: list[Variant]
    publications: set[str] = field(default_factory=set)
    media: list[str] = field(default_factory=list)


class ShopifyShop:
    def __init__(
        self,
        *,
        publications: dict[str, str] | None = None,
        locations: dict[str, str] | None = None,
        new_products_published_on: set[str] | None = None,
    ) -> None:
        self.publications = publications or {
            ONLINE_STORE: "Online Store",
            POINT_OF_SALE: "Point of Sale",
        }
        # Active locations only; Push asks for `active:true`.
        self.locations = locations or {}
        self.products: dict[str, Product] = {}
        self.available: dict[tuple[str, str], int] = {}
        self.fail_next_product_set: str | None = None
        self.fail_next_create: str | None = None
        self._new_products_published_on = new_products_published_on or set()
        self._ids = count(1)

    def add_product(
        self, *, status: str = "DRAFT", publications: set[str] | None = None
    ) -> Product:
        product = Product(
            id=f"gid://shopify/Product/{next(self._ids)}",
            status=status,
            variants=[self._variant(tracked=True, sku=None)],
            publications=set(publications or ()),
        )
        self.products[product.id] = product
        return product

    def only_product(self) -> Product:
        [product] = self.products.values()
        return product

    def stock(self, product: Product) -> dict[str, int]:
        """Available stock of the product's only variant, per location."""
        [variant] = product.variants
        return {
            location: quantity
            for (item, location), quantity in self.available.items()
            if item == variant.inventory_item
        }

    async def __call__(self, query: str, variables: dict[str, Any] | None = None) -> dict:
        if any(int(n) > 250 for n in _FIRST.findall(query)):
            raise RuntimeError("first cannot exceed 250.")
        match = _OPERATION.search(query)
        name = match.group(1) if match else None
        handler = {
            "SnapSyncPublications": self._publications,
            "SnapSyncProductPublishing": self._product_publishing,
            "CreateSnapSyncProduct": self._product_set,
            "AddSnapSyncProductMedia": self._create_media,
            "SnapSyncPublish": self._publish,
            "SnapSyncUnpublish": self._unpublish,
            "InventoryLocations": self._locations,
            "SetStorefrontAvailable": self._set_available,
        }.get(name or "")
        if handler is None:
            raise AssertionError(f"The in-memory shop does not answer {name or query!r}")
        return handler(variables or {})

    def _variant(self, *, tracked: bool, sku: str | None) -> Variant:
        n = next(self._ids)
        return Variant(
            id=f"gid://shopify/ProductVariant/{n}",
            inventory_item=f"gid://shopify/InventoryItem/{n}",
            tracked=tracked,
            sku=sku,
        )

    def _publications(self, _variables: dict) -> dict:
        return {
            "publications": {
                "nodes": [
                    {"id": publication_id, "name": title, "catalog": {"title": title}}
                    for publication_id, title in self.publications.items()
                ]
            }
        }

    def _product_publishing(self, variables: dict) -> dict:
        product = self.products.get(variables["id"])
        if product is None:
            return {"product": None}
        return {
            "product": {
                "status": product.status,
                "resourcePublicationsV2": {
                    "nodes": [
                        {"isPublished": True, "publication": {"id": publication_id}}
                        for publication_id in sorted(product.publications)
                    ]
                },
            }
        }

    def _product_set(self, variables: dict) -> dict:
        given = variables["productSet"]
        if self.fail_next_product_set:
            message = self.fail_next_product_set
            self.fail_next_product_set = None
            return {
                "productSet": {
                    "product": None,
                    "userErrors": [{"field": ["title"], "message": message}],
                }
            }
        if "id" not in given and self.fail_next_create:
            message = self.fail_next_create
            self.fail_next_create = None
            return {
                "productSet": {
                    "product": None,
                    "userErrors": [{"field": ["title"], "message": message}],
                }
            }
        if given.get("variants") and not given.get("productOptions"):
            return {
                "productSet": {
                    "product": None,
                    "userErrors": [
                        {
                            "field": ["productOptions"],
                            "message": "Product options input is required when updating variants",
                        }
                    ],
                }
            }
        if "id" in given:
            product = self.products.get(given["id"])
            if product is None:
                return {
                    "productSet": {
                        "product": None,
                        "userErrors": [{"field": ["id"], "message": "Product does not exist"}],
                    }
                }
        else:
            product = Product(
                id=f"gid://shopify/Product/{next(self._ids)}",
                status=given["status"],
                variants=[],
                publications=set(self._new_products_published_on),
            )
            self.products[product.id] = product
        product.status = given["status"]
        variants: list[Variant] = []
        for index, wanted in enumerate(given["variants"]):
            item = wanted["inventoryItem"]
            if index < len(product.variants):
                variant = product.variants[index]
                variant.tracked, variant.sku = item["tracked"], item["sku"]
            else:
                variant = self._variant(tracked=item["tracked"], sku=item["sku"])
            variants.append(variant)
        product.variants = variants
        return {
            "productSet": {
                "product": {
                    "id": product.id,
                    "variants": {
                        "nodes": [
                            {
                                "id": variant.id,
                                "sku": variant.sku,
                                "inventoryItem": {
                                    "id": variant.inventory_item,
                                    "tracked": variant.tracked,
                                },
                            }
                            for variant in product.variants
                        ]
                    },
                },
                "userErrors": [],
            }
        }

    def _create_media(self, variables: dict) -> dict:
        product = self.products[variables["productId"]]
        product.media.extend(media["originalSource"] for media in variables["media"])
        return {"productCreateMedia": {"mediaUserErrors": []}}

    def _publish(self, variables: dict) -> dict:
        product = self.products[variables["id"]]
        product.publications |= {entry["publicationId"] for entry in variables["input"]}
        return {"publishablePublish": {"userErrors": []}}

    def _unpublish(self, variables: dict) -> dict:
        product = self.products[variables["id"]]
        product.publications -= {entry["publicationId"] for entry in variables["input"]}
        return {"publishableUnpublish": {"userErrors": []}}

    def _locations(self, _variables: dict) -> dict:
        return {
            "locations": {
                "nodes": [
                    {"id": location_id, "name": name, "isActive": True}
                    for location_id, name in self.locations.items()
                ]
            }
        }

    def _set_available(self, variables: dict) -> dict:
        errors = []
        for quantity in variables["input"]["quantities"]:
            if quantity["locationId"] not in self.locations:
                errors.append({"field": ["locationId"], "message": "Location not found"})
                continue
            self.available[(quantity["inventoryItemId"], quantity["locationId"])] = quantity[
                "quantity"
            ]
        return {"inventorySetQuantities": {"userErrors": errors}}
