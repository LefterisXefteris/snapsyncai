"""Inventory outbox worker — optional dedicated process.

The API already polls in-process when INVENTORY_AUTOPILOT_ENABLED is true
(Railway's single uvicorn command). Run this only as a second replica, not
beside that in-process poller unless you want two claimers (SKIP LOCKED is
safe; it is still two workers).

    uv run python -m app.workers.inventory
"""

from __future__ import annotations

import asyncio
import logging
import signal

from app.config import get_settings
from app.db import dispose_engine, get_engine
from app.services.inventory.jobs import run_inventory_worker

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


async def main() -> None:
    get_settings()
    get_engine()
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    await run_inventory_worker(stop)
    await dispose_engine()


if __name__ == "__main__":
    asyncio.run(main())
