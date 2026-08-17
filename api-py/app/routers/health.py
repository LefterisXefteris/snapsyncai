"""Liveness and readiness.

`/api/health/db` doubles as the container host's readiness probe — it is the cheapest
way to catch the Supabase pooler credential problems that `app/db.py` guards against.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.schemas.base import CamelModel

router = APIRouter(prefix="/api/health", tags=["health"])


class HealthResponse(CamelModel):
    status: str
    service: str = "snapsyncai-api"


class DbHealthResponse(CamelModel):
    status: str
    database_ok: bool


@router.get("", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get("/db", response_model=DbHealthResponse)
async def health_db(session: AsyncSession = Depends(get_session)) -> DbHealthResponse:
    await session.execute(text("SELECT 1"))
    return DbHealthResponse(status="ok", database_ok=True)
