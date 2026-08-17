#!/usr/bin/env bash
#
# Start the local stack: Postgres, FastAPI, and Vite.
#
#   postgres   docker, host port 5433
#   api        FastAPI                                    http://localhost:8000
#   web        Vite SPA; every /api request proxied to FastAPI
#                                                         http://localhost:5001
#
# Express is not started. Production /api is FastAPI on Railway.
#
# Ctrl-C stops the servers. Postgres is left running (it holds your data); stop it
# with `docker compose down`.
#
# Deliberately no `concurrently` dependency — plain background jobs and a trap.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; DIM=$'\033[2m'; OFF=$'\033[0m'

info()  { printf '%s==>%s %s\n' "$GREEN" "$OFF" "$1"; }
warn()  { printf '%s==>%s %s\n' "$YELLOW" "$OFF" "$1"; }
fatal() { printf '%serror:%s %s\n' "$RED" "$OFF" "$1" >&2; exit 1; }

prefix() { awk -v tag="$1" '{ printf "%s %s\n", tag, $0; fflush() }'; }

# ── Preflight ───────────────────────────────────────────────────────────────

[ -f .env.local ] || {
  [ -f .env.example ] || fatal "no .env.local and no .env.example to copy from"
  warn "no .env.local — creating one from .env.example"
  cp .env.example .env.local
}

# Export root env so the FastAPI service (which resolves its own .env relative to
# api-py/) sees the same DATABASE_URL as the rest of the stack.
set -a
# shellcheck disable=SC1091
. ./.env.local
set +a

[ -n "${DATABASE_URL:-}" ] || fatal "DATABASE_URL is unset in .env.local"

command -v uv >/dev/null || fatal "uv not found — https://docs.astral.sh/uv/"
[ -d node_modules ] || { info "installing node dependencies"; npm install; }

# ── Postgres ────────────────────────────────────────────────────────────────

SKIP_DB="${SKIP_DB:-0}"
if [ "$SKIP_DB" != "1" ]; then
  if ! docker info >/dev/null 2>&1; then
    fatal "Docker is not running. Start Docker Desktop, or re-run with SKIP_DB=1
       to use an external database (the UI also loads with no database at all —
       only /api/* routes will 500)."
  fi

  info "starting postgres"
  docker compose up -d postgres >/dev/null

  printf '%s' "${DIM}waiting for postgres${OFF}"
  for _ in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U snapsync -d snapsync >/dev/null 2>&1; then
      printf '\r%s\r' "                          "
      info "postgres ready on 5433"
      break
    fi
    printf '.'; sleep 1
  done

  docker compose exec -T postgres pg_isready -U snapsync -d snapsync >/dev/null 2>&1 \
    || fatal "postgres did not become ready in 30s — check: docker compose logs postgres"

  info "applying migrations (alembic)"
  (cd api-py && uv run alembic upgrade head 2>&1 | prefix "${DIM}[alembic]${OFF}")
else
  warn "SKIP_DB=1 — not starting or migrating postgres"
fi

# ── Servers ─────────────────────────────────────────────────────────────────

pids=()
cleanup() {
  trap - INT TERM EXIT
  printf '\n'; info "shutting down"
  for pid in "${pids[@]:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done
  pkill -f "vite --config" 2>/dev/null || true
  pkill -f "uvicorn app.main:create_app" 2>/dev/null || true
  wait 2>/dev/null || true
  printf '%s(postgres left running — `docker compose down` to stop it)%s\n' "$DIM" "$OFF"
}
trap cleanup INT TERM EXIT

info "starting api      → http://localhost:8000  (docs at /docs)"
(cd "$ROOT/api-py" && uv run uvicorn app.main:create_app --factory \
    --host 127.0.0.1 --port 8000 --reload 2>&1 | prefix "${YELLOW}[api]${OFF}") &
pids+=($!)

info "starting web      → http://localhost:${PORT:-5001}"
(cd "$ROOT" && npx vite --config vite.config.ts 2>&1 | prefix "${GREEN}[web]${OFF}") &
pids+=($!)

printf '\n%sservers starting — Vite takes ~15s on a cold start. Ctrl-C to stop.%s\n\n' \
  "$DIM" "$OFF"

wait
