"""Port of `server/uploadLanggraph.ts`."""

from __future__ import annotations

from typing import Literal

UploadProcessingMode = Literal["groupedPaid", "groupedPreview", "singlePaid", "singlePreview"]


def resolve_upload_processing_mode(
    *,
    file_count: int,
    group_as_one: bool,
    has_active_subscription: bool,
) -> UploadProcessingMode:
    if file_count < 1:
        raise ValueError("No files uploaded")
    should_group = group_as_one and file_count > 1
    if should_group and has_active_subscription:
        return "groupedPaid"
    if should_group and not has_active_subscription:
        return "groupedPreview"
    if not should_group and has_active_subscription:
        return "singlePaid"
    return "singlePreview"
