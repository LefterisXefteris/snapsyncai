"""SQLModel tables — the Python port of `shared/schema.ts`.

Importing this package registers every table on `SQLModel.metadata`, which is what
`alembic/env.py` targets. Any new model must be re-exported here or Alembic will not see
it and will propose dropping the table.
"""

from app.models.billing import PaidSession, Subscription, UserCredits
from app.models.connections import ShopifyConnection
from app.models.image import Image

__all__ = [
    "Image",
    "PaidSession",
    "ShopifyConnection",
    "Subscription",
    "UserCredits",
]
