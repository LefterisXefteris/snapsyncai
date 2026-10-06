"""An in-memory Trendyol International account.

Records the account's storefronts and each product by barcode: quantity, model
code, and approval. The Trendyol Channel module is the only caller.
"""

from dataclasses import dataclass, field
from decimal import Decimal

from app.services.trendyol import (
    AttributeValue,
    Batch,
    Brand,
    Category,
    Credentials,
    Decision,
    ListingItem,
    RequiredAttribute,
    Storefront,
)


@dataclass
class Held:
    barcode: str
    title: str
    description: str
    brand_id: str
    category_id: str
    stock_code: str
    list_price: Decimal
    sale_price: Decimal
    vat_rate: int
    currency: str
    images: tuple[str, ...]
    attributes: tuple[AttributeValue, ...]
    quantity: int
    model_code: str
    approval: str = "waiting"
    reason: str | None = None


@dataclass
class MemoryTrendyol:
    storefronts: tuple[Storefront, ...] = (Storefront("DE", "EUR"),)
    refuse_credentials: bool = False
    categories: tuple[Category, ...] = ()
    brands: tuple[Brand, ...] = ()
    required: dict[str, tuple[RequiredAttribute, ...]] = field(default_factory=dict)
    products: dict[str, Held] = field(default_factory=dict)
    refuse_reason: str | None = None
    _decisions: dict[str, tuple[str, str | None]] = field(default_factory=dict)

    def product(self, barcode: str) -> Held:
        return self.products[barcode]

    def decide(self, barcode: str, status: str, reason: str | None = None) -> None:
        self._decisions[barcode] = (status, reason)

    async def storefronts_for(self, _credentials: Credentials) -> tuple[Storefront, ...] | None:
        if self.refuse_credentials:
            return None
        return self.storefronts

    async def categories_for(
        self, _credentials: Credentials, _storefront: str
    ) -> tuple[Category, ...]:
        return self.categories

    async def brands_for(
        self, _credentials: Credentials, _storefront: str, query: str
    ) -> tuple[Brand, ...]:
        text = query.casefold()
        return tuple(brand for brand in self.brands if text in brand.name.casefold())

    async def required_attributes(
        self, _credentials: Credentials, _storefront: str, category_id: str
    ) -> tuple[RequiredAttribute, ...]:
        return self.required.get(category_id, ())

    async def submit(self, _credentials: Credentials, _storefront: str, item: ListingItem) -> Batch:
        if self.refuse_reason:
            reason = self.refuse_reason
            self.refuse_reason = None
            return Batch(accepted=False, reason=reason)
        held = self.products.get(item.barcode)
        if held is None:
            if item.quantity is None or not item.model_code:
                return Batch(accepted=False, reason="A first Push needs quantity and a model code.")
            self.products[item.barcode] = Held(
                barcode=item.barcode,
                title=item.title,
                description=item.description,
                brand_id=item.brand_id,
                category_id=item.category_id,
                stock_code=item.stock_code,
                list_price=item.list_price,
                sale_price=item.sale_price,
                vat_rate=item.vat_rate,
                currency=item.currency,
                images=item.images,
                attributes=item.attributes,
                quantity=item.quantity,
                model_code=item.model_code,
            )
            return Batch(accepted=True)
        held.title = item.title
        held.description = item.description
        held.brand_id = item.brand_id
        held.category_id = item.category_id
        held.stock_code = item.stock_code
        held.list_price = item.list_price
        held.sale_price = item.sale_price
        held.vat_rate = item.vat_rate
        held.currency = item.currency
        held.images = item.images
        held.attributes = item.attributes
        if item.quantity is not None:
            held.quantity = item.quantity
        if item.model_code:
            held.model_code = item.model_code
        held.approval = "waiting"
        held.reason = None
        return Batch(accepted=True)

    async def approval(self, _credentials: Credentials, _storefront: str, barcode: str) -> Decision:
        if barcode in self._decisions:
            status, reason = self._decisions[barcode]
            return Decision(status=status, reason=reason)
        held = self.products.get(barcode)
        if held is None:
            return Decision(status="waiting")
        return Decision(status=held.approval, reason=held.reason)
