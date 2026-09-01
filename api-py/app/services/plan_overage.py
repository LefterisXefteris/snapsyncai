"""Overage reporting. Stripe is injected; a failed report must not undo a spend."""

from __future__ import annotations

import logging
from collections.abc import Callable

logger = logging.getLogger(__name__)


def persist_spend_then_report(
    *,
    records_spend: bool,
    as_overage: bool,
    record: Callable[..., None],
    report: Callable[[], None],
) -> bool:
    if not records_spend:
        return True
    record(as_overage=as_overage)
    if not as_overage:
        return True
    try:
        report()
        return True
    except Exception:
        logger.exception("Overage report failed; spend already recorded")
        return False
