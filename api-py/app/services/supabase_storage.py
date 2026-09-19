"""Supabase Storage — private SnapSync photos; Channel CDN URLs stay public."""

from __future__ import annotations

import logging
from functools import lru_cache
from urllib.parse import urlparse

from app.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_STORAGE_BUCKET = "product-images"
SIGNED_URL_TTL_SECONDS = 15 * 60


def stored_object_url(settings, path: str) -> str:
    """Locator stored on the photo row. Not a world-readable public URL."""
    base = str(settings.supabase_url).rstrip("/")
    return f"{base}/storage/v1/object/authenticated/{_bucket(settings)}/{path}"


@lru_cache
def _client():
    settings = get_settings()
    url = settings.require("supabase_url")
    key = settings.require("supabase_service_role_key")
    from supabase import create_client

    return create_client(url, key)


def _bucket(settings) -> str:
    return getattr(settings, "supabase_storage_bucket", None) or DEFAULT_STORAGE_BUCKET


def is_snapsync_storage_url(url: str | None, settings) -> bool:
    if not url or not getattr(settings, "supabase_url", None):
        return False
    base = str(settings.supabase_url).rstrip("/")
    if not url.startswith(f"{base}/storage/v1/object/"):
        return False
    return f"/{_bucket(settings)}/" in url


def object_path_from_storage_url(url: str, settings) -> str | None:
    marker = f"/{_bucket(settings)}/"
    index = url.find(marker)
    if index < 0:
        return None
    path = url[index + len(marker) :]
    return path.split("?", 1)[0] or None


def _absolute_signed_url(signed: str, settings) -> str:
    if signed.startswith("https://"):
        return signed
    base = str(settings.supabase_url).rstrip("/")
    return f"{base}{signed if signed.startswith('/') else '/' + signed}"


def signed_url_for_object(path: str, settings) -> str | None:
    try:
        bucket = _bucket(settings)
        data = _client().storage.from_(bucket).create_signed_url(
            path, SIGNED_URL_TTL_SECONDS
        )
        if isinstance(data, dict):
            signed = data.get("signedURL") or data.get("signedUrl") or data.get("signed_url")
            if signed:
                return _absolute_signed_url(str(signed), settings)
        if data:
            return _absolute_signed_url(str(data), settings)
    except Exception:
        logger.exception("Supabase signed URL error")
    return None


def media_original_source(url: str | None, settings) -> str | None:
    """URL Shopify can GET: Channel CDN as-is, SnapSync bucket as a short-lived signed URL."""
    if not isinstance(url, str) or not url.startswith("https://"):
        return None
    if not is_snapsync_storage_url(url, settings):
        return url
    path = object_path_from_storage_url(url, settings)
    if not path:
        return None
    return signed_url_for_object(path, settings)


def download_storage_bytes(url: str, settings) -> bytes | None:
    path = object_path_from_storage_url(url, settings)
    if not path:
        return None
    try:
        data = _client().storage.from_(_bucket(settings)).download(path)
        if isinstance(data, bytes):
            return data
        if data:
            return bytes(data)
    except Exception:
        logger.exception("Supabase Storage download error")
    return None


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
        settings = get_settings()
        bucket = _bucket(settings)
        supabase = _client()
        error = supabase.storage.from_(bucket).upload(
            path,
            file_buffer,
            {"content-type": mime_type, "upsert": "false"},
        )
        if getattr(error, "error", None):
            logger.error("Supabase Storage upload error: %s", error.error)
            return None
        return stored_object_url(settings, path)
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


async def download_storage_bytes_async(url: str, settings) -> bytes | None:
    import asyncio

    return await asyncio.to_thread(download_storage_bytes, url, settings)


def channel_photo_url(url: str | None) -> str | None:
    """Website and public 302s may use Channel CDN; never a SnapSync storage path."""
    if not url:
        return None
    parsed = urlparse(url)
    if "/storage/v1/object/" in parsed.path:
        return None
    return url
