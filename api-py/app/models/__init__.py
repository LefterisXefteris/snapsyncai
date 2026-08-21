"""SQLModel tables for the core loop.

Importing this package registers every table on `SQLModel.metadata`, which is what
`alembic/env.py` targets. Any new model must be re-exported here or Alembic will not see
it and will propose dropping the table.
"""

from app.models.billing import PaidSession, Subscription, UserCredits
from app.models.connections import ShopifyConnection
from app.models.image import Image
from app.models.inventory import (
    InventoryBundleComponent,
    InventoryChannelLink,
    InventoryImportJob,
    InventoryItem,
    InventoryLedgerEntry,
    InventoryNotification,
    InventoryOutboxJob,
    InventorySettings,
    InventoryWebhookEvent,
)

__all__ = [
    "Image",
    "InventoryBundleComponent",
    "InventoryChannelLink",
    "InventoryImportJob",
    "InventoryItem",
    "InventoryLedgerEntry",
    "InventoryNotification",
    "InventoryOutboxJob",
    "InventorySettings",
    "InventoryWebhookEvent",
    "PaidSession",
    "ShopifyConnection",
    "Subscription",
    "UserCredits",
]
