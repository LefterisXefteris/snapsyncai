"""SQLModel tables for the core loop.

Importing this package registers every table on `SQLModel.metadata`, which is what
`alembic/env.py` targets. Any new model must be re-exported here or Alembic will not see
it and will propose dropping the table.
"""

from app.models.billing import AllowanceSpend, PaidSession, Subscription, UserCredits
from app.models.connections import ShopifyConnection
from app.models.conversation import ShopConversation
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
from app.models.website import PublishedWebsite, WebsitePrototypeRecord

__all__ = [
    "AllowanceSpend",
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
    "PublishedWebsite",
    "WebsitePrototypeRecord",
    "ShopConversation",
    "ShopifyConnection",
    "Subscription",
    "UserCredits",
]
