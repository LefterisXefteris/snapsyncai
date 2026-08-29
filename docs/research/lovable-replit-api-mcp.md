# Lovable / Replit: API & MCP consumption

**Researched:** 2026-08-29  
**Question:** Can SnapSyncAI expose a REST API or MCP server that Lovable and/or Replit consume, and is a commercial partnership required?  
**Confidence:** HIGH on self-serve HTTP/MCP paths (first-party docs). MEDIUM on catalog/featured listing (partner pages exist; no public “submit an API” SLA).  
**Sources:** Lovable docs + ToS; Replit docs + ToS + partners page; MCP spec, Anthropic announcement, official registry docs.

## Bottom line

**No partnership is required** for a Lovable- or Replit-generated app (or those agents) to call SnapSync’s public FastAPI at `api.snapsyncai.co.uk`. Both platforms document “any API” / custom MCP as self-serve. A deal is for **distribution** (featured catalog, co-marketing, trademarks), not for HTTP clients.

Two different jobs:

| Job | What SnapSync ships | Who consumes it |
| --- | --- | --- |
| **(a) Agents operate SnapSync** | Remote MCP (+ same REST behind it) | Cursor, Claude Desktop, Replit Agent, Lovable *chat* |
| **(b) Apps built *on* Lovable/Replit** | REST/OpenAPI + keys/OAuth | Generated/hosted frontends and their edge/backends |

## 1. Lovable

**Public API to drive Lovable:** “Lovable API” today is [Build with URL](https://docs.lovable.dev/integrations/lovable-api) (shareable `#prompt=` links) plus an MCP server at `https://mcp.lovable.dev` ([docs](https://docs.lovable.dev/integrations/lovable-mcp-server.md), [product](https://lovable.dev/mcp)). Not a general REST/OpenAPI for third-party products.

**Plugin marketplace:** None found. Integrations are a first-party [Connectors catalog](https://docs.lovable.dev/integrations/introduction). Workspace admins can add a [custom REST connector](https://docs.lovable.dev/integrations/create-connector) — **scoped to that workspace**, not a global listing. Rollout is gradual.

**How a Lovable *app* calls SnapSync:** [Integrate any API](https://docs.lovable.dev/integrations/any-api) — describe endpoints, auth, and an OpenAPI/docs link; Lovable writes the integration. Unauthenticated APIs are called from the app; authenticated ones use Cloud secrets + Edge Functions. FAQ: “Yes. Lovable can integrate with any external API, public or private.”

**How Lovable’s *agent* calls SnapSync:** [Custom MCP as a chat connector](https://docs.lovable.dev/integrations/custom-mcp) (all plans; URL + OAuth/bearer/none). **Chat-only — not in the published app.** For runtime, use any-API or a workspace custom connector. [Chat connectors](https://docs.lovable.dev/integrations/chat-connectors) are MCP-based.

**Knowledge:** [Workspace/project knowledge](https://docs.lovable.dev/features/knowledge) (10k chars) is user-owned instructions, not a third-party knowledge product. Custom connectors can attach [agent knowledge files](https://docs.lovable.dev/integrations/create-connector) (how to call *that* API).

**Partner programs:** [Solution Partner](https://lovable.dev/partners/solution) ([terms](https://lovable.dev/solution-partner-program-terms)) is for agencies that implement Lovable, not API vendors. [Partners hub](https://lovable.dev/partners/integration) lists Solution / Government / Non-profit / Affiliate / creators — **no public “API/integration partner” application**. [Integration security](https://docs.lovable.dev/integrations/security) mentions “Partners and enterprise customers” only for **IP allowlisting** of gateway egress (`185.41.150.0/25`).

**ToS (2026-08-28):** [lovable.dev/terms](https://lovable.dev/terms) licenses the Services for personal/internal business, including creating and operating apps you build. Restrictions: no resale/service-bureau of *Lovable*; no trademark use implying affiliation; no using Services/AI Output/prompts to train **competing AI models**. **No clause found** that blocks a generated app from calling a third-party API, or that requires a deal to be that API. Reverse-engineering Lovable and scraping without written permission are banned.

**MCP in Lovable (three directions):** chat connectors (Lovable → your tools); [Lovable MCP](https://lovable.dev/mcp) (Cursor/Claude → Lovable); [publish app as MCP](https://docs.lovable.dev/features/agent-integrations) (assistants → *your Lovable app*). SnapSync path for (a) is custom MCP; for (b) is REST.

## 2. Replit

**Platform API for third parties:** No general public REST/GraphQL for managing Replit as an outsider. Official surfaces: [Enterprise Admin API](https://docs.replit.com/teams/admin-api) (beta; Enterprise admins; [api.replit.com/docs](https://api.replit.com/docs)); [Replit MCP Server](https://docs.replit.com/platforms/mcp-server) (`https://replit-mcp.com/server/mcp`) so *other* agents drive Replit. Usage docs mention rate limits on “Replit’s **internal** GraphQL API” ([quotas](https://docs.replit.com/legal-and-security-info/usage)) — not a documented third-party API. Community GraphQL clients are unofficial.

**Agent MCP:** [Connect via MCP](https://docs.replit.com/build/connect-via-mcp) — Agent consumes pre-listed servers **or any custom HTTPS MCP** (headers / OAuth). Tools apply across projects. [MCP list](https://docs.replit.com/features/mcp/overview): one-click catalog plus `https://replit.com/integrations?mcp=` install links you can publish yourself.

**Connectors:** [First-party only](https://docs.replit.com/features/integrations/overview) (Google, Slack, Stripe, …). “External integrations” = Agent writes code and you paste **API keys into Secrets**. [Skills directory](https://docs.replit.com/features/agent/skills-directory) includes partner-authored skills (Stripe, PayPal, …) — that is a partner catalog, not required to call an API.

**Partner program:** [replit.com/partners](https://replit.com/partners) — **Integration Partners** (“integrations and plugins that extend Replit’s AI platform”), plus Solution / Government / Education. Apply; free to join; integration partners get sandbox, “full API documentation,” and a technical contact. **Required to be a featured connector/skill — not required for apps to `fetch` SnapSync or for users to add a custom MCP.**

**ToS (2026-08-03):** [replit.com/terms-of-service](https://replit.com/terms-of-service) — third-party services/integrations “at your own risk”; no Replit trademark/trade dress without **prior written consent**; quotas (incl. concurrent **outgoing** connections). **No ban found** on hosted apps calling external HTTP APIs. Scraping/reverse-engineering *the Service* is prohibited.

**How a Replit app calls FastAPI:** Store keys in [Secrets](https://docs.replit.com/core-concepts/project-editor/app-setup/secrets) (`process.env` / `os.getenv`); **re-set production secrets in Publishing** ([troubleshooting](https://docs.replit.com/build/troubleshooting)). Agent’s *edit* sandbox has restricted outbound; **the running/published app may call external APIs** ([Agent FAQ](https://docs.replit.com/help/agent-and-ai)). [CORS](https://docs.replit.com/help/networking-and-app-errors): browser origin ≠ API origin → SnapSync must allow the Replit/custom origin, **or** the Replit backend proxies (same-origin `/api/...`). Prefer server-side `fetch` so keys never hit the browser.

## 3. MCP (protocol)

MCP is an **open** JSON-RPC protocol (hosts / clients / servers; tools, resources, prompts). Spec: [2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25). Announced and open-sourced by Anthropic ([25 Nov 2024](https://www.anthropic.com/news/model-context-protocol)). Build: [official tutorial](https://modelcontextprotocol.io/docs/develop/build-server) (stdio or HTTP). Optional listing: [Official MCP Registry](https://modelcontextprotocol.io/registry/quickstart) (`mcp-publisher`; GitHub or domain auth) — preview, not a commercial license.

**No host-platform contract is required to speak MCP.** Cursor, Claude Desktop, Replit, and Lovable all accept user-added servers. **Curated one-click catalogs and partner-skill directories are optional distribution.**

**(a)** SnapSync MCP → coding/build agents operate inventory/listings. **(b)** Someone *builds a storefront on Lovable/Replit* that calls SnapSync REST at runtime. (a) ≠ (b); MCP chat connectors on Lovable do **not** replace (b).

## 4. Partnership vs exposing an API

| Path | Agreement? | Evidence |
| --- | --- | --- |
| Public REST/OpenAPI + API keys/OAuth; clients `fetch` | **No** | Lovable any-API; Replit external integrations + Secrets |
| User adds custom MCP URL | **No** | Lovable custom MCP; Replit “add any custom MCP” + install links |
| Official connector / partner skill / featured MCP | **Yes / apply** | Replit Integration Partners; Lovable catalog is first-party (custom = workspace-only) |
| Using *their* name/logo in marketing | **Yes** | Lovable ToS trademarks; Replit ToS written consent |
| Calling unpublished/internal platform APIs | **Don’t** | Replit “internal GraphQL”; Lovable license restrictions |
| Solution/affiliate partner (sell *their* product) | Separate programs | Lovable Solution Partner; Replit Solution track |

OAuth *app listing on their catalog*, marketplace placement, embedding a first-party SDK, and “technology partner” badges are the usual triggers. A documented public API that anyone’s generated code can call is not.

## 5. Recommendation (small product)

1. **Ship OpenAPI + seller-scoped API keys (or OAuth)** on the existing FastAPI. Publish a one-page “connect from Lovable/Replit” prompt: base URL, auth header, example `GET`/`POST`, CORS origins (`*.lovable.app`, `*.replit.app`, plus custom domains). Fastest path; no BD.
2. **Optional MCP adapter** on the same API (remote HTTPS + bearer/OAuth) for Cursor / Claude Desktop / Replit Agent / Lovable chat. Share a Replit install-link; do not wait for catalog inclusion.
3. **Talk to BD only if** you want a featured Lovable connector, a Replit first-party Connector / partner Skill, co-marketing, or to use their marks. Until then, custom connector (Lovable workspace) and custom MCP (both) are enough.

## Unknowns

- How a vendor gets onto Lovable’s *global* connector catalog (no public submit form found).  
- Full Integration Partner contract terms (Replit FAQ only).  
- Whether Replit’s “full API documentation” for partners is anything beyond Admin API + MCP.  
- Exact CORS allowlists SnapSync should ship (depends on customer custom domains).
