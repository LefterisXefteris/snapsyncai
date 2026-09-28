"""Binds the signed-in seller's shop to the jobs the catalogue pages already run.

The conversation does not re-decide Plan, Allowance, eligibility, or stock.
"""

from __future__ import annotations

import uuid
from collections.abc import Mapping
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.routers.images import fetch_search_demand, propose_refresh_pack
from app.services import connections
from app.services import images as store
from app.services.bulk_seo import (
    accept_item,
    photos_from_images,
    regenerate_item,
    start_pack,
)
from app.services.conversation import InventoryOnHand, JobOutcome, ProposalItem
from app.services.inventory.service import get_inventory_overview, list_inventory_items
from app.services.listing_copy_refresh import (
    accept_listing_copy_refresh,
    listing_copy_from_image,
    refresh_blocked_reason,
    rewrite_constraints,
    search_demand_configured,
    seed_search_demand,
    start_listing_copy_refresh,
)
from app.services.listing_copy_trace import (
    JOB_BULK,
    JOB_REFRESH,
    listing_copy_trace_store,
    mark_bulk_accept,
    mark_refresh,
)
from app.services.plan import NEED_OVERFLOW_CONFIRM
from app.services.plan_charge import (
    authorize_plan_job,
    current_entitlement,
    overflow_ack_month,
    settle_plan_job,
)
from app.services.plan_ledger import list_spends
from app.services.product_facts import merge_product_facts
from app.services.website_handoff import (
    HandoffError,
    build_handoff,
    eligible_products,
)
from app.services.website_handoff import (
    photos_from_images as website_photos,
)


def _blocked(reason: str | None) -> JobOutcome | None:
    if reason is None:
        return None
    if reason == NEED_OVERFLOW_CONFIRM:
        return JobOutcome(needs_overflow_confirm=True, error=reason)
    return JobOutcome(error=reason)


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

    def _demand(self) -> bool:
        return search_demand_configured(
            self.settings.search_demand_api_key,
            self.settings.search_demand_url,
            self.settings.search_demand_login,
        )

    async def _gpsr(self) -> dict | None:
        connection = await connections.get_shopify(self.session, self.user_id)
        identity = connection.gpsr_identity if connection is not None else None
        return identity if isinstance(identity, dict) else None

    async def _connection(self):
        return await connections.get_shopify(self.session, self.user_id)

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
        images = await store.list_images(self.session, self.user_id)
        photos = photos_from_images(images)
        by_id = {photo.id: photo for photo in photos}
        entitlement = await current_entitlement(self.session, self.settings, self.user_id)
        shop_gpsr = await self._gpsr()
        pack_id = uuid.uuid4().hex

        async def fetch(_product_id: int, seeds):
            return await fetch_search_demand(
                seeds,
                self.settings.search_demand_url,
                self.settings.search_demand_api_key,
                login=self.settings.search_demand_login,
            )

        async def propose(product_id: int, **kwargs):
            photo = by_id.get(product_id)
            return await propose_refresh_pack(
                kwargs["constraints"],
                trace=self._trace(JOB_BULK, product_id, photo, pack_id),
            )

        pack = await start_pack(
            photos,
            product_ids,
            demand_configured=self._demand(),
            entitlement=entitlement,
            fetch=fetch,
            propose=propose,
            shop_gpsr=shop_gpsr,
        )
        if pack.error:
            return JobOutcome(error=pack.error)
        return JobOutcome(items=_items(pack.items))

    async def start_refresh(self, product_id: int) -> JobOutcome:
        return await self._refresh(product_id, queries=None)

    async def _refresh(self, product_id: int, queries: tuple[str, ...] | None) -> JobOutcome:
        image = await store.get_image(self.session, product_id, self.user_id)
        if image is None:
            return JobOutcome(error="Product not found")
        group = await store.get_image_group(self.session, image.id, self.user_id)
        facts = merge_product_facts(
            [img.product_facts for img in group] or [image.product_facts]
        )
        listing_copy = listing_copy_from_image(image)
        configured = self._demand()
        shop_gpsr = await self._gpsr()
        blocked = refresh_blocked_reason(facts, listing_copy, configured)
        if blocked:
            return JobOutcome(error=blocked)
        if queries is None:
            fetched = await fetch_search_demand(
                seed_search_demand(facts, listing_copy),
                self.settings.search_demand_url,
                self.settings.search_demand_api_key,
                login=self.settings.search_demand_login,
            )
            started = start_listing_copy_refresh(
                facts,
                listing_copy,
                configured,
                fetch=lambda _seeds: fetched,
                shop_gpsr=shop_gpsr,
            )
        else:
            started = start_listing_copy_refresh(
                facts,
                listing_copy,
                configured,
                fetch=lambda _seeds: (),
                shop_gpsr=shop_gpsr,
                queries=queries,
            )
        if started.error:
            return JobOutcome(error=started.error)
        pack = await propose_refresh_pack(
            rewrite_constraints(facts, started.queries, listing_copy, shop_gpsr),
            trace=self._trace(JOB_REFRESH, image.id, image, None),
        )
        if pack is None:
            return JobOutcome(error="Could not parse listing copy refresh.")
        return JobOutcome(
            items=(
                ProposalItem(
                    product_id=product_id,
                    proposal=pack,
                    queries=tuple(started.queries),
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
        if job == "listing_copy_refresh":
            return await self._accept_refresh(product_id, proposal or {}, confirm_overflow)
        return await self._accept_bulk(product_id, proposal or {}, confirm_overflow)

    async def _accept_bulk(
        self, product_id: int, proposal: Mapping, confirm_overflow: bool
    ) -> JobOutcome:
        images = await store.list_images(self.session, self.user_id)
        photos = photos_from_images(images)
        photo = next((item for item in photos if item.id == product_id), None)
        if photo is None:
            return JobOutcome(error="Product not found")
        entitlement = await current_entitlement(self.session, self.settings, self.user_id)
        spends = await list_spends(self.session, self.user_id)
        ack = await overflow_ack_month(self.session, self.settings, self.user_id)
        stash: dict = {}

        def persist(saved_id: int, listing_copy):
            stash["id"] = saved_id
            stash["copy"] = dict(listing_copy)

        result = accept_item(
            photo,
            {
                "tags": list(proposal.get("tags") or []),
                "description": proposal.get("description") or "",
                "seoTitle": proposal.get("seoTitle") or proposal.get("seo_title") or "",
                "seoDescription": proposal.get("seoDescription")
                or proposal.get("seo_description")
                or "",
            },
            entitlement=entitlement,
            spends=spends,
            now=datetime.now(UTC),
            persist=persist,
            record_spend=lambda: None,
            shop_gpsr=await self._gpsr(),
            confirm_overflow=confirm_overflow,
            overflow_confirmed_month=ack,
        )
        blocked = _blocked(result.error)
        if blocked is not None:
            return blocked
        if "copy" in stash:
            updated = await store.update_image(
                self.session, stash["id"], stash["copy"], self.user_id
            )
            if updated is None:
                return JobOutcome(error="Product not found")
        if result.spent:
            await settle_plan_job(
                self.session,
                self.settings,
                self.user_id,
                "bulk_seo_persist",
                confirm_overflow=confirm_overflow,
                product_id=photo.id,
            )
            trace_id = proposal.get("traceId")
            mark_bulk_accept(
                listing_copy_trace_store(self.settings),
                product_id=photo.id,
                pack_id="",
                trace_id=trace_id if isinstance(trace_id, str) else None,
            )
        return JobOutcome(spent=result.spent)

    async def _accept_refresh(
        self, product_id: int, proposal: Mapping, confirm_overflow: bool
    ) -> JobOutcome:
        image = await store.get_image(self.session, product_id, self.user_id)
        if image is None:
            return JobOutcome(error="Product not found")
        group = await store.get_image_group(self.session, image.id, self.user_id)
        facts = merge_product_facts(
            [img.product_facts for img in group] or [image.product_facts]
        )
        accepted = accept_listing_copy_refresh(facts, proposal, await self._gpsr())
        if accepted.error or accepted.listing_copy is None:
            return JobOutcome(error=accepted.error or "Could not accept listing copy.")
        blocked = _blocked(
            await authorize_plan_job(
                self.session,
                self.settings,
                self.user_id,
                "refresh_accept",
                confirm_overflow=confirm_overflow,
                completing=True,
            )
        )
        if blocked is not None:
            return blocked
        updated = await store.update_image(
            self.session, product_id, accepted.listing_copy, self.user_id
        )
        if updated is None:
            return JobOutcome(error="Product not found")
        await settle_plan_job(
            self.session,
            self.settings,
            self.user_id,
            "refresh_accept",
            confirm_overflow=confirm_overflow,
            product_id=product_id,
        )
        trace_id = proposal.get("traceId")
        mark_refresh(
            listing_copy_trace_store(self.settings),
            product_id=product_id,
            outcome="accepted",
            trace_id=trace_id if isinstance(trace_id, str) else None,
        )
        return JobOutcome(spent=True)

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
        images = await store.list_images(self.session, self.user_id)
        photos = photos_from_images(images)
        photo = next((item for item in photos if item.id == product_id), None)
        if photo is None:
            return JobOutcome(error="Product not found")

        async def propose(**kwargs):
            return await propose_refresh_pack(
                kwargs["constraints"],
                trace=self._trace(JOB_BULK, photo.id, photo, None),
            )

        item = await regenerate_item(
            photo,
            queries,
            demand_configured=self._demand(),
            propose=propose,
            fetch=lambda *_args: (),
            shop_gpsr=await self._gpsr(),
        )
        return JobOutcome(items=_items((item,)))

    async def read_website(self) -> JobOutcome:
        images = await store.list_images(self.session, self.user_id)
        products = eligible_products(website_photos(images))
        if not products:
            return JobOutcome(
                error="Pick products that are pushed to Shopify and have listing copy"
            )
        return JobOutcome(items=tuple(ProposalItem(product_id=product.id) for product in products))

    async def handoff(
        self,
        *,
        look: str,
        product_ids: tuple[int, ...],
        confirm_overflow: bool,
    ) -> JobOutcome:
        connection = await self._connection()
        if connection is None:
            return JobOutcome(error="Shopify is not connected")
        blocked = _blocked(
            await authorize_plan_job(
                self.session,
                self.settings,
                self.user_id,
                "website_handoff",
                confirm_overflow=confirm_overflow,
                completing=True,
            )
        )
        if blocked is not None:
            return blocked
        images = await store.list_images(self.session, self.user_id)
        eligible = eligible_products(website_photos(images))
        wanted = set(product_ids)
        selected = [product for product in eligible if product.id in wanted]
        try:
            result = build_handoff(
                shop_domain=connection.shop_domain,
                look=look,
                products=selected,
                shop_gpsr=await self._gpsr(),
            )
        except HandoffError as exc:
            return JobOutcome(error=str(exc))
        await settle_plan_job(
            self.session,
            self.settings,
            self.user_id,
            "website_handoff",
            confirm_overflow=confirm_overflow,
        )
        return JobOutcome(lovable_url=result.lovable_url, product_count=result.product_count)

    def _trace(self, job: str, product_id: int, photo, pack_id: str | None) -> dict:
        return {
            "store": listing_copy_trace_store(self.settings),
            "job": job,
            "product_id": product_id,
            "group_id": getattr(photo, "product_group_id", None) if photo is not None else None,
            "pack_id": pack_id,
        }
