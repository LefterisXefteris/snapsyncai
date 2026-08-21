"""Inventory HTTP errors — `{message}` body matching Express `inventoryRoutes.ts`."""


class InventoryError(Exception):
    def __init__(
        self,
        message: str,
        status: int = 400,
        *,
        retry_after_seconds: int | None = None,
        compare_mismatch: bool = False,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.retry_after_seconds = retry_after_seconds
        self.compare_mismatch = compare_mismatch
