from app.services.upload_langgraph import resolve_upload_processing_mode


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
