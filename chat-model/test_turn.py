"""The other server answers one step and refuses a caller without the token."""

import json

from turn import authorized, step_from_model, turn


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


def test_the_token_must_match() -> None:
    assert authorized("Bearer same-secret", "same-secret")
    assert not authorized("Bearer other", "same-secret")
    assert not authorized(None, "same-secret")
    assert not authorized("Bearer same-secret", "")
