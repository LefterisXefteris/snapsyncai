"""Application settings.

Replaces the ad-hoc `process.env.X` reads scattered across `server/`, which had no
validation anywhere. `DATABASE_URL` is required at boot; everything else stays
optional and is resolved lazily via the `require_*` helpers, mirroring
`server/supabaseClient.ts` — a missing integration key should fail loudly at the
call site, not take the whole process down on startup.
"""

import json
from functools import lru_cache
from typing import Annotated, Literal

from fastapi import Depends
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Core ---------------------------------------------------------------
    database_url: str
    database_pool_max: int = 10
    # Optional. Unset or a down Redis: GET /api/images reads Postgres only.
    redis_url: str | None = None
    environment: Literal["development", "production", "test"] = "development"
    port: int = 8000
    app_base_url: str = "http://localhost:5001"
    sentry_dsn: str | None = None

    # --- Auth ---------------------------------------------------------------
    clerk_secret_key: str | None = None
    clerk_publishable_key: str | None = None
    dev_bypass_auth: bool = False

    # --- Storage ------------------------------------------------------------
    supabase_url: str | None = None
    supabase_anon_key: str | None = None

    # --- Billing ------------------------------------------------------------
    stripe_secret_key: str | None = None
    stripe_publishable_key: str | None = None
    stripe_webhook_secret: str | None = None

    # --- AI -----------------------------------------------------------------
    ai_integrations_openai_api_key: str | None = None
    ai_integrations_openai_base_url: str | None = None

    # --- Shopify ------------------------------------------------------------
    shopify_api_key: str | None = None
    shopify_api_secret: str | None = None
    # Legacy aliases still set on older deployments (see README).
    shopify_client_id: str | None = None
    shopify_client_secret: str | None = None
    shopify_scopes: str = (
        "read_products,write_products,read_inventory,write_inventory,read_locations"
    )
    connection_encryption_key: str | None = None

    # --- Inventory Autopilot ------------------------------------------------
    inventory_autopilot_enabled: bool = False
    cron_secret: str | None = None
    resend_api_key: str | None = None
    inventory_alert_from_email: str | None = None

    # Browser origins allowed to call this API with credentials (api. subdomain).
    # Comma-separated or JSON list. Empty means CORS middleware is not mounted
    # (same-origin Vite proxy / current production Express).
    cors_allow_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def parse_cors_allow_origins(cls, value: object) -> object:
        if value is None or value == "":
            return []
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                parsed = json.loads(stripped)
                if not isinstance(parsed, list):
                    raise ValueError("CORS_ALLOW_ORIGINS JSON must be a list of origins")
                return parsed
            return [part.strip() for part in stripped.split(",") if part.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def clerk_authorized_parties(self) -> list[str]:
        """Origins Clerk will accept as the token's `azp` claim.

        Production canonicalises on **www** — `https://snapsyncai.co.uk` 307-redirects to
        `https://www.snapsyncai.co.uk` — but the README documents `APP_BASE_URL` without
        the `www`. Since `azp` carries whichever origin the browser was actually on, a
        single-value list built from a mismatched `APP_BASE_URL` would reject every
        request with a 401. Both spellings are always accepted.
        """
        if not self.app_base_url:
            return []

        base = self.app_base_url.rstrip("/")
        parties = {base}
        if "://www." in base:
            parties.add(base.replace("://www.", "://", 1))
        else:
            scheme, _, host = base.partition("://")
            if scheme and host:
                parties.add(f"{scheme}://www.{host}")
        return sorted(parties)

    @property
    def shopify_client_id_resolved(self) -> str | None:
        """`SHOPIFY_API_KEY` wins, `SHOPIFY_CLIENT_ID` is the legacy fallback."""
        return self.shopify_api_key or self.shopify_client_id

    @property
    def shopify_client_secret_resolved(self) -> str | None:
        return self.shopify_api_secret or self.shopify_client_secret

    def require(self, name: str) -> str:
        """Fetch a setting that an integration genuinely cannot run without."""
        value = getattr(self, name, None)
        if not value:
            raise RuntimeError(
                f"{name.upper()} is not set. Add it to the API service environment."
            )
        return str(value)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


SettingsDep = Annotated[Settings, Depends(get_settings)]
