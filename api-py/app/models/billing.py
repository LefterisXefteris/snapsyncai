"""Billing tables.

`subscriptions` is the app's own record and the only subscription source the code
actually reads — the `stripe-replit-sync` mirror tables are written but never queried,
which is why that dependency is dropped rather than ported.

`user_credits` was created by boot-time DDL in `server/index.ts:155-161`, not by a
migration file.
"""

from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.base import integer, timestamp, txt


class PaidSession(SQLModel, table=True):
    __tablename__ = "paid_sessions"

    id: int | None = Field(default=None, primary_key=True)
    checkout_session_id: str = Field(sa_column=txt(nullable=False, unique=True))
    session_id: str = Field(sa_column=txt(nullable=False))
    image_count: int = Field(sa_column=integer(nullable=False))
    tone: str = Field(sa_column=txt(nullable=False, server_default="professional"))
    amount_paid: int = Field(sa_column=integer(nullable=False))
    used: int | None = Field(default=None, sa_column=integer(default=0))
    created_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))


class Subscription(SQLModel, table=True):
    __tablename__ = "subscriptions"

    id: int | None = Field(default=None, primary_key=True)
    user_id: str = Field(sa_column=txt(nullable=False, unique=True))
    stripe_customer_id: str = Field(sa_column=txt(nullable=False))
    stripe_subscription_id: str = Field(sa_column=txt(nullable=False))
    status: str = Field(sa_column=txt(nullable=False, server_default="active"))
    current_period_end: datetime | None = Field(default=None, sa_column=timestamp())
    created_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))


class UserCredits(SQLModel, table=True):
    __tablename__ = "user_credits"

    id: int | None = Field(default=None, primary_key=True)
    user_id: str = Field(sa_column=txt(nullable=False, unique=True))
    balance: int = Field(sa_column=integer(nullable=False, default=0))
    lifetime_credits: int = Field(sa_column=integer(nullable=False, default=0))
    updated_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))
