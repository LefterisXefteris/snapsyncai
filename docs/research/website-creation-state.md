# Website creation state

**Researched:** 2026-10-05  
**Question:** What is a Website in this product, and why does a browser refresh make the seller’s website work disappear?  
**Confidence:** HIGH. The wipe is in the page that owns the prototype. The published storefront is a different record and a different host.  
**Sources:** `CONTEXT.md`; ADR 0010 and ADR 0034 (plus the older ADRs that still say Lovable); `client/src/pages/Website.tsx`; `client/src/hooks/use-website.ts`; `client/src/lib/queryClient.ts`; `api-py/app/routers/website.py`; `api-py/app/services/website_handoff.py`; `api-py/app/models/website.py`; the `websites` migration; conversation router and service; the tests named in the last section.

## Bottom line

A refresh of `/website` drops the Website prototype. Palette, type, picked products, the preview, and the “Shoppers open …” line live in React `useState` on `WebsitePage`. Nothing writes that draft to `localStorage`, `sessionStorage`, the URL, or a database. `POST /api/website/preview` returns a storefront and stores nothing. The only row that survives is a **Publish** in the `websites` table, and the Website page never reads that row back. After refresh the product list can return, the palette and type are unselected, Preview and Publish are disabled, and the preview is gone. That is the unsaved, stuck page.

## What “website” means

**Current language (glossary and the ADR that owns it).** A **Website** is the seller’s own storefront for one Shopify shop, hosted by SnapSync at that shop’s address. It is not the workspace and not a Channel. Words and photos are whatever the last **Publish** froze. Price and checkout stay on the Channel (`CONTEXT.md` lines 151–153). A **Website prototype** is the palette, type, and products the seller picks before a Publish. It is not the live storefront. Voice is those products’ listing copy, not a separate tone field (`CONTEXT.md` lines 155–157). **Publish** puts that Website on its SnapSync address. The first one that lands spends one Allowance use. A later one does not. Taking the site down keeps the address. Publish is not a Push and not Go live (`CONTEXT.md` lines 159–161). Without a Plan the seller does not get website (`CONTEXT.md` lines 163–165). One Allowance use is one website, spent when the first Publish lands (`CONTEXT.md` lines 167–169).

ADR 0034 is the decision that matches that glossary. SnapSync hosts the Website at `{handle}.sites.snapsyncai.co.uk`, from the shop’s myshopify handle. The seller Publishes from a prototype: palette Ground, Ink, or Clay; type sans or a serif for the hero and product titles; products already pushed with listing copy. Preview does not spend. A refused Publish does not spend. The conversation can open the job. Publish stays with the seller (`docs/adr/0034-website-is-hosted-by-snapsync.md` line 5).

**Superseded language.** ADR 0010 said the website was built outside SnapSync and handed to Lovable. That file is marked superseded by 0034 (`docs/adr/0010-website-is-a-lovable-snapshot-handoff.md` lines 3–5). The running code follows 0034 and `CONTEXT.md`: there is no Lovable call in `website_handoff.py`. Older decisions still say Lovable or “handoff”: ADR 0025 line 3, ADR 0026 line 3, ADR 0030 line 3, ADR 0031 line 3. Those disagree with the glossary and with the code. Seller-facing copy still says “website handoffs” in Settings (`client/src/pages/Settings.tsx` line 269) and in the landing FAQ (`client/src/lib/landing-copy.ts` line 126). `CONTEXT.md` line 161 says to avoid “handoff” for Publish.

**Nav and page copy.** The sidebar item is labeled Website and goes to `/website`. It is not a stub (`client/src/lib/workspace-nav.ts` lines 38–42; `tests/workspace-nav.test.ts` lines 45–49). The icon is a globe (`client/src/components/app-sidebar.tsx` line 46). The page heading is “Website” (`client/src/pages/Website.tsx` line 78). Palette labels are Ground, Ink, Clay. Type labels are Sans and Serif titles (`client/src/lib/website-copy.ts` lines 1–10). Empty copy: connect Shopify before building; push products with listing copy, then pick them; the preview is not the site shoppers open (`client/src/lib/website-copy.ts` lines 12–18). Landing copy: pick the products and the look; the storefront is built from their listing copy; checkout stays on Shopify (`client/src/lib/landing-copy.ts` lines 58–60). The Plan gate string is “build a website” (`api-py/app/services/plan.py` lines 19–21; `client/src/lib/product-editor-copy.ts` line 25).

**Code vs ADR 0034 on the shopper page.** ADR 0034 says the storefront shows price, compare-at, and Buy from the shop, with a variant, a quantity, and a cart the site holds, and that taking the site down keeps the address (line 5). `StorefrontView` renders shop name, photos, description, tags, AEO, fibre, care, and GPSR. It has no price, Buy, cart, or variant (`client/src/components/storefront-view.tsx` lines 107–188). No router deletes or hides a `websites` row. Refresh does not take a published site down. The missing Buy control can make the storefront feel unfinished. It is not what a refresh deletes.

## Seller-visible path

**`/website`.** Signed-in route `path="/website"` mounts `WebsitePage` (`client/src/App.tsx` lines 32 and 85). The page loads the prototype, then the seller picks a palette, a type, and products, then Preview or Publish (`client/src/pages/Website.tsx` lines 20–36 and 80–101).

**Conversation.** The one conversation can start a website prototype. Confirming facts, accepting listing copy, going live, and Publish stay with the seller (`CONTEXT.md` lines 15–17; ADR 0025 line 3, except that ADR still names Lovable). Starting the job calls `read_website`, which lists eligible product ids. It does not publish (`api-py/app/services/conversation.py` lines 183–185; `api-py/app/services/conversation_jobs.py` lines 142–149). Accept, and a handoff act, both reply “Publish stays on the Website page: /website” and do not call a job (`api-py/app/services/conversation.py` lines 23 and 251–254). The conversation page shows that sentence as a link to `/website` with no product ids, palette, or type in the URL (`client/src/pages/Conversation.tsx` lines 170–177). The composer placeholder mentions a website (line 230). Silence can stop the conversation offering or starting a website prototype. The Website page stays (`CONTEXT.md` lines 19–21; ADR 0028 line 3). The silence checkbox is labeled Website (`client/src/pages/Conversation.tsx` lines 184–189).

**Public storefront.** A host ending in `.sites.snapsyncai.co.uk` is not the workspace. `App` renders `PublicStorefront` and skips the signed-in shell (`client/src/lib/storefront-host.ts` lines 1–9; `client/src/App.tsx` lines 271–276). That page loads `GET /api/storefronts/:handle` with credentials omitted (`client/src/pages/PublicStorefront.tsx` lines 7–17; `client/src/lib/api-routes.ts` lines 52–54).

There is no other seller page that edits a prototype. Settings only talks about the Plan including website (`client/src/pages/Settings.tsx` lines 207 and 292).

## Client state

Held only in memory on `WebsitePage`, all starting empty (`client/src/pages/Website.tsx` lines 26–31):

| State | Initial value | What it is |
| --- | --- | --- |
| `selectedIds` | `[]` | Products the seller ticked |
| `palette` | `null` | Ground, Ink, or Clay |
| `typePairing` | `null` | sans or serif |
| `previewSite` | `null` | Storefront returned by Preview |
| `publishedHost` | `null` | Host string from a successful Publish in this visit |
| `openProductId` | `null` | Which product the in-page preview is showing |

`ready` is true only when at least one product is selected, palette and type are set, and the prototype says the shop is connected (lines 33–36). Preview writes `previewSite` in `onSuccess`. Publish writes `publishedHost` in `onSuccess` (lines 51–63). Neither callback writes anywhere else.

**React Query.** `useWebsitePrototype` is a `useQuery` for `GET /api/website/prototype`, keyed by that path and the user id. It is enabled only when there is a user id (`client/src/hooks/use-website.ts` lines 30–40). The response type is `shopConnected`, `shopDomain`, and `products` (id, title, photo, Shopify product id). It has no palette, type, or selection (lines 17–21). Preview and Publish are `useMutation`s. Publish invalidates `/api/subscription/status` on success. It does not write the prototype back into the cache (lines 43–79). The `QueryClient` is a module singleton with no persister, `staleTime` 30 seconds, and no refetch on window focus (`client/src/lib/queryClient.ts` lines 42–55). A full reload constructs a new client. The prototype query then runs again. The mutation results are gone.

**`localStorage` / `sessionStorage`.** Website picks are not stored. `localStorage` in this client is currency and a checkout session id (`client/src/components/image-card.tsx` lines 29–32; `client/src/pages/Settings.tsx` line 70). `sessionStorage` remembers the workspace path (`snapsync.workspaceChosen`) and a connect-return path (`client/src/lib/workspace-arrival.ts` lines 3–4 and 116–125). A refresh of `/website` stays on `/website` because the URL is already that path (`workspaceArrival` lines 73–77; `client/src/App.tsx` lines 136–152). That key is a path, not a prototype.

**URL.** `/website` has no search params. `Website.tsx` does not read the query string. The conversation link is `href="/website"` (`client/src/pages/Conversation.tsx` line 173).

## Server state

Routes, all on `website.router` (`api-py/app/main.py` line 103; `client/src/lib/api-routes.ts` lines 47–54):

| Call | Auth | What it persists |
| --- | --- | --- |
| `GET /api/website/prototype` | Signed-in seller | Nothing. Reads the Shopify connection and eligible products (`api-py/app/routers/website.py` lines 89–110). OpenAPI properties are only `shopConnected`, `shopDomain`, `products` (`api-py/tests/test_website_routes.py` lines 52–54). |
| `POST /api/website/preview` | Signed-in seller | Nothing. `preview_website` says nothing is stored and nothing is spent (`api-py/app/services/website_handoff.py` lines 334–354). |
| `POST /api/website/publish` | Signed-in seller | Upserts one `websites` row for that seller (`website_handoff.py` lines 357–426). Response is `host`, `spent`, `productCount` (`api-py/app/routers/website.py` lines 72–76 and 157–160). |
| `GET /api/storefronts/{handle}` | No sign-in | Read of the published row by handle (`website.py` lines 164–169). |

**Table `websites`.** One published Website per seller: `session_id` unique, `handle` unique, `shop_domain`, `shop_name`, `palette`, `type_pairing`, `products` jsonb (`api-py/app/models/website.py` lines 10–20; `api-py/alembic/versions/0013_websites.py` lines 21–30). RLS is on and `anon` / `authenticated` are revoked (migration lines 33–35). There is no draft table and no column for an unpublished prototype.

**What a Publish freezes.** Eligible products are groups of photos that already have a Shopify product id and listing copy (`website_handoff.py` lines 96–133 and 166–180). The snapshot is listing copy, confirmed facts, photo URLs, and the Shopify product id (lines 183–198). Photos prefer Channel URLs (`with_channel_photos`, lines 248–261). Palette must be `ground`, `ink`, or `clay`. Type must be `sans` or `serif` (lines 23–24 and 222–225). The host is `{handle}.sites.snapsyncai.co.uk` (lines 22 and 238–241). The first insert spends `website_handoff`. A later Publish overwrites the same row and does not spend (lines 391–426). A catalogue edit after Publish does not change the stored words (`published_storefront` reads the row, lines 275–301).

**Conversation row.** `conversations` stores silence, thread, and proposal, including a website proposal of product ids (`api-py/app/models/conversation.py` lines 10–18; `api-py/app/routers/conversation.py` lines 132–150). That proposal is not the prototype. The Website page does not call `GET /api/conversation`.

## Refresh sequence

1. The seller opens `/website`. `GET /api/website/prototype` fills the product list when the shop is connected and products are pushed with listing copy (`Website.tsx` lines 118–135; router lines 89–110). Palette, type, and ticks start unset (lines 26–28).
2. The seller picks palette, type, and products. Those calls only `setState` (lines 38–43 and 140–164). No request is sent.
3. Preview posts the draft. The API builds a storefront and returns it. The docstring says nothing is stored (`website_handoff.py` lines 343–354). The page keeps it in `previewSite` and renders `StorefrontView` in the page, not an iframe (`Website.tsx` lines 51–55 and 206–217; `storefront-view.tsx` line 63). `linked` is omitted, so it stays false and the preview does not rewrite the document title (`storefront-view.tsx` lines 86–88).
4. Publish, if it lands, inserts or updates `websites` and returns `host`. The page sets `publishedHost` and shows “Shoppers open {host}” (`Website.tsx` lines 58–63 and 109–113; `publish_website` lines 383–426). The public host can then load that row (`PublicStorefront.tsx` lines 7–17).
5. The seller refreshes `/website`. The browser drops the React tree and the QueryClient. `useState` runs again at the empty initials (`Website.tsx` lines 26–31). The prototype query runs again and can show the same eligible products, still unticked, and the shop domain (lines 33 and 133–135). It cannot restore palette, type, ticks, preview, or the host line, because those fields are not in `WebsitePrototype` and the page never calls `GET /api/storefronts/{handle}` or reads `_row_for_seller`. `_row_for_seller` is only used inside `publish_website` to overwrite an existing row (`website_handoff.py` lines 287–291 and 371).

**What survives a refresh of `/website`:** the route; eligible products and shop connection from the catalogue and Shopify connection; a `websites` row if Publish landed, readable on `{handle}.sites.snapsyncai.co.uk`; the conversation thread and a website proposal, on `/conversation` only.

**What is gone:** palette, type, selection, preview, the host banner, and in-flight Preview/Publish pending flags.

Leaving `/website` for another workspace page does the same to the prototype, because that state is local to the unmounted page. The URL is the only piece `sessionStorage` keeps.

## What “stuck” is

**Disabled buttons.** Preview and Publish are `disabled` when `!ready` or the mutation is pending (`Website.tsx` lines 80–93). After refresh `ready` is false, so both buttons stay disabled until the seller picks a palette, a type, and at least one product again. They are not held disabled by a leftover job.

**Missing draft.** There is no saved prototype to reload. That is the disappear.

**Preview.** It is an in-page `StorefrontView`, not an iframe. It disappears because `previewSite` goes back to `null`, so the block at lines 206–218 does not render. The copy under a preview says it is not the site shoppers open (`website-copy.ts` line 18).

**Job status.** The Website page has no job id or status query. `publish.isPending` is mutation state and dies with the page. The conversation’s website proposal is stored and comes back on `GET /api/conversation`, and accepting it still does not publish (`conversation.py` lines 253–254). Silence for website is stored on that same conversation row and does not blank `/website`.

A published site that the seller then refreshes on the **workspace** page looks blank even though shoppers can still open the host. A refresh of the **public** host loads the frozen row and does not use the prototype state.

## Tests that lock this

These tests lock the server contract. None of them mount `WebsitePage` or assert that a refresh restores palette, type, or preview. The client loss is the `useState` initials plus the prototype response shape, not a test that says “refresh clears the form.”

- Preview does not publish or spend, and `published_storefront` stays empty (`api-py/tests/test_website_handoff.py` lines 263–278).
- First Publish spends `website_handoff` and freezes Channel photo URLs (lines 183–205). A later Publish replaces the row and does not spend (lines 208–237). A catalogue edit does not change the published words (lines 240–260).
- Publish without a shop or a Plan stores nothing (lines 282–312).
- Prototype response has no palette, type, or selection (`api-py/tests/test_website_routes.py` lines 48–64). Preview and Publish require auth. The public storefront does not (lines 26–44 and 69–74).
- One `websites` row per seller: unique `session_id` and `handle` (`api-py/tests/test_schema_parity.py` lines 138–142).
- The conversation cannot publish. Starting a website only reads eligible products (`api-py/tests/test_conversation.py` lines 367–387 and 497–510).
- Website copy asks for a palette and type, and the preview note says it is not the shopper site (`tests/website-copy.test.ts` lines 12–27).
- Nav path `/website` is live (`tests/workspace-nav.test.ts` lines 45–49). Storefront hosts are only `{handle}.sites.snapsyncai.co.uk` (`tests/storefront-host.test.ts` lines 6–15).
- `Website.tsx` is only checked for overflow-confirm wiring (`tests/overflow-copy.test.ts` lines 43–49).
