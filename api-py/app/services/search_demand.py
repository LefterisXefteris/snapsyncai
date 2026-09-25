"""Search demand adapter. DataForSEO keyword ideas are the queries people type."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any
from urllib.parse import urlparse

import httpx

DATAFORSEO_LIVE_URL = (
    "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live"
)
_MAX_KEYWORDS = 20
_MAX_KEYWORD_LEN = 80
_OK = 20000


class SearchDemandError(Exception):
    pass


def is_dataforseo_url(url: str | None) -> bool:
    if not url or not str(url).strip():
        return False
    host = urlparse(str(url).strip()).hostname or ""
    return host == "dataforseo.com" or host.endswith(".dataforseo.com")


def dataforseo_task(seeds: Sequence[str]) -> dict[str, Any]:
    keywords: list[str] = []
    for seed in seeds:
        text = str(seed).strip()[:_MAX_KEYWORD_LEN]
        if not text:
            continue
        keywords.append(text)
        if len(keywords) == _MAX_KEYWORDS:
            break
    return {"keywords": keywords, "language_code": "en"}


def queries_from_dataforseo(payload: Mapping[str, Any]) -> tuple[str, ...]:
    status = payload.get("status_code")
    if status != _OK:
        message = payload.get("status_message") or "Search demand failed."
        raise SearchDemandError(str(message))
    queries: list[str] = []
    tasks = payload.get("tasks")
    if not isinstance(tasks, list):
        return ()
    for task in tasks:
        if not isinstance(task, Mapping):
            continue
        if task.get("status_code") != _OK:
            message = task.get("status_message") or "Search demand failed."
            raise SearchDemandError(str(message))
        result = task.get("result")
        if not isinstance(result, list):
            continue
        for row in result:
            if len(queries) == _MAX_KEYWORDS:
                return tuple(queries)
            if not isinstance(row, Mapping):
                continue
            keyword = row.get("keyword")
            if isinstance(keyword, str) and keyword.strip():
                queries.append(keyword.strip())
    return tuple(queries)


async def fetch_dataforseo(
    seeds: Sequence[str],
    url: str,
    login: str | None,
    password: str | None,
) -> tuple[str, ...]:
    task = dataforseo_task(seeds)
    if not task["keywords"]:
        return ()
    if not login or not str(login).strip() or not password or not str(password).strip():
        raise SearchDemandError("Search demand is not configured.")
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url.strip(),
            json=[task],
            auth=(str(login).strip(), str(password).strip()),
        )
        response.raise_for_status()
        payload = response.json()
    if not isinstance(payload, Mapping):
        raise SearchDemandError("Search demand failed.")
    return queries_from_dataforseo(payload)
