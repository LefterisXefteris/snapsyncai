"""Clerk authentication — the Python port of `server/routes.ts:43-72`.

The SPA sends the Clerk `__session` **cookie**, not a bearer token; there is no
`getToken()` call anywhere in `client/src`. Because the Vercel rewrite keeps the API
same-origin, that cookie reaches this service unchanged, and `authenticate_request`
reads it straight off the `Cookie` header. Bearer tokens also work, so a future switch
needs no change here.

The resolved Clerk user id doubles as the row-level tenancy key — `images.session_id`
and `inventory_*.user_id`. Getting this wrong leaks data across accounts, so
`current_user_id` never returns a fallback: it either resolves a real user or raises 401.
"""

import logging
from functools import lru_cache
from typing import Annotated

from clerk_backend_api import AuthenticateRequestOptions, Clerk
from fastapi import Depends, HTTPException, Request, status

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

# Matches DEV_USER_ID in server/routes.ts:44 so local rows stay compatible between
# the two backends during the migration.
DEV_USER_ID = "dev_local_user"


@lru_cache
def _client(secret_key: str) -> Clerk:
    return Clerk(bearer_auth=secret_key)


class _Requestish:
    """Adapter for Clerk's `Requestish` protocol, which only needs `.headers`."""

    def __init__(self, headers) -> None:
        self.headers = headers


async def authenticate(request: Request, settings: Settings) -> str | None:
    """Return the Clerk user id, or None when the request is not signed in."""
    secret_key = settings.clerk_secret_key
    if not secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CLERK_SECRET_KEY is not configured on the API service",
        )

    state = await _client(secret_key).authenticate_request_async(
        _Requestish(request.headers),
        AuthenticateRequestOptions(
            authorized_parties=settings.clerk_authorized_parties or None
        ),
    )

    if not state.is_signed_in:
        # `reason` distinguishes "no cookie" from "expired" from "wrong party" — worth
        # logging, never worth returning to the caller.
        logger.info("clerk: request not signed in (%s)", state.reason)
        return None

    user_id = (state.payload or {}).get("sub")
    if not user_id:
        logger.warning("clerk: signed-in state carried no `sub` claim")
        return None
    return str(user_id)


async def current_user_id(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> str:
    """Require an authenticated user. Raises 401 otherwise.

    `DEV_BYPASS_AUTH` short-circuits to a fixed user, mirroring `requireAuth()` in
    `server/routes.ts:63`. Guarded against production so a stray env var cannot disable
    auth on a live deployment — the Express version has no such guard.
    """
    if settings.dev_bypass_auth:
        if settings.is_production:
            raise RuntimeError(
                "DEV_BYPASS_AUTH is set in production — refusing to serve unauthenticated "
                "requests. Unset it immediately."
            )
        return DEV_USER_ID

    user_id = await authenticate(request, settings)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthenticated",
        )
    return user_id


CurrentUser = Annotated[str, Depends(current_user_id)]
