"""The other server answers one step and refuses a caller without the token."""

import json

from turn import authorized, step_from_model, turn


def test_the_model_runs_an_act_when_the_message_already_has_its_inputs() -> None:
    seen: list[str] = []

    def complete(prompt: str) -> str:
        seen.append(prompt)
        return json.dumps({"text": "Hi.", "done": True})

    turn({"message": "Set the price to 19"}, complete)
    instruction = seen[0]
    assert "name that act and those inputs" in instruction
    assert "Do not ask the seller to confirm" in instruction
    assert "only when one required input is absent" in instruction
    assert "Do not invent a price, a quantity, a fibre, or a legal fact" in instruction


def test_a_question_is_asked_for_the_words_the_seller_reads() -> None:
    seen: list[str] = []

    def complete(prompt: str) -> str:
        seen.append(prompt)
        return json.dumps({"text": "Hi.", "done": True})

    turn({"message": "hello"}, complete)
    assert 'set "text" to the words the seller reads' in seen[0]
    assert 'Never reply with only "done"' in seen[0]


def test_a_question_comes_back_as_text_with_no_act() -> None:
    def complete(prompt: str) -> str:
        assert "What's on hand?" in prompt
        return json.dumps({"text": "Four are on hand.", "done": True})

    assert turn({"message": "What's on hand?"}, complete) == {
        "text": "Four are on hand.",
        "done": True,
    }


def test_an_unknown_act_and_an_id_are_dropped() -> None:
    raw = json.dumps(
        {
            "text": "Which product?",
            "act": "scrape_shop",
            "product": 42,
            "done": True,
        }
    )
    assert step_from_model(raw) == {"text": "Which product?", "done": True}


def test_a_named_act_is_kept() -> None:
    raw = json.dumps({"act": "go_live", "product": "this", "done": True})
    assert step_from_model(raw) == {"act": "go_live", "product": "this", "done": True}


def test_grouping_photos_is_an_act_the_model_may_request() -> None:
    seen: list[str] = []

    def complete(prompt: str) -> str:
        seen.append(prompt)
        return json.dumps({"act": "group", "done": True})

    assert turn({"message": "Group them."}, complete) == {"act": "group", "done": True}
    assert 'act "group"' in seen[0]


def test_the_token_must_match() -> None:
    assert authorized("Bearer same-secret", "same-secret")
    assert not authorized("Bearer other", "same-secret")
    assert not authorized(None, "same-secret")
    assert not authorized("Bearer same-secret", "")
