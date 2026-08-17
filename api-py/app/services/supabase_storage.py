"""Supabase Storage — port of `server/supabaseClient.ts`."""

from __future__ import annotations

import logging
from functools import lru_cache

from app.config import get_settings

logger = logging.getLogger(__name__)

STORAGE_BUCKET = "product-images"


@lru_cache
def _client():
    settings = get_settings()
    url = settings.require("supabase_url")
    key = settings.require("supabase_anon_key")
    from supabase import create_client

    return create_client(url, key)


def upload_image_to_storage(
    file_buffer: bytes,
    mime_type: str,
    image_id: int,
    original_name: str,
) -> str | None:
    ext = original_name.rsplit(".", 1)[-1] if "." in original_name else "jpg"
    import time

    path = f"{image_id}/{int(time.time() * 1000)}.{ext}"
    try:
        supabase = _client()
        error = supabase.storage.from_(STORAGE_BUCKET).upload(
            path,
            file_buffer,
            {"content-type": mime_type, "upsert": "false"},
        )
        if getattr(error, "error", None):
            logger.error("Supabase Storage upload error: %s", error.error)
            return None
        data = supabase.storage.from_(STORAGE_BUCKET).get_public_url(path)
        if isinstance(data, dict):
            return data.get("publicUrl") or data.get("public_url")
        return str(data)
    except Exception:
        logger.exception("Supabase Storage upload error")
        return None


async def upload_file_to_storage(
    file_buffer: bytes,
    mime_type: str,
    image_id: int,
    original_name: str,
) -> str | None:
    import asyncio

    try:
        return await asyncio.to_thread(
            upload_image_to_storage, file_buffer, mime_type, image_id, original_name
        )
    except Exception:
        logger.exception("uploadFileToStorage error")
        return None
