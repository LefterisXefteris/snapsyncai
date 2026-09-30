"""Rows for tests that run on the `db` fixture."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ShopifyConnection
from app.models.billing import AllowanceSpend, Subscription
from app.services import images as store
from app.services.plan_ledger import record_spend
from app.services.product_facts import (
    ProductFacts,
    confirm_facts,
    persistable_from_vision,
    stored_from_facts,
)

SELLER = "user_seller"
OTHER_SELLER = "user_other"
STRIPE_CUSTOMER = "cus_test"

LISTED = {
    "title": "Cotton tee",
    "description": "<p>Old.</p>",
    "tags": ["tee"],
    "seo_title": "Old",
    "seo_description": "Old",
}


def confirmed_facts(*, textile: bool = False, stale: bool = False) -> dict:
    if textile:
        facts = confirm_facts(
            persistable_from_vision({"isTextile": True}).facts,
            is_textile=True,
            composition=[{"name": "cotton", "percent": 100}],
            gpsr_choice="skip",
            care_choice="skip",
        ).facts
    else:
        facts = confirm_facts(
            persistable_from_vision({"isTextile": False}).facts,
            is_textile=False,
            gpsr_choice="skip",
        ).facts
    if stale:
        facts = ProductFacts(
            suggested=facts.suggested, confirmed=facts.confirmed, listing_copy_stale=True
        )
    return stored_from_facts(facts)


async def product(
    db: AsyncSession,
    *,
    owner: str = SELLER,
    facts: dict | None = None,
    listed: bool = True,
    **values,
) -> int:
    row = {
        "original_name": "tee.jpg",
        "mime_type": "image/jpeg",
        "size": 1,
        "session_id": owner,
        "product_facts": facts,
        **(LISTED if listed else {}),
        **values,
    }
    return (await store.create_image(db, row)).id


async def plan(db: AsyncSession, owner: str = SELLER) -> Subscription:
    sub = Subscription(
        user_id=owner,
        stripe_customer_id=STRIPE_CUSTOMER,
        stripe_subscription_id=f"sub_{owner}",
        status="active",
        billing_interval="month",
    )
    db.add(sub)
    await db.flush()
    return sub


async def shop(db: AsyncSession, owner: str = SELLER, **values) -> None:
    db.add(
        ShopifyConnection(
            session_id=owner,
            shop_domain="tees.myshopify.com",
            access_token="encrypted",
            **values,
        )
    )
    await db.flush()


async def use_allowance(db: AsyncSession, uses: int, owner: str = SELLER) -> None:
    for _ in range(uses):
        await record_spend(db, owner, "refresh_accept", as_overage=False)


async def spends(db: AsyncSession, owner: str = SELLER) -> list[AllowanceSpend]:
    result = await db.execute(
        select(AllowanceSpend).where(AllowanceSpend.user_id == owner).order_by(AllowanceSpend.id)
    )
    return list(result.scalars().all())
