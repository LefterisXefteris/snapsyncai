#!/usr/bin/env python3
"""Write a Railway demo env with only DB + Redis + the running API.

No Clerk, Stripe, OpenAI, or .env.local secrets. DATABASE_URL and REDIS_URL
are Railway reference variables — paste into Variables → RAW Editor after
adding the Postgres and Redis plugins.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DST = ROOT / ".env.railway.demo"

CONTENTS = """\
# Railway demo: Postgres + Redis + the existing FastAPI service.
# No Clerk, Stripe, or VITE_* keys.
#
# Before pasting: Railway → + New → Database → PostgreSQL, then Redis.
# If a plugin is not named Postgres or Redis, change the ${{Service.VAR}} name
# to match the service name on the canvas (case-sensitive).
ENVIRONMENT=development
DEV_BYPASS_AUTH=true
APP_BASE_URL=https://snapsyncai-production.up.railway.app
CORS_ALLOW_ORIGINS=https://snapsyncai-production.up.railway.app,http://localhost:5001
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
"""


def main() -> None:
    DST.write_text(CONTENTS)
    print(f"wrote {DST.name}")
    print("keys: ENVIRONMENT, DEV_BYPASS_AUTH, APP_BASE_URL, CORS_ALLOW_ORIGINS, DATABASE_URL, REDIS_URL")


if __name__ == "__main__":
    main()
