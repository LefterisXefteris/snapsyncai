"""Trendyol International HTTP account.

Product Create v2, with `storeFrontCode` on each call. Quantity goes out only
on the first accepted barcode; a later Push does not call the stock update.
Turkey is one of the probed storefronts so the module can refuse it.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.services.trendyol import (
    Batch,
    Brand,
    Category,
    Credentials,
    Decision,
    ListingItem,
    RequiredAttribute,
    Storefront,
)

_BASE = "https://apigw.trendyol.com"
# Official origin storefronts, plus Turkey so a Turkey-only account is refused.
_STOREFRONTS = {
    "DE": "EUR",
    "SA": "SAR",
    "AE": "AED",
    "GR": "EUR",
    "SK": "EUR",
    "RO": "RON",
    "CZ": "CZK",
    "BG": "BGN",
    "KW": "KWD",
    "TR": "TRY",
}


def _headers(credentials: Credentials, storefront: str | None = None) -> dict[str, str]:
    headers = {
        "User-Agent": f"{credentials.seller_id} - SnapSync",
        "Accept": "application/json",
    }
    if storefront:
        headers["storeFrontCode"] = storefront
    return headers


def _auth(credentials: Credentials) -> httpx.BasicAuth:
    return httpx.BasicAuth(credentials.api_key, credentials.api_secret)


def _reason(response: httpx.Response) -> str:
    try:
        body = response.json()
    except Exception:
        text = response.text.strip()
        return text[:500] if text else "Trendyol did not accept this batch."
    if isinstance(body, dict):
        errors = body.get("errors")
        if isinstance(errors, list) and errors:
            first = errors[0]
            if isinstance(first, dict) and first.get("message"):
                return str(first["message"])
            if isinstance(first, str) and first:
                return first
        for key in ("message", "exception"):
            if body.get(key):
                return str(body[key])
    return "Trendyol did not accept this batch."


def _leaves(nodes: object) -> list[Category]:
    found: list[Category] = []

    def walk(items: object) -> None:
        if not isinstance(items, list):
            return
        for node in items:
            if not isinstance(node, dict):
                continue
            children = node.get("subCategories")
            if isinstance(children, list) and children:
                walk(children)
                continue
            category_id = node.get("id")
            name = node.get("name")
            if category_id is not None and name:
                found.append(Category(id=str(category_id), name=str(name)))

    walk(nodes)
    return found


def _item_body(item: ListingItem) -> dict[str, Any]:
    attributes: list[dict[str, Any]] = []
    for attribute in item.attributes:
        if attribute.value_id:
            attributes.append(
                {
                    "attributeId": int(attribute.attribute_id),
                    "attributeValueId": int(attribute.value_id),
                }
            )
        elif attribute.custom:
            attributes.append(
                {
                    "attributeId": int(attribute.attribute_id),
                    "customAttributeValue": attribute.custom,
                }
            )
    body: dict[str, Any] = {
        "barcode": item.barcode,
        "title": item.title,
        "description": item.description,
        "productMainId": item.model_code,
        "brandId": int(item.brand_id),
        "categoryId": int(item.category_id),
        "stockCode": item.stock_code,
        "listPrice": float(item.list_price),
        "salePrice": float(item.sale_price),
        "vatRate": item.vat_rate,
        # Currency is the storefront (storeFrontCode). Product Create v2 has no currency field.
        "images": [{"url": url} for url in item.images],
        "attributes": attributes,
    }
    if item.quantity is not None:
        body["quantity"] = item.quantity
    return body


class HttpTrendyol:
    async def _request(
        self,
        method: str,
        path: str,
        credentials: Credentials,
        *,
        storefront: str | None = None,
        json: dict | None = None,
        params: dict | None = None,
    ) -> httpx.Response:
        async with httpx.AsyncClient(base_url=_BASE, timeout=20) as client:
            return await client.request(
                method,
                path,
                headers=_headers(credentials, storefront),
                auth=_auth(credentials),
                json=json,
                params=params,
            )

    async def storefronts_for(self, credentials: Credentials) -> tuple[Storefront, ...] | None:
        found: list[Storefront] = []
        unauthorized = 0
        for code, currency in _STOREFRONTS.items():
            response = await self._request(
                "GET",
                f"/integration/product/sellers/{credentials.seller_id}/products",
                credentials,
                storefront=code,
                params={"page": 0, "size": 1},
            )
            if response.status_code == 401:
                unauthorized += 1
                continue
            if response.status_code == 200:
                found.append(Storefront(code=code, currency=currency))
        if unauthorized == len(_STOREFRONTS):
            return None
        return tuple(found)

    async def categories_for(
        self, credentials: Credentials, storefront: str
    ) -> tuple[Category, ...]:
        response = await self._request(
            "GET",
            "/integration/product/product-categories",
            credentials,
            storefront=storefront,
        )
        if response.status_code != 200:
            return ()
        body = response.json()
        nodes = body.get("categories") if isinstance(body, dict) else body
        return tuple(_leaves(nodes))

    async def brands_for(
        self, credentials: Credentials, storefront: str, query: str
    ) -> tuple[Brand, ...]:
        response = await self._request(
            "GET",
            "/integration/product/brands",
            credentials,
            storefront=storefront,
            params={"name": query},
        )
        if response.status_code != 200:
            return ()
        body = response.json()
        rows = body.get("brands") if isinstance(body, dict) else None
        if not isinstance(rows, list):
            return ()
        return tuple(
            Brand(id=str(row["id"]), name=str(row["name"]))
            for row in rows
            if isinstance(row, dict) and row.get("id") is not None and row.get("name")
        )

    async def required_attributes(
        self, credentials: Credentials, storefront: str, category_id: str
    ) -> tuple[RequiredAttribute, ...]:
        response = await self._request(
            "GET",
            f"/integration/product/product-categories/{category_id}/attributes",
            credentials,
            storefront=storefront,
        )
        if response.status_code != 200:
            return ()
        body = response.json()
        rows = body.get("categoryAttributes") if isinstance(body, dict) else None
        if not isinstance(rows, list):
            return ()
        required: list[RequiredAttribute] = []
        for row in rows:
            if not isinstance(row, dict) or not row.get("required"):
                continue
            attribute = row.get("attribute") if isinstance(row.get("attribute"), dict) else {}
            attribute_id = attribute.get("id")
            name = attribute.get("name")
            if attribute_id is None or not name:
                continue
            choices: list[tuple[str, str]] = []
            values = row.get("attributeValues")
            if isinstance(values, list):
                for value in values:
                    if (
                        isinstance(value, dict)
                        and value.get("id") is not None
                        and value.get("name")
                    ):
                        choices.append((str(value["id"]), str(value["name"])))
            required.append(
                RequiredAttribute(id=str(attribute_id), name=str(name), choices=tuple(choices))
            )
        return tuple(required)

    async def submit(self, credentials: Credentials, storefront: str, item: ListingItem) -> Batch:
        path = f"/integration/product/sellers/{credentials.seller_id}/v2/products"
        method = "POST" if item.quantity is not None else "PUT"
        response = await self._request(
            method,
            path,
            credentials,
            storefront=storefront,
            json={"items": [_item_body(item)]},
        )
        if response.status_code != 200:
            return Batch(accepted=False, reason=_reason(response))
        try:
            body = response.json()
        except Exception:
            return Batch(accepted=False, reason="Trendyol did not accept this batch.")
        if not isinstance(body, dict) or not body.get("batchRequestId"):
            return Batch(accepted=False, reason=_reason(response))
        items = body.get("items")
        if isinstance(items, list):
            for entry in items:
                reasons = entry.get("failureReasons") if isinstance(entry, dict) else None
                if isinstance(reasons, list) and reasons:
                    return Batch(accepted=False, reason=str(reasons[0]))
        return Batch(accepted=True)

    async def approval(self, credentials: Credentials, storefront: str, barcode: str) -> Decision:
        response = await self._request(
            "GET",
            f"/integration/product/sellers/{credentials.seller_id}/products",
            credentials,
            storefront=storefront,
            params={"barcode": barcode},
        )
        if response.status_code != 200:
            return Decision(status="waiting")
        body = response.json()
        content = body.get("content") if isinstance(body, dict) else None
        if not isinstance(content, list) or not content or not isinstance(content[0], dict):
            return Decision(status="waiting")
        row = content[0]
        if row.get("rejected") is True:
            details = row.get("rejectReasonDetails")
            reason = None
            if isinstance(details, list) and details and isinstance(details[0], dict):
                reason = details[0].get("rejectReason") or details[0].get("rejectReasonDetail")
            return Decision(
                status="rejected",
                reason=str(reason) if reason else "Trendyol rejected this product.",
            )
        if row.get("approved") is True:
            return Decision(status="approved")
        return Decision(status="waiting")


def get_trendyol_account() -> HttpTrendyol:
    return HttpTrendyol()
