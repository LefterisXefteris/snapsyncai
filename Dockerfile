# syntax=docker/dockerfile:1
# Railway default context is the repository root. The API lives in api-py/.
# If the service Root Directory is already `api-py`, use api-py/Dockerfile instead.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /srv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1

# Dependencies resolve from the lockfile alone, so this layer only rebuilds when
# pyproject.toml or uv.lock change — not on every source edit.
COPY api-py/pyproject.toml api-py/uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY api-py/app ./app
COPY api-py/alembic.ini ./
COPY api-py/alembic ./alembic

RUN uv sync --frozen --no-dev

ENV PATH="/srv/.venv/bin:$PATH"

EXPOSE 8000

# sh -c keeps ${PORT:-8000} for Railway; exec makes uvicorn PID 1 so SIGTERM lands.
# Migrate before serve so a new SQLModel column cannot ship without its Alembic revision.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:create_app --factory --host 0.0.0.0 --port ${PORT:-8000}"]
