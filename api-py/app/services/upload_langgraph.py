"""Port of `server/uploadLanggraph.ts`."""

from __future__ import annotations

from typing import Literal

UploadProcessingMode = Literal["groupedPaid", "groupedPreview", "singlePaid", "singlePreview"]

MAX_UNGROUPED_ANALYZES = 20
TOO_MANY_UNGROUPED = (
    f"Ungrouped upload is limited to {MAX_UNGROUPED_ANALYZES} images per upload."
)


def _should_group(*, file_count: int, group_as_one: bool) -> bool:
    return group_as_one and file_count > 1


def ungrouped_upload_cap_error(*, file_count: int, group_as_one: bool) -> str | None:
    """Refuse ungrouped uploads above MAX_UNGROUPED_ANALYZES vision analyzes."""
    if _should_group(file_count=file_count, group_as_one=group_as_one):
        return None
    if file_count > MAX_UNGROUPED_ANALYZES:
        return TOO_MANY_UNGROUPED
    return None


def resolve_upload_processing_mode(
    *,
    file_count: int,
    group_as_one: bool,
    has_active_subscription: bool,
) -> UploadProcessingMode:
    if file_count < 1:
        raise ValueError("No files uploaded")
    should_group = _should_group(file_count=file_count, group_as_one=group_as_one)
    if should_group and has_active_subscription:
        return "groupedPaid"
    if should_group and not has_active_subscription:
        return "groupedPreview"
    if not should_group and has_active_subscription:
        return "singlePaid"
    return "singlePreview"
