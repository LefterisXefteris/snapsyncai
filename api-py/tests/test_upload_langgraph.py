"""Upload processing mode and ungrouped vision-analyze cap.

Seam: `app.services.upload_langgraph`.
"""

from app.services.upload_langgraph import (
    TOO_MANY_UNGROUPED,
    resolve_upload_processing_mode,
    ungrouped_upload_cap_error,
)


def test_resolve_upload_processing_mode() -> None:
    assert (
        resolve_upload_processing_mode(
            file_count=3, group_as_one=True, has_active_subscription=True
        )
        == "groupedPaid"
    )
    assert (
        resolve_upload_processing_mode(
            file_count=3, group_as_one=True, has_active_subscription=False
        )
        == "groupedPreview"
    )
    assert (
        resolve_upload_processing_mode(
            file_count=1, group_as_one=True, has_active_subscription=True
        )
        == "singlePaid"
    )
    assert (
        resolve_upload_processing_mode(
            file_count=2, group_as_one=False, has_active_subscription=False
        )
        == "singlePreview"
    )


def test_ungrouped_upload_with_21_files_is_refused() -> None:
    assert (
        ungrouped_upload_cap_error(file_count=21, group_as_one=False)
        == TOO_MANY_UNGROUPED
    )
    assert TOO_MANY_UNGROUPED == "Ungrouped upload is limited to 20 images per upload."


def test_ungrouped_upload_with_20_files_is_allowed() -> None:
    assert ungrouped_upload_cap_error(file_count=20, group_as_one=False) is None


def test_grouped_as_one_above_20_is_not_capped_by_ungrouped_limit() -> None:
    assert ungrouped_upload_cap_error(file_count=21, group_as_one=True) is None
    assert ungrouped_upload_cap_error(file_count=200, group_as_one=True) is None
