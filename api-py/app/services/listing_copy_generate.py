"""The product page's generate job. Chat and the generate route share this prompt.

The prompt string is the page's. Wrapping it would drift from that source.
"""

# ruff: noqa: E501

from __future__ import annotations

import base64
import json
import logging
import re
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.services import images as store
from app.services import product
from app.services.chat_listing import Proposal, proposal_text
from app.services.openai_client import get_openai
from app.services.plan_charge import may_start
from app.services.product_facts import generation_blocked_reason, listing_copy_constraints

logger = logging.getLogger(__name__)

PHOTO_FILE_MISSING = (
    "This photo's file is missing. Re-upload it before generating listing copy."
)
GENERATION_FAILED = "Generation failed"
COULD_NOT_PARSE = "Could not parse generated content."
_OBJECT = re.compile(r"\{[\s\S]*\}")
_ARRAY = re.compile(r"\[[\s\S]*\]")

FIELD_PROMPTS = {
    "title": "Generate a single product title. Output only the title text, no JSON, no quotes.",
    "description": (
        "Rewrite the product description — 3-4 engaging paragraphs. Output only the description text."
    ),
    "seoKeywords": (
        'Generate SEO keywords as a JSON array of strings: ["keyword1", "keyword2", ...]. '
        "Output only the JSON array."
    ),
    "seoTitle": (
        "Generate an SEO title. Max 70 characters, specific, with product name. "
        "Output only the title text, no JSON, no quotes."
    ),
    "seoDescription": (
        "Generate a meta description. Max 320 characters, specific to this product. "
        "Output only the description text."
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
  "seoTitle": "SEO title — specific, max 70 chars",
  "seoDescription": "Meta description — specific, max 320 chars",
  "aeoFaqs": [{"q": "Question?", "a": "Answer."}, ...]
}
Rules:
- seoKeywords: 8-12 specific keywords/phrases for Shopify search — brand, material, use case, style
- seoTitle: SEO title for search results, max 70 characters
- seoDescription: meta description for search results, max 320 characters
- aeoFaqs: 4-6 FAQ pairs that answer common buyer questions about this type of product (price not included)
- Use the category, style/tone, and target audience provided by the user"""


def generate_messages(
    image,
    facts,
    shop_gpsr,
    buf: bytes,
    *,
    category: str | None = None,
    style_tone: str | None = None,
    audience: str | None = None,
) -> list:
    """The prompt the product page sends for first generate."""
    mime = image.mime_type or "image/jpeg"
    user_text = (
        f"Category: {category or image.category or 'General'}\n"
        f"Style/tone: {style_tone or 'professional'}\n"
        f"Target audience: {audience or 'general buyers'}\n"
        f"Product title context: {image.title or image.original_name or ''}"
    )
    extra = listing_copy_constraints(facts, shop_gpsr)
    system = f"{GENERATE_CONTENT_SYSTEM}\n{extra}" if extra else GENERATE_CONTENT_SYSTEM
    return [
        {"role": "system", "content": system},
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


def proposal_from_completion(raw: str) -> Proposal | str:
    """The JSON the page parses into title, description, tags, SEO, and AEO FAQs."""
    parsed = _json_object(raw)
    if parsed is None:
        return COULD_NOT_PARSE
    proposal = Proposal(
        title=_text(parsed.get("title")),
        description=_text(parsed.get("description")),
        tags=_tags(parsed.get("seoKeywords")),
        seo_title=_text(parsed.get("seoTitle")),
        seo_description=_text(parsed.get("seoDescription")),
        aeo_faqs=_faqs(parsed.get("aeoFaqs")),
    )
    if not proposal_text(proposal):
        return COULD_NOT_PARSE
    return proposal


async def generate_listing_copy(
    session: AsyncSession,
    settings: Settings,
    user_id: str,
    product_id: int,
) -> Proposal | str:
    """First generate for one product. A string is the page's refusal."""
    loaded = await product.load(session, user_id, product_id)
    if loaded is None:
        return "Which product? I don't see that one."
    reason = generation_blocked_reason(loaded.facts)
    if reason:
        return reason
    blocked = await may_start(session, settings, user_id, "generate_persist")
    if blocked:
        return blocked
    image = loaded.photo
    buf = await store.load_image_bytes(image)
    if buf is None:
        return PHOTO_FILE_MISSING
    try:
        response = await get_openai().chat.completions.create(
            model="gpt-5.2",
            max_completion_tokens=1500,
            messages=generate_messages(image, loaded.facts, loaded.shop_gpsr, buf),
        )
        text = response.choices[0].message.content or "" if response.choices else ""
    except Exception:
        logger.exception("generate listing copy failed")
        return GENERATION_FAILED
    return proposal_from_completion(text)


def _json_object(raw: str) -> dict | None:
    text = raw.strip()
    if not text:
        return None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = _OBJECT.search(text)
        if match is None:
            return None
        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return parsed if isinstance(parsed, dict) else None


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _tags(value: object) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    return tuple(item.strip() for item in value if isinstance(item, str) and item.strip())


@dataclass(frozen=True)
class FieldText:
    """One regenerated listing-copy field, not yet Accepted."""

    field: str
    text: str
    tags: tuple[str, ...] | None = None
    faqs: tuple[tuple[str, str], ...] | None = None


async def regenerate_listing_field(
    session: AsyncSession,
    settings: Settings,
    user_id: str,
    product_id: int,
    field: str,
) -> FieldText | str:
    """Regenerate one listing-copy field. A string is the page's refusal."""
    loaded = await product.load(session, user_id, product_id)
    if loaded is None:
        return "Which product? I don't see that one."
    reason = generation_blocked_reason(loaded.facts)
    if reason:
        return reason
    blocked = await may_start(session, settings, user_id, "generate_persist")
    if blocked:
        return blocked
    image = loaded.photo
    buf = await store.load_image_bytes(image)
    if buf is None:
        return PHOTO_FILE_MISSING
    prompt = FIELD_PROMPTS.get(field)
    if not prompt:
        return f"Unknown field: {field}"
    extra = listing_copy_constraints(loaded.facts, loaded.shop_gpsr)
    system = f"{prompt}\n{extra}" if extra else prompt
    mime = image.mime_type or "image/jpeg"
    user_text = (
        f"Category: {image.category or 'General'}\n"
        f"Style/tone: professional\n"
        f"Target audience: general buyers\n"
        f"Product title context: {image.title or image.original_name or ''}"
    )
    messages = [
        {"role": "system", "content": system},
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
    try:
        response = await get_openai().chat.completions.create(
            model="gpt-5.2",
            max_completion_tokens=1000,
            messages=messages,
        )
        raw = response.choices[0].message.content or "" if response.choices else ""
    except Exception:
        logger.exception("regenerate listing field failed")
        return GENERATION_FAILED
    return _field_text(field, raw)


def _field_text(field: str, raw: str) -> FieldText | str:
    if field in {"title", "description", "seoTitle", "seoDescription"}:
        text = raw.strip()
        if not text:
            return COULD_NOT_PARSE
        return FieldText(field, text)
    parsed = _json_array(raw)
    if field == "seoKeywords":
        if not isinstance(parsed, list) or not all(isinstance(tag, str) for tag in parsed):
            return COULD_NOT_PARSE
        tags = tuple(tag.strip() for tag in parsed if tag.strip())
        if not tags:
            return COULD_NOT_PARSE
        return FieldText(field, ", ".join(tags), tags=tags)
    faqs = _faqs(parsed)
    if not faqs:
        return COULD_NOT_PARSE
    text = "\n\n".join(f"{question}\n{answer}" for question, answer in faqs)
    return FieldText(field, text, faqs=faqs)


def _json_array(raw: str) -> object:
    text = raw.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = _ARRAY.search(text)
        if match is None:
            return None
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None


def _faqs(value: object) -> tuple[tuple[str, str], ...]:
    if not isinstance(value, list):
        return ()
    pairs: list[tuple[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        question = _text(item.get("q"))
        answer = _text(item.get("a"))
        if question or answer:
            pairs.append((question, answer))
    return tuple(pairs)
