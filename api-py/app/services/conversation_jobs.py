"""Binds the signed-in seller's shop to the jobs the catalogue pages already run.

The conversation does not re-decide Plan, Allowance, eligibility, or stock.
"""

from __future__ import annotations

from collections.abc import Mapping

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.services import images as store
from app.services.conversation import InventoryOnHand, JobOutcome, ProposalItem
from app.services.inventory.service import get_inventory_overview, list_inventory_items
from app.services.listing_copy_accept import PRODUCT_NOT_FOUND, accept_refresh
from app.services.listing_copy_propose import (
    propose_bulk_seo,
    propose_refresh,
    regenerate_bulk_seo,
)
from app.services.listing_copy_trace import (
    listing_copy_trace_store,
    mark_refresh,
)
from app.services.website_handoff import (
    eligible_products,
    photos_from_images as website_photos,
)


def _items(pack_items) -> tuple[ProposalItem, ...]:
    items: list[ProposalItem] = []
    for item in pack_items:
        proposal = dict(item.proposal) if item.proposal is not None else None
        items.append(
            ProposalItem(
                product_id=item.id,
                error=item.error,
                proposal=proposal,
                queries=tuple(item.queries),
            )
        )
    return tuple(items)


class SellerJobs:
    def __init__(self, session: AsyncSession, user_id: str, settings: Settings) -> None:
        self.session = session
        self.user_id = user_id
        self.settings = settings

    async def read_inventory(self) -> InventoryOnHand:
        overview = await get_inventory_overview(self.session, self.user_id)
        page = await list_inventory_items(self.session, self.user_id, limit=20)
        lines: list[tuple[str, int]] = []
        for row in page["items"]:
            item = row["item"]
            title = item.title or "Product"
            lines.append((title, int(item.ledger_quantity)))
        return InventoryOnHand(
            total_units=int(overview["total_units"]),
            total_items=int(overview["total_items"]),
            lines=tuple(lines),
        )

    async def start_bulk_seo(self, product_ids: tuple[int, ...]) -> JobOutcome:
        pack, _pack_id = await propose_bulk_seo(
            self.session, self.settings, self.user_id, product_ids
        )
        if pack.error:
            return JobOutcome(error=pack.error)
        return JobOutcome(items=_items(pack.items))

    async def start_refresh(self, product_id: int) -> JobOutcome:
        return await self._refresh(product_id, queries=None)

    async def _refresh(self, product_id: int, queries: tuple[str, ...] | None) -> JobOutcome:
        result = await propose_refresh(
            self.session, self.settings, self.user_id, product_id, queries=queries
        )
        if result.refused is not None or result.proposal is None:
            return JobOutcome(error=result.message)
        return JobOutcome(
            items=(
                ProposalItem(
                    product_id=product_id,
                    proposal=result.proposal,
                    queries=result.queries,
                ),
            )
        )

    async def accept(
        self,
        job: str,
        product_id: int,
        proposal: Mapping | None,
        *,
        confirm_overflow: bool,
    ) -> JobOutcome:
        proposal = proposal or {}
        trace_id = proposal.get("traceId")
        result = await accept_refresh(
            self.session,
            self.settings,
            self.user_id,
            product_id,
            proposal,
            job="refresh" if job == "listing_copy_refresh" else "bulk_seo",
            confirm_overflow=confirm_overflow,
            trace_id=trace_id if isinstance(trace_id, str) else None,
        )
        if result.refused is not None:
            return JobOutcome(
                error=result.message,
                needs_overflow_confirm=result.refused == "overflow_confirm",
            )
        return JobOutcome(spent=result.spent)

    async def dismiss(self, job: str, product_id: int) -> JobOutcome:
        if job == "listing_copy_refresh":
            mark_refresh(
                listing_copy_trace_store(self.settings),
                product_id=product_id,
                outcome="dismissed",
            )
        return JobOutcome()

    async def regenerate(
        self, job: str, product_id: int, queries: tuple[str, ...]
    ) -> JobOutcome:
        if job == "listing_copy_refresh":
            return await self._refresh(product_id, queries)
        item = await regenerate_bulk_seo(
            self.session, self.settings, self.user_id, product_id, queries
        )
        if item is None:
            return JobOutcome(error=PRODUCT_NOT_FOUND)
        return JobOutcome(items=_items((item,)))

    async def read_website(self) -> JobOutcome:
        images = await store.list_images(self.session, self.user_id)
        products = eligible_products(website_photos(images))
        if not products:
            return JobOutcome(
                error="Pick products that are pushed to Shopify and have listing copy"
            )
        return JobOutcome(items=tuple(ProposalItem(product_id=product.id) for product in products))
