# Query sources for search demand

**Researched:** 2026-09-24  
**Question:** Which first-party services return the queries people type, so Bulk SEO and listing copy refresh can use them as search demand?  
**Confidence:** HIGH on the four APIs below (official docs). DataForSEO is the wired vendor.  
**Sources:** Google Ads API, Google Search Console API, DataForSEO docs, Microsoft Advertising API. SnapSync ADR 0012 and `.scratch/listing-copy-refresh/spec.md`.

## Bottom line

Search demand is queries people type for this kind of product. Four official services return that kind of list. As of this note, SnapSync’s DataForSEO adapter is the one wired query source: `SEARCH_DEMAND_URL` on `api.dataforseo.com`, plus `SEARCH_DEMAND_LOGIN` and `SEARCH_DEMAND_API_KEY`. A password-only DataForSEO URL leaves Bulk SEO Start blocked. Google Ads, Search Console, and Microsoft Advertising still do not speak that adapter.

| Service | What it returns | Account | Official call |
| --- | --- | --- | --- |
| Google Ads Keyword Planner | Keyword ideas from seed words, plus average monthly searches | A Google Ads customer, OAuth scope `https://www.googleapis.com/auth/adwords` | `POST /v25/customers/{customer_id}:generateKeywordIdeas` |
| Google Search Console | Queries that already sent traffic to this shop | The shop’s Search Console property, OAuth `webmasters.readonly` | `POST /webmasters/v3/sites/{siteUrl}/searchAnalytics/query` with `dimensions: ["query"]` |
| DataForSEO Google Ads keywords | The same Google Ads keyword ideas, without your own Ads account | A DataForSEO login | `POST /v3/keywords_data/google_ads/keywords_for_keywords/task_post` (or the live endpoint) |
| Microsoft Advertising Keyword Planner | Keyword ideas for Bing, plus monthly searches | A Microsoft Advertising account | `POST https://adinsight.api.bingads.microsoft.com/AdInsight/v13/KeywordIdeas/Query` |

## Repo

ADR 0012 says listing copy refresh uses a real query source. The listing-copy-refresh spec leaves “wiring a specific commercial query vendor” out of scope, and leaves Shopify Search Console OAuth out of the v1 gate. Shop performance is extra when it exists. It is not required to start refresh.

## 1. Google Ads Keyword Planner

`KeywordPlanIdeaService.GenerateKeywordIdeas` returns keyword ideas from a seed (keywords, a URL, or both) and historical metrics such as average monthly searches. It is the API behind the Keyword Planner tool in Google Ads.

- Guide: https://developers.google.com/google-ads/api/docs/keyword-planning/generate-keyword-ideas
- RPC: https://developers.google.com/google-ads/api/reference/rpc/v25/KeywordPlanIdeaService/GenerateKeywordIdeas
- Seed shape: https://developers.google.com/google-ads/api/reference/rpc/v24/GenerateKeywordIdeasRequest

## 2. Google Search Console

`searchAnalytics.query` returns the queries, clicks, impressions, CTR, and position already in that property’s Performance report. That is this shop’s performance. It is not a list of queries for a product the shop has never been found for.

- Method: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- How-to: https://developers.google.com/webmaster-tools/v1/how-tos/search_analytics

## 3. DataForSEO

DataForSEO’s Google Ads Keywords Data API says it uses the Google Ads API as its source. Keywords for Keywords takes up to 20 seed keywords and returns keyword suggestions with search volume. Their product page says a Google Ads account is not required; you use DataForSEO credentials.

- Endpoint: https://docs.dataforseo.com/v3/keywords_data-google_ads-keywords_for_keywords-task_post/
- Overview: https://docs.dataforseo.com/v3/keywords_data-google_ads-overview/
- Product: https://dataforseo.com/apis/keyword-data-api

## 4. Microsoft Advertising

`GetKeywordIdeas` suggests keywords from existing keywords, a website, or a product category, and can include monthly searches. The guide says this is the same job as Keyword Planner in the Microsoft Advertising web app.

- Operation: https://learn.microsoft.com/en-us/advertising/ad-insight-service/getkeywordideas?view=bingads-13
- Guide: https://learn.microsoft.com/en-us/advertising/guides/keyword-ideas-traffic-estimates?view=bingads-13
