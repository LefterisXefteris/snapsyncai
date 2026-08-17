"""Vision analysis used on upload — port of the analyze helpers in `server/routes.ts`."""

# Prompts are copied from Express; wrapping them would drift from the source of truth.
# ruff: noqa: E501

from __future__ import annotations

import json
import logging
import re
from typing import Any, TypedDict

from app.services.openai_client import get_openai

logger = logging.getLogger(__name__)

TONE_INSTRUCTIONS: dict[str, str] = {
    "professional": (
        "Write in a polished, professional tone suitable for a premium brand. "
        "Use clear, authoritative language."
    ),
    "casual": (
        "Write in a friendly, conversational tone. Use approachable language "
        "that feels warm and relatable."
    ),
    "luxury": (
        "Write in an aspirational, refined tone. Emphasize exclusivity, "
        "craftsmanship, and premium quality. Use elegant vocabulary."
    ),
    "playful": (
        "Write in a fun, energetic tone. Use creative language, wordplay, and an upbeat vibe."
    ),
    "technical": (
        "Write in a detailed, specification-focused tone. Emphasize features, "
        "materials, dimensions, and performance data."
    ),
}


class QuickPreview(TypedDict):
    title: str
    category: str
    mainCategory: str
    productType: str
    tags: list[str]


class ProductAnalysis(TypedDict, total=False):
    title: str
    description: str
    price: str
    category: str
    mainCategory: str
    productType: str
    tags: list[str]
    seoTitle: str
    seoDescription: str
    altText: str
    aeoFaqs: list[dict[str, str]]
    aeoSnippet: str
    variants: list[dict[str, Any]]
    imageColors: list[str]


def _strip_ext(name: str) -> str:
    return re.sub(r"\.[^/.]+$", "", name)


def parse_json_object(content: str) -> dict | None:
    try:
        parsed = json.loads(content)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        cleaned = re.sub(r"```json\s*", "", content)
        cleaned = re.sub(r"```\s*", "", cleaned)
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if not match:
            return None
        try:
            parsed = json.loads(match.group(0))
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None


def _failed_analysis(original_name: str, plural: bool = False) -> ProductAnalysis:
    return {
        "title": _strip_ext(original_name),
        "description": "Failed to analyze images." if plural else "Failed to analyze image.",
        "price": "0.00",
        "category": "Other",
        "mainCategory": "Uncategorized",
        "productType": "",
        "tags": [],
        "seoTitle": "",
        "seoDescription": "",
        "altText": "",
        "aeoFaqs": [],
        "aeoSnippet": "",
        "variants": [],
    }


def _failed_preview(original_name: str) -> QuickPreview:
    return {
        "title": _strip_ext(original_name),
        "category": "Other",
        "mainCategory": "Uncategorized",
        "productType": "",
        "tags": [],
    }


def _as_analysis(parsed: dict, original_name: str) -> ProductAnalysis:
    return {
        "title": parsed.get("title") or original_name,
        "description": parsed["description"],
        "price": str(parsed.get("price") or "0.00"),
        "category": parsed.get("category") or "Other",
        "mainCategory": parsed.get("mainCategory") or "Uncategorized",
        "productType": parsed.get("productType") or "",
        "tags": [str(t) for t in parsed["tags"]] if isinstance(parsed.get("tags"), list) else [],
        "seoTitle": parsed.get("seoTitle") or parsed.get("title") or original_name,
        "seoDescription": parsed.get("seoDescription") or "",
        "altText": parsed.get("altText") or "",
        "aeoFaqs": parsed["aeoFaqs"] if isinstance(parsed.get("aeoFaqs"), list) else [],
        "aeoSnippet": parsed.get("aeoSnippet") or "",
        "variants": parsed["variants"] if isinstance(parsed.get("variants"), list) else [],
    }


async def quick_preview_image(
    buffer: bytes,
    mime_type: str,
    original_name: str,
    product_context: str | None = None,
    brand_tone: str | None = None,
) -> QuickPreview:
    import base64

    try:
        context_hint = (
            f'\n\nThe seller describes these products as: "{product_context}". '
            "Use this context to more accurately identify and classify the product."
            if product_context
            else ""
        )
        tone_hint = (
            f"\nBrand voice: {TONE_INSTRUCTIONS[brand_tone]}"
            if brand_tone and brand_tone in TONE_INSTRUCTIONS
            else ""
        )
        response = await get_openai().chat.completions.create(
            model="gpt-5.2",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Product image classifier for Shopify. Identify the EXACT "
                        f"product including brand, model, material, color.{context_hint}{tone_hint}\n\n"
                        "Respond with JSON:\n"
                        "{\n"
                        '  "title": "Specific title (max 80 chars) with brand, type, key attribute",\n'
                        '  "category": "Shopify taxonomy path with \' > \' separators, 2-4 levels deep",\n'
                        '  "mainCategory": "One broad, top-level product grouping (e.g. \'Shoes\', '
                        "'Outerwear', 'Accessories', 'Electronics', 'Home Decor', 'Jewelry')\",\n"
                        '  "productType": "Short Shopify product_type label",\n'
                        '  "tags": ["5 specific tags: brand, type, material, color, use case"]\n'
                        "}"
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Classify this product image ({original_name}). JSON only.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64.b64encode(buffer).decode()}"
                            },
                        },
                    ],
                },
            ],
            max_completion_tokens=300,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or ""
        parsed = parse_json_object(content)
        if parsed:
            return {
                "title": parsed.get("title") or _strip_ext(original_name),
                "category": parsed.get("category") or "Other",
                "mainCategory": parsed.get("mainCategory") or "Uncategorized",
                "productType": parsed.get("productType") or "",
                "tags": [str(t) for t in parsed["tags"]]
                if isinstance(parsed.get("tags"), list)
                else [],
            }
        raise RuntimeError("No JSON in quick preview: " + content[:200])
    except Exception:
        logger.exception("Quick preview error")
        return _failed_preview(original_name)


async def full_analyze_image(
    buffer: bytes,
    mime_type: str,
    original_name: str,
    tone: str = "professional",
    product_context: str | None = None,
) -> ProductAnalysis:
    import base64

    max_retries = 2
    tone_guide = TONE_INSTRUCTIONS.get(tone) or TONE_INSTRUCTIONS["professional"]
    context_guide = f'\nSeller context: "{product_context}".' if product_context else ""

    for attempt in range(1, max_retries + 1):
        try:
            response = await get_openai().chat.completions.create(
                model="gpt-5.2",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            f"E-commerce product listing expert for Shopify. "
                            f"{tone_guide}{context_guide}\n\n"
                            "Identify the EXACT product: brand, model, material, color, size. "
                            "Use specific tags (never generic). Respond with JSON:\n"
                            "{\n"
                            '  "title": "Specific title (max 80 chars) with brand, type, key attribute",\n'
                            '  "description": "3-4 sentence HTML description with <p>, <ul>, <li>. '
                            'Include brand, materials, dimensions, target buyer.",\n'
                            '  "price": "Retail price string e.g. \'29.99\'",\n'
                            '  "category": "Shopify taxonomy path with \' > \' separators, 2-4 levels deep",\n'
                            '  "mainCategory": "One broad, top-level product grouping (e.g. \'Shoes\', '
                            "'Outerwear', 'Accessories', 'Electronics', 'Home Decor', 'Jewelry')\",\n"
                            '  "productType": "Short Shopify product_type label",\n'
                            '  "tags": ["8 specific tags: brand, type, material, color, use case, '
                            'audience, style, occupation"],\n'
                            '  "seoTitle": "SEO title (50-60 chars) with brand and product name",\n'
                            '  "seoDescription": "Meta description (140-160 chars) with brand, product, '
                            'benefit, CTA",\n'
                            '  "altText": "Alt text (max 125 chars) describing what\'s visible in the image",\n'
                            '  "aeoFaqs": [{"question":"...","answer":"1-2 sentence factual answer"}] '
                            "(3-5 FAQ pairs for AI answer engines),\n"
                            '  "aeoSnippet": "2-3 sentence conversational summary as if answering '
                            "'Tell me about [product]'\",\n"
                            '  "variants": VARIANT_RULES\n'
                            "}\n\n"
                            "VARIANT_RULES: Always detect the exact color(s) visible in the image. "
                            "For apparel/clothing/footwear always include both a Color option and a Size "
                            'option. Sizes default to ["S","M","L","XL"] unless the product clearly uses '
                            "a different sizing system (e.g. shoe sizes, numeric waist sizes). "
                            "Non-apparel items: only include variants that make sense (e.g. storage "
                            "capacity for electronics, material for furniture). Example for a purple "
                            't-shirt: [{"name":"Color","values":["Purple"]},{"name":"Size","values":'
                            '["S","M","L","XL"]}]. If no variants apply, use [].'
                        ),
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Analyze this product image ({original_name}). JSON only.",
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{base64.b64encode(buffer).decode()}"
                                },
                            },
                        ],
                    },
                ],
                max_completion_tokens=2000,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content or ""
            parsed = parse_json_object(content)
            if (
                parsed
                and parsed.get("title")
                and parsed.get("description")
                and len(str(parsed["description"])) > 20
            ):
                return _as_analysis(parsed, original_name)
            raise RuntimeError(
                "Incomplete AI response — missing title or description: " + content[:200]
            )
        except Exception:
            logger.exception(
                "OpenAI full analysis error (attempt %s/%s)", attempt, max_retries
            )
            if attempt >= max_retries:
                return _failed_analysis(original_name)
    return _failed_analysis(original_name)


async def full_analyze_multiple_images(
    files: list[tuple[bytes, str, str]],
    tone: str = "professional",
    product_context: str | None = None,
) -> ProductAnalysis:
    import base64

    max_retries = 2
    tone_guide = TONE_INSTRUCTIONS.get(tone) or TONE_INSTRUCTIONS["professional"]
    context_guide = f'\nSeller context: "{product_context}".' if product_context else ""
    names = ", ".join(name for _, _, name in files)

    for attempt in range(1, max_retries + 1):
        try:
            image_content = [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime};base64,{base64.b64encode(buf).decode()}"
                    },
                }
                for buf, mime, _ in files
            ]
            response = await get_openai().chat.completions.create(
                model="gpt-5.2",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            f"E-commerce product listing expert for Shopify. "
                            f"{tone_guide}{context_guide}\n\n"
                            f"You are given {len(files)} images of the SAME product. The images may be "
                            "different angles of one color, OR different color versions of the same "
                            "product (e.g. purple, black, brown). Analyze ALL images and generate ONE "
                            "unified product listing. Respond with JSON:\n"
                            "{\n"
                            '  "title": "Specific title (max 80 chars) — omit specific color, use '
                            "brand+type (e.g. 'Cotton Crew-Neck T-Shirt')\",\n"
                            '  "description": "3-4 sentence HTML description with <p>, <ul>, <li>. '
                            'Include brand, materials, dimensions, target buyer.",\n'
                            '  "price": "Retail price string e.g. \'29.99\'",\n'
                            '  "category": "Shopify taxonomy path with \' > \' separators, 2-4 levels deep",\n'
                            '  "mainCategory": "One broad, top-level product grouping (e.g. \'Shoes\', '
                            "'Outerwear', 'Accessories', 'Electronics', 'Home Decor', 'Jewelry')\",\n"
                            '  "productType": "Short Shopify product_type label",\n'
                            '  "tags": ["8 specific tags: brand, type, material, colors, use case, '
                            'audience, style, occasion"],\n'
                            '  "seoTitle": "SEO title (50-60 chars) with brand and product name",\n'
                            '  "seoDescription": "Meta description (140-160 chars) with brand, product, '
                            'benefit, CTA",\n'
                            '  "altText": "Alt text (max 125 chars) describing the product across all images",\n'
                            '  "aeoFaqs": [{"question":"...","answer":"1-2 sentence factual answer"}] '
                            "(3-5 FAQ pairs for AI answer engines),\n"
                            '  "aeoSnippet": "2-3 sentence conversational summary as if answering '
                            "'Tell me about [product]'\",\n"
                            '  "imageColors": ["color of image 0", "color of image 1", ...] — detect the '
                            'EXACT dominant color for EACH image in order (e.g. ["Purple","Black","Brown"]),\n'
                            '  "variants": VARIANT_RULES\n'
                            "}\n\n"
                            "VARIANT_RULES: For apparel/clothing/footwear always include Color AND Size "
                            "variants. Color values = deduplicated list of all colors from imageColors "
                            '(e.g. ["Purple","Black","Brown"]). Size defaults to ["S","M","L","XL"] unless '
                            "product uses a different system (shoe sizes, numeric waist, etc.). "
                            "Non-apparel: only include variants that make sense. Example: "
                            '[{"name":"Color","values":["Purple","Black","Brown"]},{"name":"Size",'
                            '"values":["S","M","L","XL"]}]. If no variants apply, use [].'
                        ),
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": (
                                    f"Analyze these {len(files)} images of the same product ({names}). "
                                    "JSON only."
                                ),
                            },
                            *image_content,
                        ],
                    },
                ],
                max_completion_tokens=2000,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content or ""
            parsed = parse_json_object(content)
            if (
                parsed
                and parsed.get("title")
                and parsed.get("description")
                and len(str(parsed["description"])) > 20
            ):
                analysis = _as_analysis(parsed, files[0][2])
                analysis["title"] = parsed["title"]
                analysis["seoTitle"] = parsed.get("seoTitle") or parsed["title"]
                if isinstance(parsed.get("imageColors"), list):
                    analysis["imageColors"] = [str(c) for c in parsed["imageColors"]]
                return analysis
            raise RuntimeError("Incomplete AI response: " + content[:200])
        except Exception:
            logger.exception(
                "Multi-image full analysis error (attempt %s/%s)", attempt, max_retries
            )
            if attempt >= max_retries:
                return _failed_analysis(files[0][2], plural=True)
    return _failed_analysis(files[0][2], plural=True)


async def quick_preview_multiple_images(
    files: list[tuple[bytes, str, str]],
    product_context: str | None = None,
    brand_tone: str | None = None,
) -> QuickPreview:
    import base64

    context_hint = (
        f'\n\nThe seller describes these products as: "{product_context}". '
        "Use this to more accurately classify the product."
        if product_context
        else ""
    )
    tone_hint = (
        f"\nBrand voice: {TONE_INSTRUCTIONS[brand_tone]}"
        if brand_tone and brand_tone in TONE_INSTRUCTIONS
        else ""
    )
    try:
        image_content = [
            {
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{base64.b64encode(buf).decode()}"},
            }
            for buf, mime, _ in files
        ]
        response = await get_openai().chat.completions.create(
            model="gpt-5.2",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Product image classifier for Shopify. You are given "
                        f"{len(files)} images of the SAME product. Identify the EXACT product "
                        "including brand, model, material, color from all images combined."
                        f"{context_hint}{tone_hint}\n\n"
                        "Respond with JSON:\n"
                        "{\n"
                        '  "title": "Specific title (max 80 chars) with brand, type, key attribute",\n'
                        '  "category": "Shopify taxonomy path with \' > \' separators, 2-4 levels deep",\n'
                        '  "mainCategory": "One broad, top-level product grouping (e.g. \'Shoes\', '
                        "'Outerwear', 'Accessories', 'Electronics', 'Home Decor', 'Jewelry')\",\n"
                        '  "productType": "Short Shopify product_type label",\n'
                        '  "tags": ["5 specific tags: brand, type, material, color, use case"]\n'
                        "}"
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Classify this product from {len(files)} images. JSON only.",
                        },
                        *image_content,
                    ],
                },
            ],
            max_completion_tokens=300,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or ""
        parsed = parse_json_object(content)
        if parsed:
            return {
                "title": parsed.get("title") or _strip_ext(files[0][2]),
                "category": parsed.get("category") or "Other",
                "mainCategory": parsed.get("mainCategory") or "Uncategorized",
                "productType": parsed.get("productType") or "",
                "tags": [str(t) for t in parsed["tags"]]
                if isinstance(parsed.get("tags"), list)
                else [],
            }
        raise RuntimeError("No JSON in multi-image quick preview")
    except Exception:
        logger.exception("Multi-image quick preview error")
        return _failed_preview(files[0][2])
