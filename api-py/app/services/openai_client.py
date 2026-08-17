"""Lazy AsyncOpenAI client — port of `server/replit_integrations/image/client.ts`."""

from __future__ import annotations

from openai import AsyncOpenAI

from app.config import get_settings

_client: AsyncOpenAI | None = None


def get_openai() -> AsyncOpenAI:
    global _client
    if _client is not None:
        return _client
    settings = get_settings()
    api_key = settings.require("ai_integrations_openai_api_key")
    kwargs: dict = {"api_key": api_key}
    if settings.ai_integrations_openai_base_url:
        kwargs["base_url"] = settings.ai_integrations_openai_base_url
    _client = AsyncOpenAI(**kwargs)
    return _client
