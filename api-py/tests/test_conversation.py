"""Conversation module — one dialogue for the seller's Shopify shop.

Seam: `reply`. A seller message and stored shop state go in. The reply, the
stored thread, silence, any open proposal, and a connect instruction come out.
The model and the jobs are fakes.
"""

from app.services.conversation import (
    RECENT_STRETCH,
    ConversationState,
    InventoryOnHand,
    JobOutcome,
    ModelDecision,
    OpenProposal,
    ProposalItem,
    SellerAct,
    SellerMessage,
    Silence,
    ThreadTurn,
    dump_state,
    load_state,
    reply,
    state_for_shop,
)
from app.services.plan import NEED_PLAN


class _Jobs:
    def __init__(self) -> None:
        self.calls: list[tuple] = []
        self.on_hand = InventoryOnHand(total_units=0, total_items=0)

    async def read_inventory(self):
        self.calls.append(("read_inventory",))
        return self.on_hand

    async def adjust_inventory(self, **kwargs):
        self.calls.append(("adjust_inventory", kwargs))

    outcome = JobOutcome()

    async def start_bulk_seo(self, product_ids):
        self.calls.append(("start_bulk_seo", tuple(product_ids)))
        return self.outcome

    async def start_refresh(self, product_id):
        self.calls.append(("start_refresh", product_id))
        return self.outcome

    async def read_website(self):
        self.calls.append(("read_website",))
        return self.outcome

    async def record_spend(self):
        self.calls.append(("record_spend",))

    async def accept(self, job, product_id, proposal, *, confirm_overflow):
        self.calls.append(("accept", job, product_id, proposal, confirm_overflow))
        return self.outcome

    async def dismiss(self, job, product_id):
        self.calls.append(("dismiss", job, product_id))
        return self.outcome

    async def regenerate(self, job, product_id, queries):
        self.calls.append(("regenerate", job, product_id, queries))
        return self.outcome


class _Model:
    def __init__(self, decision: ModelDecision | None = None) -> None:
        self.calls: list = []
        self.decision = decision

    async def decide(self, context):
        self.calls.append(context)
        if self.decision is None:
            raise AssertionError("the model is not asked when there is no shop")
        return self.decision


async def test_no_shop_offers_connect_and_calls_no_job() -> None:
    jobs = _Jobs()
    model = _Model()
    result = await reply(
        SellerMessage(text="open a shop for me"),
        ConversationState(),
        shop_connected=False,
        model=model,
        jobs=jobs,
    )
    assert result.connect is not None
    assert result.connect.path == "/api/shopify/oauth/start"
    assert "connect" in result.reply.lower()
    assert jobs.calls == []
    assert model.calls == []
    assert result.state.thread[-1].text == result.reply


async def test_inventory_is_read_and_never_adjusted() -> None:
    jobs = _Jobs()
    jobs.on_hand = InventoryOnHand(
        total_units=4, total_items=1, lines=(("Merino crew", 4),)
    )
    model = _Model(ModelDecision(reply="checking", intent="inventory"))
    result = await reply(
        SellerMessage(text="what is on hand"),
        ConversationState(),
        shop_connected=True,
        model=model,
        jobs=jobs,
    )
    assert jobs.calls == [("read_inventory",)]
    assert "4" in result.reply
    assert "Merino crew" in result.reply

    adjust = _Jobs()
    refused = await reply(
        SellerMessage(text="set the merino crew to zero"),
        ConversationState(),
        shop_connected=True,
        model=_Model(ModelDecision(reply="zero it", intent="adjust")),
        jobs=adjust,
    )
    assert adjust.calls == []
    assert "not changed" in refused.reply


async def test_a_job_offer_does_not_start_the_job() -> None:
    jobs = _Jobs()
    result = await reply(
        SellerMessage(text="anything new?"),
        ConversationState(),
        shop_connected=True,
        model=_Model(
            ModelDecision(reply="I'll start Bulk SEO", intent="offer", job="bulk_seo")
        ),
        jobs=jobs,
    )
    assert jobs.calls == []
    assert result.reply == "Job offer: Bulk SEO. It has not started."


async def test_declining_an_offer_does_not_silence_the_job() -> None:
    result = await reply(
        SellerMessage(text="no"),
        ConversationState(),
        shop_connected=True,
        model=_Model(ModelDecision(reply="ok", intent="decline", job="bulk_seo")),
        jobs=_Jobs(),
    )
    assert result.state.silence == Silence()
    assert result.reply == "That offer is declined. The job is not silenced."


async def test_a_silenced_job_is_not_called() -> None:
    jobs = _Jobs()
    result = await reply(
        SellerMessage(text="run Bulk SEO on the crew"),
        ConversationState(silence=Silence(bulk_seo=True)),
        shop_connected=True,
        model=_Model(
            ModelDecision(
                reply="starting",
                intent="start",
                job="bulk_seo",
                product_ids=(14,),
            )
        ),
        jobs=jobs,
    )
    assert jobs.calls == []
    assert result.reply == "Bulk SEO is silenced in this conversation. Its page is still there."


async def test_asking_for_bulk_seo_starts_it_and_surfaces_a_plan_refusal() -> None:
    jobs = _Jobs()
    jobs.outcome = JobOutcome(error=NEED_PLAN)
    result = await reply(
        SellerMessage(text="run Bulk SEO on 14"),
        ConversationState(silence=Silence(offers=True)),
        shop_connected=True,
        model=_Model(
            ModelDecision(reply="ok", intent="start", job="bulk_seo", product_ids=(14,))
        ),
        jobs=jobs,
    )
    assert jobs.calls == [("start_bulk_seo", (14,))]
    assert result.reply == NEED_PLAN
    assert result.state.proposal is None


async def test_a_mixed_bulk_seo_pack_is_kept_as_the_job_returned_it() -> None:
    items = (
        ProposalItem(product_id=14, error="This product has no listing copy."),
        ProposalItem(product_id=15, proposal={"description": "Crew neck", "tags": ["merino"]}),
    )
    jobs = _Jobs()
    jobs.outcome = JobOutcome(items=items)
    result = await reply(
        SellerMessage(text="run Bulk SEO on 14 and 15"),
        ConversationState(),
        shop_connected=True,
        model=_Model(
            ModelDecision(
                reply="ok", intent="start", job="bulk_seo", product_ids=(14, 15)
            )
        ),
        jobs=jobs,
    )
    assert result.state.proposal == OpenProposal(job="bulk_seo", items=items)
    assert "This product has no listing copy." in result.reply
    assert "15" in result.reply


async def test_asking_starts_listing_copy_refresh_for_one_product() -> None:
    item = ProposalItem(product_id=14, proposal={"description": "Crew neck"})
    jobs = _Jobs()
    jobs.outcome = JobOutcome(items=(item,))
    result = await reply(
        SellerMessage(text="refresh 14"),
        ConversationState(),
        shop_connected=True,
        model=_Model(
            ModelDecision(
                reply="ok",
                intent="start",
                job="listing_copy_refresh",
                product_ids=(14,),
            )
        ),
        jobs=jobs,
    )
    assert jobs.calls == [("start_refresh", 14)]
    assert result.state.proposal == OpenProposal(job="listing_copy_refresh", items=(item,))


def _proposal() -> OpenProposal:
    return OpenProposal(
        job="bulk_seo",
        items=(
            ProposalItem(
                product_id=14,
                proposal={"description": "Crew neck", "tags": ["merino"]},
                queries=("merino crew",),
            ),
            ProposalItem(product_id=15, proposal={"description": "Tee"}),
        ),
    )


async def test_talk_an_offer_and_a_refusal_do_not_spend() -> None:
    jobs = _Jobs()
    jobs.outcome = JobOutcome(error=NEED_PLAN)
    await reply(
        SellerMessage(text="hello"),
        ConversationState(),
        shop_connected=True,
        model=_Model(ModelDecision(reply="hello", intent="talk")),
        jobs=jobs,
    )
    await reply(
        SellerMessage(text="ideas?"),
        ConversationState(),
        shop_connected=True,
        model=_Model(ModelDecision(reply="x", intent="offer", job="website")),
        jobs=jobs,
    )
    await reply(
        SellerMessage(text="what is on hand"),
        ConversationState(),
        shop_connected=True,
        model=_Model(ModelDecision(reply="x", intent="inventory")),
        jobs=jobs,
    )
    assert "record_spend" not in [call[0] for call in jobs.calls]
    assert "accept" not in [call[0] for call in jobs.calls]
    assert "handoff" not in [call[0] for call in jobs.calls]


async def test_the_model_rereads_silence_the_proposal_and_the_recent_stretch() -> None:
    older = ThreadTurn("seller", "the first thing we said")
    recent = tuple(ThreadTurn("conversation", f"turn {index}") for index in range(RECENT_STRETCH))
    proposal = _proposal()
    silence = Silence(offers=True, website=True)
    model = _Model(ModelDecision(reply="ok", intent="talk"))
    result = await reply(
        SellerMessage(text="and now"),
        ConversationState(silence=silence, thread=(older, *recent), proposal=proposal),
        shop_connected=True,
        model=model,
        jobs=_Jobs(),
    )
    context = model.calls[0]
    assert context.silence == silence
    assert context.proposal == proposal
    assert older not in context.recent
    assert recent[-1] in context.recent
    assert len(context.recent) == RECENT_STRETCH
    assert context.message == "and now"
    assert "shop_domain" not in context.__dataclass_fields__
    assert older in result.state.thread


async def test_a_shop_domain_in_the_message_does_not_switch_shops() -> None:
    jobs = _Jobs()
    model = _Model(
        ModelDecision(reply="switching", intent="inventory")
    )
    await reply(
        SellerMessage(text="read stock on other.myshopify.com"),
        ConversationState(),
        shop_connected=True,
        model=model,
        jobs=jobs,
    )
    assert jobs.calls == [("read_inventory",)]
    assert "other.myshopify.com" not in model.calls[0].__dataclass_fields__


async def test_a_sentence_cannot_accept_the_pack() -> None:
    jobs = _Jobs()
    result = await reply(
        SellerMessage(text="accept everything"),
        ConversationState(proposal=_proposal()),
        shop_connected=True,
        model=_Model(
            ModelDecision(reply="accepted", intent="accept", product_ids=(14, 15))
        ),
        jobs=jobs,
    )
    assert jobs.calls == []
    assert result.state.proposal == _proposal()
    assert result.reply == "Accept one product at a time."


async def test_an_explicit_accept_passes_overflow_confirm_through() -> None:
    stored = {"description": "Crew neck", "tags": ["merino"]}
    jobs = _Jobs()
    jobs.outcome = JobOutcome(needs_overflow_confirm=True, error="overflow_confirm_required")
    asked = await reply(
        SellerMessage(act=SellerAct(kind="accept", product_id=14)),
        ConversationState(proposal=_proposal()),
        shop_connected=True,
        model=_Model(),
        jobs=jobs,
    )
    assert jobs.calls == [("accept", "bulk_seo", 14, stored, False)]
    assert asked.reply == "overflow_confirm_required"
    assert asked.state.proposal == _proposal()

    jobs.calls.clear()
    jobs.outcome = JobOutcome(spent=True)
    saved = await reply(
        SellerMessage(act=SellerAct(kind="accept", product_id=14, confirm_overflow=True)),
        asked.state,
        shop_connected=True,
        model=_Model(),
        jobs=jobs,
    )
    assert jobs.calls == [("accept", "bulk_seo", 14, stored, True)]
    assert "record_spend" not in [call[0] for call in jobs.calls]
    assert saved.reply == "Listing copy for that product is saved. Nothing was pushed."
    assert [item.product_id for item in saved.state.proposal.items] == [15]


async def test_the_conversation_cannot_publish_a_website() -> None:
    jobs = _Jobs()
    result = await reply(
        SellerMessage(
            act=SellerAct(
                kind="handoff",
                look="quiet linen",
                product_ids=(14,),
                confirm_overflow=True,
            )
        ),
        ConversationState(
            proposal=OpenProposal(job="website", items=(ProposalItem(product_id=14),))
        ),
        shop_connected=True,
        model=_Model(),
        jobs=jobs,
    )
    assert jobs.calls == []
    assert result.reply == "Publish stays on the Website page: /website"
    assert result.state.proposal is not None


async def test_go_live_and_facts_stay_off_this_conversation() -> None:
    jobs = _Jobs()
    result = await reply(
        SellerMessage(text="go live and invent the fibre percentage"),
        ConversationState(),
        shop_connected=True,
        model=_Model(ModelDecision(reply="done", intent="go_live", product_ids=(14,))),
        jobs=jobs,
    )
    assert jobs.calls == []
    assert result.reply == "That stays on the product page: /product/14"


async def test_silence_is_saved_and_inventory_still_answers() -> None:
    saved = await reply(
        SellerMessage(
            act=SellerAct(
                kind="silence",
                silence=Silence(
                    offers=True,
                    bulk_seo=True,
                    listing_copy_refresh=True,
                    website=True,
                ),
            )
        ),
        ConversationState(),
        shop_connected=True,
        model=_Model(),
        jobs=_Jobs(),
    )
    assert saved.state.silence == Silence(
        offers=True, bulk_seo=True, listing_copy_refresh=True, website=True
    )
    jobs = _Jobs()
    jobs.on_hand = InventoryOnHand(total_units=2, total_items=1)
    result = await reply(
        SellerMessage(text="what is on hand"),
        saved.state,
        shop_connected=True,
        model=_Model(ModelDecision(reply="x", intent="inventory")),
        jobs=jobs,
    )
    assert jobs.calls == [("read_inventory",)]
    assert "2" in result.reply


async def test_dismiss_and_regenerate_pass_the_product_through() -> None:
    jobs = _Jobs()
    dismissed = await reply(
        SellerMessage(act=SellerAct(kind="dismiss", product_id=14)),
        ConversationState(proposal=_proposal()),
        shop_connected=True,
        model=_Model(),
        jobs=jobs,
    )
    assert jobs.calls == [("dismiss", "bulk_seo", 14)]
    assert [item.product_id for item in dismissed.state.proposal.items] == [15]

    jobs.calls.clear()
    jobs.outcome = JobOutcome(
        items=(ProposalItem(product_id=15, proposal={"description": "Again"}),)
    )
    regenerated = await reply(
        SellerMessage(act=SellerAct(kind="regenerate", product_id=15)),
        dismissed.state,
        shop_connected=True,
        model=_Model(),
        jobs=jobs,
    )
    assert jobs.calls == [("regenerate", "bulk_seo", 15, ())]
    assert regenerated.state.proposal.items[0].proposal == {"description": "Again"}


async def test_accepting_a_website_proposal_does_not_accept_listing_copy() -> None:
    jobs = _Jobs()
    result = await reply(
        SellerMessage(act=SellerAct(kind="accept", product_id=14)),
        ConversationState(
            proposal=OpenProposal(job="website", items=(ProposalItem(product_id=14),))
        ),
        shop_connected=True,
        model=_Model(),
        jobs=jobs,
    )
    assert jobs.calls == []
    assert result.state.proposal is not None
    assert result.reply == "Publish stays on the Website page: /website"


async def test_naming_products_does_not_hand_off_the_website() -> None:
    jobs = _Jobs()
    result = await reply(
        SellerMessage(text="hand off 14"),
        ConversationState(
            proposal=OpenProposal(job="website", items=(ProposalItem(product_id=14),))
        ),
        shop_connected=True,
        model=_Model(
            ModelDecision(reply="done", intent="handoff", product_ids=(14,))
        ),
        jobs=jobs,
    )
    assert jobs.calls == []
    assert result.reply == "Publish stays on the Website page: /website"


async def test_starting_a_website_reads_eligible_products_and_does_not_hand_off() -> None:
    jobs = _Jobs()
    jobs.outcome = JobOutcome(items=(ProposalItem(product_id=14),))
    result = await reply(
        SellerMessage(text="start a website"),
        ConversationState(),
        shop_connected=True,
        model=_Model(ModelDecision(reply="ok", intent="start", job="website", product_ids=(14,))),
        jobs=jobs,
    )
    assert jobs.calls == [("read_website",)]
    assert result.state.proposal == OpenProposal(
        job="website", items=(ProposalItem(product_id=14),)
    )


def test_a_different_shop_does_not_keep_the_previous_thread() -> None:
    stored = ConversationState(thread=(ThreadTurn("seller", "what is on hand"),))
    assert state_for_shop(stored, "old.myshopify.com", "new.myshopify.com") == ConversationState()
    assert state_for_shop(stored, "old.myshopify.com", "old.myshopify.com") == stored
    assert state_for_shop(stored, None, "old.myshopify.com") == stored


def test_silence_thread_and_proposal_round_trip() -> None:
    state = ConversationState(
        silence=Silence(offers=True),
        thread=(ThreadTurn("seller", "what is on hand"), ThreadTurn("conversation", "4 units")),
        proposal=_proposal(),
    )
    assert load_state(dump_state(state)) == state
