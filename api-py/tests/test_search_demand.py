"""Search demand adapter — DataForSEO keyword ideas become the queries people type."""

import pytest

from app.services.listing_copy_refresh import search_demand_configured
from app.services.search_demand import (
    DATAFORSEO_LIVE_URL,
    SearchDemandError,
    dataforseo_task,
    fetch_dataforseo,
    queries_from_dataforseo,
)


def test_dataforseo_keywords_are_the_queries_people_type() -> None:
    payload = {
        "status_code": 20000,
        "status_message": "Ok.",
        "tasks": [
            {
                "status_code": 20000,
                "result": [
                    {"keyword": "linen dress"},
                    {"keyword": "  "},
                    {"keyword": "cotton tee"},
                ],
            }
        ],
    }
    assert queries_from_dataforseo(payload) == ("linen dress", "cotton tee")


def test_dataforseo_keeps_the_first_twenty_queries() -> None:
    payload = {
        "status_code": 20000,
        "tasks": [
            {
                "status_code": 20000,
                "result": [{"keyword": f"query {index}"} for index in range(21)],
            }
        ],
    }
    assert queries_from_dataforseo(payload) == tuple(f"query {index}" for index in range(20))


def test_dataforseo_auth_failure_is_not_empty_demand() -> None:
    with pytest.raises(SearchDemandError, match="Unauthorized"):
        queries_from_dataforseo(
            {"status_code": 40100, "status_message": "Unauthorized", "tasks": []}
        )


def test_dataforseo_is_configured_only_with_login_and_password() -> None:
    url = DATAFORSEO_LIVE_URL
    assert search_demand_configured("password", url) is False
    assert search_demand_configured("password", url, "login") is True


async def test_dataforseo_fetch_posts_keyword_ideas_with_basic_auth(monkeypatch) -> None:
    captured: dict = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "status_code": 20000,
                "tasks": [{"status_code": 20000, "result": [{"keyword": "linen dress"}]}],
            }

    class FakeClient:
        def __init__(self, **kwargs) -> None:
            captured["timeout"] = kwargs.get("timeout")

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args) -> None:
            return None

        async def post(self, url, json, auth):
            captured["url"] = url
            captured["json"] = json
            captured["auth"] = auth
            return FakeResponse()

    monkeypatch.setattr("app.services.search_demand.httpx.AsyncClient", FakeClient)
    queries = await fetch_dataforseo(["linen dress"], DATAFORSEO_LIVE_URL, "login", "secret")
    assert queries == ("linen dress",)
    assert captured["auth"] == ("login", "secret")
    assert captured["url"] == DATAFORSEO_LIVE_URL
    assert captured["json"] == [{"keywords": ["linen dress"], "language_code": "en"}]


def test_dataforseo_task_sends_at_most_twenty_seeds_in_english() -> None:
    seeds = [" linen dress ", "a" * 90, ""] + [f"tag {index}" for index in range(20)]
    assert dataforseo_task(seeds) == {
        "keywords": ["linen dress", "a" * 80, *[f"tag {index}" for index in range(18)]],
        "language_code": "en",
    }
