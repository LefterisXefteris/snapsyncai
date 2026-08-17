"""Image upload + AI/SSE routes — port of `server/routes.ts` upload and ~3182-3671."""

# Prompt strings are copied from Express; wrapping them would drift from the source of truth.
# ruff: noqa: E501

from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from app.auth.clerk import CurrentUser
from app.config import SettingsDep
from app.db import SessionDep
from app.schemas.ai import (
    GenerateContentBody,
    RegenerateFieldBody,
)
from app.schemas.image import ImageOut
from app.services import images as store
from app.services.image_analysis import (
    full_analyze_image,
    full_analyze_multiple_images,
    quick_preview_image,
    quick_preview_multiple_images,
)
from app.services.image_buffers import set_image_buffer
from app.services.openai_client import get_openai
from app.services.subscriptions import has_active_subscription
from app.services.supabase_storage import upload_file_to_storage
from app.services.upload_langgraph import resolve_upload_processing_mode

logger = logging.getLogger(__name__)

router = APIRouter(tags=["images-ai"])

MIN_IMAGE_COUNT = 1
MAX_UPLOAD_FILES = 200
MAX_FILE_BYTES = 10 * 1024 * 1024
CONCURRENCY_LIMIT = 10

FIELD_PROMPTS = {
    "title": "Generate a single product title. Output only the title text, no JSON, no quotes.",
    "description": (
        "Rewrite the product description — 3-4 engaging paragraphs. Output only the description text."
    ),
    "seoKeywords": (
        'Generate SEO keywords as a JSON array of strings: ["keyword1", "keyword2", ...]. '
        "Output only the JSON array."
    ),
    "aeoFaqs": (
        'Generate FAQ pairs as a JSON array: [{"q": "...", "a": "..."}]. '
        "Output only the JSON array."
    ),
}

GENERATE_CONTENT_SYSTEM = """You are an expert e-commerce copywriter. Generate product listing content for a product shown in the image.
Output ONLY valid JSON with this exact structure (no markdown, no code fences):
{
  "title": "Product title — specific, benefit-led, max 80 chars",
  "description": "3-4 paragraph product description, engaging and conversion-optimised",
  "seoKeywords": ["keyword1", "keyword2", ...],
  "aeoFaqs": [{"q": "Question?", "a": "Answer."}, ...]
}
Rules:
- seoKeywords: 8-12 specific keywords/phrases for Shopify search — brand, material, use case, style
- aeoFaqs: 4-6 FAQ pairs that answer common buyer questions about this type of product (price not included)
- Use the category, style/tone, and target audience provided by the user"""


def _message(status: int, message: str, **extra: Any) -> JSONResponse:
    """Express-shaped error body: `{ message }` (the SPA reads this key)."""
    return JSONResponse(status_code=status, content={"message": message, **extra})


def _strip_ext(name: str) -> str:
    return re.sub(r"\.[^/.]+$", "", name)


def _owned(image, user_id: str) -> bool:
    return image is not None and image.session_id == user_id


async def run_with_concurrency(items: list, limit: int, fn) -> list:
    results: list = [None] * len(items)
    queue = list(enumerate(items))

    async def worker() -> None:
        while True:
            try:
                index, item = queue.pop(0)
            except IndexError:
                return
            results[index] = await fn(item, index)

    await asyncio.gather(*(worker() for _ in range(min(limit, len(items)))))
    return results


async def _persist_storage(session, image, buf: bytes, mime: str, original_name: str):
    set_image_buffer(image.id, buf)
    storage_url = await upload_file_to_storage(buf, mime, image.id, original_name)
    if storage_url:
        updated = await store.update_image(session, image.id, {"storage_url": storage_url})
        return updated or image
    return image


@router.post("/api/images/upload", response_model=list[ImageOut])
async def upload_images(
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    images: list[UploadFile] = File(default=[]),
    product_context: str = Form(default="", alias="productContext"),
    brand_tone: str = Form(default="professional", alias="brandTone"),
    group_as_one: str = Form(default="false", alias="groupAsOne"),
):
    try:
        files = [f for f in images if f.filename]
        if not files:
            return _message(400, "No files uploaded")
        if len(files) < MIN_IMAGE_COUNT:
            return _message(
                400,
                f"Minimum {MIN_IMAGE_COUNT} images required. You uploaded {len(files)}.",
            )
        if len(files) > MAX_UPLOAD_FILES:
            return _message(400, "Maximum 200 images per upload.")

        loaded: list[tuple[UploadFile, bytes]] = []
        for upload in files:
            data = await upload.read()
            if len(data) > MAX_FILE_BYTES:
                return _message(400, f"{upload.filename} exceeds the 10MB limit.")
            loaded.append((upload, data))

        group_flag = group_as_one in ("true", "True", "1")
        paid = await has_active_subscription(session, user_id, settings)
        upload_mode = resolve_upload_processing_mode(
            file_count=len(loaded),
            group_as_one=group_flag,
            has_active_subscription=paid,
        )
        context = product_context or ""
        tone = brand_tone or "professional"

        if upload_mode in ("groupedPaid", "groupedPreview"):
            group_id = str(uuid.uuid4())
            file_inputs = [
                (buf, f.content_type or "application/octet-stream", f.filename or "image")
                for f, buf in loaded
            ]
            analysis: dict[str, Any] | None = None
            analysis_succeeded = False
            if upload_mode == "groupedPaid":
                analysis = await full_analyze_multiple_images(
                    file_inputs, tone, context or None
                )
                analysis_succeeded = analysis["description"] != "Failed to analyze images."
            else:
                analysis = await quick_preview_multiple_images(
                    file_inputs, context or None, tone
                )
                analysis_succeeded = True

            results = []
            for idx, (upload, buf) in enumerate(loaded):
                is_primary = idx == 0
                mime = upload.content_type or "application/octet-stream"
                name = upload.filename or "image"
                try:
                    if upload_mode == "groupedPaid" and analysis_succeeded:
                        a = analysis
                        colors = a.get("imageColors") or []
                        detected = colors[idx] if idx < len(colors) else None
                        values = {
                            "original_name": name,
                            "mime_type": mime,
                            "size": len(buf),
                            "image_data": None,
                            "title": a["title"] if is_primary else f"{a['title']} (view {idx + 1})",
                            "description": a.get("description") if is_primary else None,
                            "price": a.get("price") if is_primary else None,
                            "category": a.get("category"),
                            "main_category": a.get("mainCategory"),
                            "product_type": a.get("productType"),
                            "tags": a.get("tags") if is_primary else [],
                            "seo_title": a.get("seoTitle") if is_primary else None,
                            "seo_description": a.get("seoDescription") if is_primary else None,
                            "alt_text": (
                                f"{detected} {a.get('altText') or a['title']}"
                                if detected
                                else a.get("altText")
                            ),
                            "aeo_faqs": a.get("aeoFaqs") if is_primary else None,
                            "aeo_snippet": a.get("aeoSnippet") if is_primary else None,
                            "variants": a.get("variants") if is_primary else None,
                            "ai_data": (
                                a
                                if is_primary
                                else ({"detectedColor": detected} if detected else None)
                            ),
                            "shopify_status": "pending",
                            "payment_status": "paid",
                            "product_context": context or None,
                            "brand_tone": tone,
                            "product_group_id": group_id,
                            "session_id": user_id,
                        }
                    else:
                        a = analysis
                        values = {
                            "original_name": name,
                            "mime_type": mime,
                            "size": len(buf),
                            "image_data": None,
                            "title": a["title"] if is_primary else f"{a['title']} (view {idx + 1})",
                            "category": a.get("category"),
                            "main_category": a.get("mainCategory"),
                            "product_type": a.get("productType"),
                            "tags": a.get("tags") if is_primary else [],
                            "shopify_status": "pending",
                            "payment_status": "paid" if upload_mode == "groupedPaid" else "unpaid",
                            "product_context": context or None,
                            "brand_tone": tone,
                            "product_group_id": group_id,
                            "session_id": user_id,
                        }
                    image = await store.create_image(session, values)
                    image = await _persist_storage(session, image, buf, mime, name)
                    results.append(ImageOut.model_validate(image))
                except Exception:
                    logger.exception("Failed to store grouped image %s", name)
                    fallback = await store.create_image(
                        session,
                        {
                            "original_name": name,
                            "mime_type": mime,
                            "size": len(buf),
                            "image_data": None,
                            "title": _strip_ext(name),
                            "category": "Other",
                            "tags": [],
                            "shopify_status": "pending",
                            "payment_status": "paid" if paid else "unpaid",
                            "product_context": context or None,
                            "brand_tone": tone,
                            "product_group_id": group_id,
                            "session_id": user_id,
                        },
                    )
                    fallback = await _persist_storage(session, fallback, buf, mime, name)
                    results.append(ImageOut.model_validate(fallback))
            return results

        async def process_one(item: tuple[UploadFile, bytes], _idx: int):
            upload, buf = item
            mime = upload.content_type or "application/octet-stream"
            name = upload.filename or "image"
            try:
                if upload_mode == "singlePaid":
                    analysis = await full_analyze_image(
                        buf, mime, name, tone, context or None
                    )
                    ok = analysis["description"] != "Failed to analyze image."
                    image = await store.create_image(
                        session,
                        {
                            "original_name": name,
                            "mime_type": mime,
                            "size": len(buf),
                            "image_data": None,
                            "title": analysis["title"] if ok else _strip_ext(name),
                            "description": analysis.get("description") if ok else None,
                            "price": analysis.get("price") if ok else None,
                            "category": analysis.get("category") if ok else "Other",
                            "product_type": analysis.get("productType") if ok else None,
                            "tags": analysis.get("tags") if ok else [],
                            "seo_title": analysis.get("seoTitle") if ok else None,
                            "seo_description": analysis.get("seoDescription") if ok else None,
                            "alt_text": analysis.get("altText") if ok else None,
                            "aeo_faqs": analysis.get("aeoFaqs") if ok else None,
                            "aeo_snippet": analysis.get("aeoSnippet") if ok else None,
                            "variants": analysis.get("variants") if ok else None,
                            "ai_data": analysis if ok else None,
                            "shopify_status": "pending",
                            "payment_status": "paid",
                            "product_context": context or None,
                            "brand_tone": tone,
                            "session_id": user_id,
                        },
                    )
                    image = await _persist_storage(session, image, buf, mime, name)
                    return ImageOut.model_validate(image)

                preview = await quick_preview_image(buf, mime, name, context or None, tone)
                image = await store.create_image(
                    session,
                    {
                        "original_name": name,
                        "mime_type": mime,
                        "size": len(buf),
                        "image_data": None,
                        "title": preview["title"],
                        "category": preview["category"],
                        "product_type": preview["productType"],
                        "tags": preview["tags"],
                        "shopify_status": "pending",
                        "payment_status": "unpaid",
                        "product_context": context or None,
                        "brand_tone": tone,
                        "session_id": user_id,
                    },
                )
                image = await _persist_storage(session, image, buf, mime, name)
                return ImageOut.model_validate(image)
            except Exception:
                logger.exception("Failed to process %s", name)
                fallback = await store.create_image(
                    session,
                    {
                        "original_name": name,
                        "mime_type": mime,
                        "size": len(buf),
                        "image_data": None,
                        "title": _strip_ext(name),
                        "category": "Other",
                        "tags": [],
                        "shopify_status": "pending",
                        "payment_status": "paid" if upload_mode == "singlePaid" else "unpaid",
                        "product_context": context or None,
                        "brand_tone": tone,
                        "session_id": user_id,
                    },
                )
                fallback = await _persist_storage(session, fallback, buf, mime, name)
                return ImageOut.model_validate(fallback)

        results = await run_with_concurrency(loaded, CONCURRENCY_LIMIT, process_one)
        return results
    except Exception as exc:
        logger.exception("Upload error")
        return _message(500, str(exc) or "Internal server error during upload processing")


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


async def _stream_chat(messages: list, max_tokens: int) -> AsyncIterator[str]:
    try:
        stream = await get_openai().chat.completions.create(
            model="gpt-5.2",
            stream=True,
            max_completion_tokens=max_tokens,
            messages=messages,
        )
        async for chunk in stream:
            content = chunk.choices[0].delta.content or "" if chunk.choices else ""
            if content:
                yield _sse({"content": content})
        yield _sse({"done": True})
    except Exception:
        logger.exception("SSE generation error")
        yield _sse({"error": "Generation failed"})


@router.post("/api/images/{image_id}/generate-content")
async def generate_content(
    image_id: int, body: GenerateContentBody, user_id: CurrentUser, session: SessionDep
):
    image = await store.get_image(session, image_id)
    if not _owned(image, user_id):
        return _message(404, "Image not found")
    buf = await store.load_image_bytes(image)
    if buf is None:
        return _message(400, "Image not available for AI analysis")
    mime = image.mime_type or "image/jpeg"
    user_text = (
        f"Category: {body.category or image.category or 'General'}\n"
        f"Style/tone: {body.style_tone or 'professional'}\n"
        f"Target audience: {body.audience or 'general buyers'}\n"
        f"Product title context: {image.title or image.original_name or ''}"
    )
    messages = [
        {"role": "system", "content": GENERATE_CONTENT_SYSTEM},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": user_text},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime};base64,{base64.b64encode(buf).decode()}"},
                },
            ],
        },
    ]
    return StreamingResponse(
        _stream_chat(messages, 1500),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.post("/api/images/{image_id}/regenerate-field")
async def regenerate_field(
    image_id: int, body: RegenerateFieldBody, user_id: CurrentUser, session: SessionDep
):
    image = await store.get_image(session, image_id)
    if not _owned(image, user_id):
        return _message(404, "Image not found")
    buf = await store.load_image_bytes(image)
    if buf is None:
        return _message(400, "Image not available for AI analysis")
    system_prompt = FIELD_PROMPTS.get(body.field)
    if not system_prompt:
        return _message(400, f"Unknown field: {body.field}")
    mime = image.mime_type or "image/jpeg"
    user_text = (
        f"Category: {body.category or image.category or 'General'}\n"
        f"Style/tone: {body.style_tone or 'professional'}\n"
        f"Target audience: {body.audience or 'general buyers'}\n"
        f"Product title context: {image.title or image.original_name or ''}"
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": user_text},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime};base64,{base64.b64encode(buf).decode()}"},
                },
            ],
        },
    ]
    return StreamingResponse(
        _stream_chat(messages, 1000),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
