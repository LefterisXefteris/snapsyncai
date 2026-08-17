# FastAPI on Railway via api.snapsyncai.co.uk

Production API traffic will terminate at FastAPI on Railway, reached as `https://api.snapsyncai.co.uk`. The SPA stays on Vercel (`www`). We are not using Vercel rewrites to an API host, and we are not using Fly.

Vercel’s reverse proxy may buffer SSE (`generate-content`, `regenerate-field`) and still cap upload bodies. A subdomain avoids that path entirely. It costs CORS plus a client API base URL, which FastAPI already supports. Railway is the long-running process host (no serverless cold start); Fly was the previous candidate and is not the target.

Express remains the production `/api` handler on Vercel until Railway is live and DNS/webhooks/OAuth point at `api.`. Then Express is deleted. Locally, Vite proxies all `/api` to FastAPI and Express is not run.

**Considered:** Vercel rewrite → Fly (same-origin, unknown SSE/upload behaviour); FastAPI on Vercel Python serverless (cold starts, the reason we left Express-on-Vercel); SPA+API both on Railway (unneeded SPA move).
