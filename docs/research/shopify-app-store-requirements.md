# Shopify App Store submission requirements

**Researched:** 2026-10-05  
**Question:** What must a public Shopify app satisfy to be submitted to and approved on the Shopify App Store in 2026?  
**Confidence:** HIGH on the numbered App Store requirements and on the pages listed under Sources. Two official pages disagree on details called out in sections 10 and 12 (Lighthouse points; post-purchase request count). The Partner Program Agreement and the Shopify API License and Terms of Use were not fetched; this note only records that Shopify’s requirements pages say apps must follow them.  
**Sources:** Shopify.dev App Store requirements, submission and pass-review guides, privacy and protected-customer-data docs, billing, webhook verification, authentication, API versioning, storefront performance, script-tag deprecation, App Design Guidelines, Built for Shopify requirements, and Shopify.dev changelog entries dated 2025-05-21, 2025-07-01, 2026-06-17, and 2026-08-01.

## Bottom line

The checklist a reviewer applies is the numbered list on [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements). Shopify’s privacy page says that list “is the same checklist that the Shopify App Review team uses to review apps.” Built for Shopify is a separate badge. An app can be approved for the App Store without it. The badge adds install, review, performance, embedding, and design criteria on top of the App Store list.

A public app is blocked from submission or approval if it fails any of these gates:

- It complies with the Partner Program Agreement, uses Shopify checkout, and does not offer the prohibited services in requirement 1.1.
- Every app charge uses Shopify App Pricing or the Shopify Billing API. Merchants can upgrade and downgrade without contacting support or reinstalling. Off-platform billing is not allowed unless Shopify has told the partner otherwise.
- It installs only from a Shopify-owned surface, runs OAuth immediately (including on reinstall), then opens the app UI. An embedded app uses the latest App Bridge and works without third-party cookies or local storage.
- It requests only the scopes it needs, serves all traffic over valid TLS, and subscribes to `customers/data_request`, `customers/redact`, and `shop/redact` before review. Invalid HMAC on those webhooks returns `401`. The action is completed within 30 days.
- The listing is accurate: matching app name, 1200×1200 JPEG or PNG icon, screenshots of the real UI, pricing only in Pricing details, a privacy policy URL, a support email, an emergency developer contact (email and phone), English screencast, and working test credentials.
- The app is production-ready on a development store. Automated checks on the App Store review page pass. OAuth URLs redirect to the grant screen.
- If it changes a theme, it uses theme app extensions and does not edit theme code.
- New public apps use the GraphQL Admin API only (required since 2025-04-01). Public apps that call the GraphQL Admin API use expiring offline access tokens. Non-expiring offline tokens are already unavailable to new public apps and are unavailable to existing public apps after 2027-01-01.

## 1. What the reviewer applies

[App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements) opens with: “To qualify for the Shopify App Store, your app must meet the requirements listed below.” Requirements can change. “The Shopify App Review team can reject an app at their discretion if it doesn't meet the set standards.”

[Privacy law compliance](https://shopify.dev/docs/apps/build/privacy-law-compliance) points at that same list and says: “This is the same checklist that the Shopify App Review team uses to review apps.”

The numbered sections are:

| Section | What it covers |
| --- | --- |
| 1. Policy | Platform rules, checkout, prohibited app types, session tokens, billing |
| 2. Functionality | Working UI, Shopify APIs, App Bridge, GraphQL, embedded admin, OAuth install |
| 3. Security | TLS, and proof for a short list of sensitive scopes |
| 4. App Store listing | Name, pricing placement, truthful copy, images, screencast, credentials, emergency contact |
| 5. Category-specific | Online store, payments, subscriptions, checkout, sales channels, and other types |

[Best practices for apps in the Shopify App Store](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices) says those practices are for a better lifecycle, and “for a list of all the requirements that need to be met to be eligible for the Shopify App Store, refer to the App Store requirements.” Where this note says “best practice,” it is that page, not the numbered checklist.

[Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) says status requires the app to “continue to meet the requirements for distributing apps on the Shopify App Store,” then adds its own criteria. Those are badge criteria.

## 2. Policy gates that apply to every public app

Source: [App Store requirements, section 1](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements).

“All Shopify App Store apps must comply with the Partner Program Agreement.” Partners “should not intentionally circumvent critical platform functionality.”

Quoted requirements that apply broadly:

- **1.1.2 Use Shopify checkout.** “Apps that bypass checkout or payment processing, or register any transactions through the Shopify API in connection with such activity, are prohibited.”
- **1.1.1 Use session tokens for authentication.** “Your embedded app must function properly without relying on third-party cookies or local storage, including when accessed in incognito mode on Chrome.”
- **1.1.12 Build web-based apps.** The app must not require a desktop app.
- **1.1.5 Create unique apps.** It must not be identical to another app the partner has published.
- **1.1.4 Use only factual information.** No fake reviews or false purchase notifications.
- **1.1.9 Obtain explicit buyer consent before adding charges.** Optional charges that raise checkout cannot be added or pre-selected. The cost must be clear, and the buyer must consent.
- **1.1.10 Maintain the cheapest shipping option as default.**
- **1.1.3 Direct merchants to the Shopify Theme Store.** The app must not let merchants download themes.
- **1.1.13 Duplicate only authorized product information.** Claims such as “import from any store in the world” are not acceptable.
- **1.1.15 Process refunds only through the original payment processor.** Store credit during a refund must use `refundCreate` or `returnProcess`.
- **1.1.11 Browser extensions are only permitted as an optional feature.**

Not allowed on the App Store: classifieds-style marketplaces (1.1.6; marketplaces should be sales channels), capital lending (1.1.16), connecting merchants to agencies or freelancers (1.1.14), and apps that connect to a POS system outside Shopify (1.1.8). Payment Gateway apps need authorization and the Payments API (1.1.7).

## 3. Installation, embedding, OAuth, App Bridge, and scopes

### Installation (mandatory)

[Requirement 2.3](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements): “Apps can only be installed and initiated on Shopify services.”

- **2.3.1** Do not ask the merchant to type a `myshopify.com` URL or shop domain during install or configuration.
- **2.3.2** “Your app must immediately authenticate using OAuth before any other steps occur. Merchants should not be able to interact with the user interface (UI) before OAuth.”
- **2.3.4** The same immediate OAuth applies on reinstall, “even if the merchant has previously installed and then uninstalled your app.”
- **2.3.3** After the merchant accepts permissions, redirect to the app UI.

[Pass app review](https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review): “If they don't redirect merchants to the OAuth grant screen, then your app won't be approved.” Shopify CLI apps use Shopify managed installation and can skip the manual OAuth URL check.

### Embedded admin and App Bridge (mandatory)

[Requirement 2.2](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements):

- **2.2.1** “Apps that don't use or need any Shopify APIs are not permitted.”
- **2.2.2** Off-platform features must be integrated in the Shopify admin.
- **2.2.3** “As of March 13th, 2024, all apps must use the latest Shopify App Bridge by adding the `app-bridge.js` script tag before any other script tags.”
- **2.2.4** “As of April 1, 2025 all new public apps must be built exclusively with the GraphQL Admin API. As of October 1, 2024 the REST Admin API is considered a legacy API and should no longer be used.”
- **2.2.7** Max modal must not launch without a merchant interaction, and must not launch from the app navigation menu.
- **2.2.5 and 2.2.6** Admin UI blocks, admin actions, and admin links must be feature-complete and novel. They must not promote the app, related apps, or review requests.
- **2.2.8 and 2.2.9** Sidekick app extensions must match the app’s core functionality and must not promote or cross-sell.

Payment apps are the stated exception to embedding. **5.2.5:** “Payment apps are not allowed to be embedded into the Shopify Admin.”

[ID tokens](https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens) (Shopify’s current name for session tokens): “Apps embedded in the Shopify admin must authenticate with ID tokens, because third-party cookies aren't reliably available in that context.” An ID token is a JWT from App Bridge. It expires one minute after issue. The app exchanges it for an access token and never sends the ID token to a Shopify API. Validate signature (HS256 with the client secret), `exp`, `nbf`, `aud` (client ID), and matching `iss` and `dest` hostnames. Reject failures with `401`.

[Access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens): “Use expiring offline access tokens for public apps that call the GraphQL Admin API.” “New public apps already can't use [non-expiring offline tokens] for GraphQL Admin API requests, and existing public apps can't after January 1, 2027.” Expiring offline access tokens last 1 hour (`expires_in` 3600). The refresh token is issued for 90 days.

[Authenticate an embedded app without a template](https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange): “Store the `access_token` and `refresh_token` securely on your backend, along with `expires_in` and `refresh_token_expires_in` so you know when each one expires. Never expose them to the browser.”

### Scopes (mandatory)

[Requirement 3.2](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements): “Your app must request only the access scopes that are necessary for your app to function properly. You may be requested to provide proof.” Optional scopes are “strongly recommend[ed]” for access that not every merchant needs. That sentence is a recommendation, not a separate numbered ban.

The checklist names scopes that must be justified if requested: `read_all_orders` (3.2.1), `write_payment_mandate` (3.2.2), `write_checkout_extensions_apis` (3.2.3), `read_advanced_dom_pixel_events` (3.2.4, and only for heatmap or session recording on checkout), and `read_checkout_extensions_chat` (3.2.5).

## 4. Security

**Mandatory on the review checklist**

[Requirement 3.1.1](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements): “Your app must have a valid TLS/SSL certificate without any errors.”

Compliance webhooks add a specific HMAC rule, quoted in section 7. [Verify webhook deliveries](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries) is the general mechanism: each HTTPS delivery has a base64 HMAC in `X-Shopify-Hmac-SHA256`, computed with the app’s client secret and the raw body. “Always verify HMAC before trusting payload contents.” Compute HMAC-SHA256 of the raw body and reject mismatches. The sample returns `401` on failure. Pub/Sub and EventBridge deliveries do not use this HMAC. Acknowledge HTTPS deliveries with `200`. Anything outside the 200 range, including 3XX, is an error. Connection timeout is one second. The whole request times out at five seconds. Shopify retries 8 times over 4 hours.

**Security guide, not a numbered App Store line**

[Following security best practices](https://shopify.dev/docs/apps/build/security/following-security-best-practices) tells apps to validate request HMACs, ID-token claims, OAuth `state`, exact redirect URLs, and webhook HMACs on the raw body before parsing. “When you do store personal data, encrypt it, restrict access to the services and people that need it, log who reads it, set a retention limit, and confirm that your deletion path works.” “Use TLS for all external traffic” and “Encrypt data at rest, including backups.” This page is guidance. The numbered checklist’s security section is TLS plus the named scopes.

## 5. Listing: name, icon, screenshots, demo, pricing, support, privacy, emergency contact

### On the numbered checklist

[Section 4](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements):

- **4.1.1** The Developer Dashboard name and the App Submission form name must match or share common words.
- **4.2.1** Pricing information includes every option, including free-trial length and charge details.
- **4.2.2 and 4.2.3** Pricing stays in Pricing details. It does not appear in the icon, other images, or other listing areas.
- **4.3.1** If the app embeds features in the Online Store, select “Merchant must have online store.”
- **4.3.2** List only languages the merchant UI fully supports.
- **4.3.3 and 4.3.4** No statistics, data, or guarantees in copy or images, including “the first,” “the best,” or “the only.”
- **4.3.5** Tags match the primary function.
- **4.3.7 and 4.3.6** No reviews or testimonials in the listing or in images.
- **4.3.8** State geographic or API-plan requirements if the app needs them.
- **4.4.1** App card subtitle is a concise value phrase. No keyword stuffing, merchant personal information, or statistics.
- **4.4.2** App details explain functionality well enough that a merchant can decide to install. Not a keyword list and not only a feature list.
- **4.4.3** Do not use Shopify trademarks in the icon, banner, or screenshots except to show compatibility under the brand guidelines.
- **4.4.4** “Images should primarily show your app's actual user interface and features. Screenshots should not include desktop backgrounds or browser windows. Feature images and screenshots that solely contain your app logo are not permitted.”
- **4.4.5** Each image is unique.
- **4.5.3** “Include a screencast to demonstrate your app’s onboarding and features as described in its listing.” It needs step-by-step setup of core features, in English or with English subtitles.
- **4.5.4 and 4.5.5** Testing instructions include credentials. If login is required, those credentials must be valid and must open the full feature set.
- **4.5.6** “Add an emergency developer contact to your Partner Dashboard.”

### Submission form fields

[Submit your app for review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review):

- App URLs must not include “Shopify” or “Example,” including misspellings and abbreviations.
- “The app icon must be 1200 x 1200 pixels in size and in either JPEG or PNG format.”
- The API contact email must not contain “Shopify.”
- “You need to provide an email and phone number” as the emergency contact.
- “Every app submission must specify a primary language and create at least one Shopify App Store listing.”
- Automated checks “must be run and completed successfully.”
- Protected customer data is requested from this page, or the app opts out. “Applying for protected customer data isn't possible while the app is under review.”

### Best-practice listing specs (not numbered requirements)

[Best practices, section 5](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices) adds field guidance the numbered list does not state as a must:

- App name: “Use 30 characters or fewer, which is the maximum length that an app name can be.” Lead with the brand. Do not make the name identical to another app.
- Icon: JPEG or PNG, 1200×1200, padding, no text, screenshots, or Shopify trademarks. The 1200×1200 size is also a submission must, above.
- Feature media: 1600×900 (16:9). A 2–3 minute video is described as the best showcase, with screencasts limited to 25% of the video.
- Screenshots: “Screenshots should be 1600px by 900px (16:9). Include 3-6 desktop screenshots, including at least one of your app's UI.” Alt text. No PII, pricing, reviews, or outcome guarantees.
- Demo store URL: “Provide a link to a development store that showcases your app.” This sentence is on the best-practices page. The numbered checklist requires the screencast and test credentials, not this URL.
- App introduction: 100 characters. App details: 500 characters. Features: up to 80 characters each. Up to six integrations. Up to five search terms.
- “Include a privacy policy (required).”

### Privacy policy URL (mandatory)

[Privacy requirements](https://shopify.dev/docs/apps/launch/privacy-requirements): “you must provide a privacy policy and link to it from your Shopify App Store listing. These requirements are the same for both full and limited visibility apps.” Recommended contents (what is collected from APIs, the merchant, and buyers; use; retention; transfers; contact, and a physical address where a jurisdiction requires one) are recommendations on that page, not a field-by-field rejection list.

### Support (mandatory email)

[Support your customers](https://shopify.dev/docs/apps/launch/distribution/support-your-customers): “All public apps are required to provide at least one support channel.” “Having a valid support email address on file is always required, even if email isn't your preferred support channel.” “App developers are required to support merchants in a timely manner.” A support portal URL and a phone number are optional. Shopify does not support merchants for third-party apps.

## 6. Billing

**Mandatory.** [Requirement 1.2](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements): “Apps that use off-platform billing cannot be distributed through the Shopify App store, unless you've been notified otherwise by Shopify. Your app must use Shopify App Pricing or the Shopify Billing API for all app charges.”

- **1.2.1** Shopify App Pricing or the Billing API for any app charges.
- **1.2.2** “If your app has any charges, it must correctly implement Shopify App Pricing or the Shopify Billing API” so the merchant can accept, decline, and be asked again on reinstall.
- **1.2.3** Merchants can upgrade and downgrade without contacting support or reinstalling. Charges must show in the application charge history in the admin.

[About billing for your app](https://shopify.dev/docs/apps/billing): “All apps published on the Shopify App Store are required to use a Shopify provided billing solution.” Shopify App Pricing is “the default for new public apps.” Plans are defined in the submission form. Shopify hosts plan selection, trials, proration, upgrades, and downgrades. Manual Pricing with the Billing API “is still supported but is the legacy method,” including one-time purchases, which Shopify App Pricing does not support. Selling a merchant’s products on a subscription is not app billing. That uses purchase options.

[Best practices, pricing](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices): the primary billing method is “Free to install, Recurring charge, or One-time payment.” A free-and-paid app selects Recurring charge and marks one plan Free, which shows “Free plan available.” Pricing belongs only in the designated section. The listing diagram includes “a link to a page that describes any charges that are billed outside of Shopify's app billing system.” Requirement 1.2 still says off-platform billing cannot be distributed unless Shopify has notified the partner otherwise. This note does not treat that listing link as permission to bill outside Shopify.

[Pass app review](https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review): test billing before submission. On a dev store in the same Partner organization, Shopify App Pricing plans are selectable at no charge. Do not use the Billing API `test` field for that flow. For manual Billing API charges, set `test` to `true` on the dev store, then set it back to `false` or installed merchants are not charged.

**Category exception, still on the checklist.** Product sourcing **5.5.3**: “When charging merchants the cost of goods sold, you must use a PCI compliant payment gateway. All other charges associated with your app must go through Shopify's Billing API.”

## 7. Mandatory compliance webhooks

[Privacy law compliance](https://shopify.dev/docs/apps/build/privacy-law-compliance): “Any app that you distribute through the Shopify App Store must respond to data subject requests, regardless of whether the app collects personal data.” “You must ensure that your app is subscribed to and verifies all mandatory compliance webhooks before you submit your app to be reviewed by Shopify.” Missing URLs, or failing to respond as required, gets the app rejected.

Topics:

| Topic | Event |
| --- | --- |
| `customers/data_request` | Requests to view stored customer data |
| `customers/redact` | Requests to delete customer data |
| `shop/redact` | Requests to delete shop data |

How they must behave:

- Handle `POST` with a JSON body and `Content-Type: application/json`.
- “If a mandatory compliance webhook sends a request with an invalid Shopify `HMAC` header, then the app must return a `401 Unauthorized` HTTP status.”
- Respond with a `200` series status code.
- “Complete the action within 30 days of receiving the request.” If the law requires the app to keep the data, do not complete the redaction.

How they are registered: register an HTTPS endpoint with a valid SSL certificate (or EventBridge, or Pub/Sub), then set them in `shopify.app.toml`:

```toml
[webhooks]
api_version = "2024-07"

[[webhooks.subscriptions]]
compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]
uri = "https://app.example.com/webhooks"
```

The `2024-07` version in that sample is the doc’s example, not a statement that 2024-07 is still a supported API version. See section 14 for the version table fetched on this date.

Timing from the same page:

- `customers/data_request` is sent to installed apps. If the app has customer or order access, the payload includes resource IDs to give to the store owner. Provide that data to the store owner directly.
- `customers/redact`: if the customer has not ordered in the past six months, Shopify sends the payload 10 days after the deletion request. Otherwise it waits until six months have passed.
- `shop/redact`: “48 hours after a store owner uninstalls your app,” with `shop_id` and `shop_domain`, so the app can erase that store’s data.

[Submit your app for review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review) repeats: “Apps that are distributed through the Shopify App Store must subscribe to compliance webhooks.”

GDPR and CPRA: Shopify “requires public apps to provide the same privacy rights for all personal data, regardless of where an individual is located.” The page says it is not legal advice.

## 8. Protected customer data

[Work with protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data). Public apps:

| Level | Data | What Shopify requires |
| --- | --- | --- |
| 0 | No customer data | No action |
| 1 | Customer data except name, address, phone, and email | Request access in the Partner Dashboard, and implement level 1 requirements |
| 2 | Data that includes name, address, phone, or email | Request the data and those fields, implement level 1 and level 2, and participate in data protection reviews |

“Shopify will approve your app to use protected customer data if the requested data is the minimum amount required.” Unapproved fields are redacted. GraphQL requests for unapproved types return HTTP `200` with an error in `errors`. Development stores can use the selected fields after they are saved. Review is required before a public app uses them in production. “You don't need to submit a request for review for apps that are installed only on development stores.” Select a distribution method before requesting access.

Protected resources include customers, orders (including draft orders, abandoned checkouts, refunds, transactions), shipping and fulfillment tied to a customer, customer webhooks and metafields, gift cards used by one customer, and checkout on the Storefront API. Name, address, email, and phone are requested as separate fields.

Level 1 (all nine are required if the app uses protected customer data): minimum data, tell merchants what is processed and why, limit processing to stated purposes, respect consent, respect opt-outs of data sharing, allow opt-out of automated decisions with legal or significant effects, have a privacy policy or data protection agreement, apply retention periods, and encrypt data at rest and in transit.

Level 2 (additional, when name, address, phone, or email is used): encrypt backups, separate test and production data, have a data-loss-prevention strategy, limit staff access, require strong staff passwords, keep an access log, and have a security incident response policy.

Data protection reviews can happen after implementation. They are more likely for apps with many installs, many customer records, more approved fields, or long retention.

[Pass app review](https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review): if the app uses customer data, meet these requirements and apply under API Access > Protected customer data access.

## 9. Online store and theme app extensions

**Mandatory when the app changes the theme.** [Requirement 5.1](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements): “Modify themes only through theme app extensions, not through direct code changes.”

- **5.1.1** “If your app modifies the merchant's theme, you need to use theme app extensions. You or merchants should not make any code changes to the theme.”
- **5.1.2** The widget displays without errors in the Theme Editor and the Online Store.
- **5.1.3** Detailed setup instructions for app embeds and app blocks. A deep link is “strongly recommend[ed].”
- **5.1.4** App Name Branding on storefront components is allowed only when customers interact with the brand as part of buying, or removal would confuse or harm them. Otherwise use the standard attribution pattern.
- **5.1.5** Customer data collected through Online Store or POS must be returned to the merchant’s admin and must follow the Shopify API License and Terms of Use section 2.3.17. This note did not fetch that license text.

[Best practices, section 9](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices) says standard attribution is “Limited to a 24x24 pixel width and height.” That size is on the best-practices page.

**Script tags are no longer a path for new storefront JavaScript.** [Script tag deprecation](https://shopify.dev/docs/apps/build/online-store/script-tag-deprecation), fetched 2026-10-05: “You can't create or update a script tag after October 1, 2026, and script tags will stop running on storefronts on March 1, 2027.” Order status page scripts stop on the earlier date in that table, August 26, 2026.

[Storefront script tags](https://shopify.dev/docs/apps/build/online-store/script-tag-deprecation/storefront):

| Date | What happens |
| --- | --- |
| October 1, 2026 | You can't create or update script tags. Existing script tags keep running. |
| March 1, 2027 | Shopify will stop injecting script tags into storefronts. |

Replacement: an app embed block to load JavaScript, or a web pixel for analytics, conversions, or customer behavior. A guessed changelog URL, `https://shopify.dev/changelog/script-tags-are-deprecated-and-will-stop-running-on-march-1-2027`, returned 404. The two docs above are the sources for these dates.

## 10. Performance, UI, and checkout

### What the numbered checklist requires

[Requirement 2.1](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements): the app has a UI merchants can use. Web errors (404, 500, 300) are not acceptable. The UI must not have bugs that fully or partly block review (2.1.1, 2.1.2). Synced data must match across the admin, the app, and other platforms (2.1.4).

Polaris is not a general App Store requirement. [App Design Guidelines](https://shopify.dev/docs/apps/design): “For apps embedded into the Shopify admin, we recommend using the components and best practices of Polaris.” Sales channels are the category that must use it. **5.7.2:** “Use the required Polaris components and style guide to build your sales channel.”

Checkout customization (**5.6**) must not collect payment details in a checkout UI extension, must not collect data the standard checkout form already collects, must not add countdown timers, must show the same product name, image, and cost as the store, must get explicit consent before any change to the order total, and must not promote the app. Chat UI on checkout is only for real-time customer service as the core feature.

### Lighthouse: best practice and Built for Shopify, not a numbered App Store line

The numbered App Store requirements page does not state a Lighthouse point limit.

[Best practices, section 4.A](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices): “Your app shouldn't reduce Lighthouse performance scores by more than 10 points.” The same page’s introduction says it is best practices, and eligibility is the App Store requirements list.

[Built for Shopify 2.2.1](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements): “Your app must not reduce the storefront Lighthouse performance score by more than ten points.” That “must” is a badge criterion.

[Storefront performance](https://shopify.dev/docs/apps/build/performance/storefront) describes the test: Lighthouse before and after install, weighted home 17%, product 40%, collection 43%. It says the app “should consistently demonstrate low or no negative impact.” It does not repeat the 10-point sentence.

Admin Web Vitals targets (LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms, at p75, with at least 100 calls in 28 days) are Built for Shopify 2.1, not App Store requirement lines.

## 11. Testing and how submission works

[Pass app review](https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review): “The app review team will only review production-ready apps.” Install on a development store. Agree to the Partner Program Agreement and the Shopify API License and Terms of Use.

An AI self-review (`/shopify-app-store-review` in the Shopify AI Toolkit) is optional. “The AI self-review only covers requirements that can be checked against code.” Listing content, live behavior, and merchant UX are outside it. “The Shopify app review team still verifies all requirements after you submit.”

[Submit your app for review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review): complete the review page (configuration, listing, protected customer data, automated checks), then submit. Review email goes to the listing contact. Add `noreply@shopify.com` to allowed senders. Repeated failure to fix reviewer issues, growing issue counts, silence, or refusing an exemption outcome can suspend that app from resubmission until the date in the banner.

## 12. Rejection reasons that are still official requirements

[Pass app review, common problems](https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review) is the official table. “Failure requires app re-submit” is Shopify’s column.

| Category | Reason Shopify lists | Re-submit? |
| --- | --- | --- |
| Billing | Pricing on the form is wrong. Merchants cannot upgrade or downgrade. The app does not use Shopify’s billing system. | No |
| Installation | Install does not go straight to the OAuth grant screen. Fatal error after install. Reinstall fails. | Yes |
| Embedding | The app flips between embedded and not embedded. Fix: App Bridge, and session-token authentication. | Yes |
| User interface | UI is broken on install, or the app returns 404, 500, or 300. | Yes |
| App testing | No testing instructions or credentials. The app is not a finished, stable product. | Yes |
| Online store | Theme changes do not use theme app extensions. Widgets do not show on the storefront. | Yes |

Other checklist items that are explicit reject conditions:

- Compliance webhook URLs missing, or responses that do not match section 7. [Privacy law compliance](https://shopify.dev/docs/apps/build/privacy-law-compliance): the app “will be rejected.”
- OAuth URLs that do not reach the grant screen. [Pass app review](https://shopify.dev/docs/apps/launch/app-store-review/pass-app-review): “your app won't be approved.”
- Unsupported API use past the upgrade deadline. [API versioning](https://shopify.dev/docs/api/usage/versioning): the app “is delisted from the Shopify App Store.” Installs are blocked for at least seven days.

**Conflict to treat carefully.** Post-purchase **5.8.4** on the [requirements page](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements): “Limit consecutive post purchase requests to a maximum of 2.” [Best practices, section 17](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices): “Limit consecutive requests to 3.” The requirements page is the review checklist. This note does not resolve the disagreement beyond that.

## 13. Built for Shopify is optional

[Built for Shopify requirements](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements) apply only when the app is seeking the badge. Prerequisite 1.1.1 is “Meet App Store requirements.” Extra gates include:

- **1.1.2** No active or outstanding Partner infractions.
- **1.2.1** At least 50 net installs from active shops on paid plans.
- **1.2.2** At least five reviews.
- **1.2.3** A minimum recent rating. The page does not state the numeric threshold.
- **2.1** Admin Web Vitals: LCP 2.5 seconds or less, CLS 0.1 or less, INP 200 milliseconds or less, each at the 75th percentile, each with at least 100 calls over 28 days. Latest App Bridge is required so Shopify can collect the metrics.
- **2.2.1** Storefront Lighthouse drop of no more than ten points.
- **2.3.1** Checkout carrier-rate calls: at least 1000 requests in 28 days, p95 of 500ms or less, failure rate 0.1% or less.
- **3.1** Embedded in the admin with latest App Bridge. Primary workflows stay in the admin. Signup uses Shopify credentials unless a stated B2B exception applies. Homepage shows useful metrics. Third-party connection settings stay in the embedded app.
- **3.2.1** Online-store UI is built with theme app extensions so uninstall removes it.
- **3.2.2** Do not use the Asset API to add, edit, or delete theme files, with three exceptions: page builders that replace layouts, full theme backup and restore, and SEO, content-locking, or developer-tooling apps that only read theme files.
- **Section 4 Design.** Nineteen criteria in three groups (Familiar, Helpful, User-friendly), including App Bridge nav, contextual save bar, mobile layout, WCAG 2.1 AA contrast, and no Shopify impersonation. [Changelog, 2025-05-21](https://shopify.dev/changelog/simplified-bfs-design-requirements): effective 2025-06-01, review uses these simplified rules. “The previous 104 BFS design requirements” became “19 BFS design requirements spread across 3 design sub-categories.”

[App Design Guidelines](https://shopify.dev/docs/apps/design) tie Polaris to this badge’s quality bar as a recommendation: “Meeting the Built for Shopify design requirements earns preferential treatment in the Shopify App Store.” Polaris itself is “we recommend,” including for the badge. Sales-channel Polaris use remains an App Store requirement (5.7.2), separate from the badge.

Category-specific badge rules (section 5 of the BFS page) are not App Store approval rules. Examples fetched from that page: ads, affiliate, and analytics apps must use web pixels; subscription apps must use selling plans, subscription contracts, customer payment methods, an Online Store 2.0 app block, Customer Account UI extensions, and the Customer Account API; returns apps must sync the return lifecycle and use the Customer Account API. Fulfillment badge thresholds on the page as fetched include 97% of assigned fulfillment orders completed in 28 days (5.8.2), 95% of fulfillment requests answered within 24 hours (5.8.6), and 99% of cancellation requests answered within 24 hours (5.8.7).

## 14. Changes dated 2025–2026

All of these are from pages fetched on 2026-10-05.

| Change | Status | Source |
| --- | --- | --- |
| REST Admin API is legacy as of 2024-10-01. New public apps must use only the GraphQL Admin API as of 2025-04-01. | App Store requirement 2.2.4 | [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements) |
| Latest App Bridge (`app-bridge.js` before other scripts) required since 2024-03-13. | App Store requirement 2.2.3 | Same page |
| BFS design criteria cut from 104 to 19, effective 2025-06-01. | Badge only | [Changelog](https://shopify.dev/changelog/simplified-bfs-design-requirements) |
| BFS rules for ads, affiliate, analytics, email, forms, SMS, and subscription Customer Account UI extensions, effective 2025-07-01. Enforced at submission and annual review. | Badge only | [Changelog](https://shopify.dev/changelog/new-built-for-shopify-requirements-for-marketing-apps-effective-july-1-2025) |
| Returns and subscription apps with buyer-facing self-service must use the Customer Account API by 2026-12-01, or they risk losing the badge. | Badge only | [Changelog](https://shopify.dev/changelog/built-for-shopify-requirements-for-returns-and-exchanges-and-subscription-apps) |
| Fulfillment-services badge thresholds updated 2026-08-01. Current numbers are on the BFS requirements page. | Badge only | [Changelog](https://shopify.dev/changelog/updated-built-for-shopify-requirements-for-fulfillment-services-apps) |
| Public apps must use expiring offline access tokens for the GraphQL Admin API. Existing public apps cannot use non-expiring offline tokens after 2027-01-01. | Authentication docs for public apps | [Access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens) |
| Script tag create/update stopped 2026-10-01. Storefront injection stops 2027-03-01. | Platform deprecation. Theme changes were already required to use theme app extensions. | [Script tag deprecation](https://shopify.dev/docs/apps/build/online-store/script-tag-deprecation) |

[API versioning](https://shopify.dev/docs/api/usage/versioning), table as fetched on 2026-10-05. Each stable version is supported for at least 12 months. If a request names an inaccessible version, Shopify “falls forward” to the oldest accessible stable version. Using unsupported resources after the upgrade deadline can delist the app.

| Stable version | Release date | Accessible until | Status on the page |
| --- | --- | --- | --- |
| 2025-04 | April 1, 2025 | April 16, 2026 15:00 UTC | Unsupported |
| 2025-07 | July 1, 2025 | July 16, 2026 15:00 UTC | Unsupported |
| 2025-10 | October 1, 2025 | October 16, 2026 15:00 UTC | Unsupported |
| 2026-01 | January 1, 2026 | January 16, 2027 15:00 UTC | Stable |
| 2026-04 | April 1, 2026 | April 16, 2027 15:00 UTC | Stable |
| 2026-07 | July 1, 2026 | July 16, 2027 15:00 UTC | Stable |
| 2026-10 | October 1, 2026 | October 16, 2027 15:00 UTC | Latest stable |
| 2027-01 | January 1, 2027 | January 16, 2028 15:00 UTC | Release candidate |

[Best practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices) adds a tip: “apps using APIs that will be deprecated within 90 days can't be submitted.” That sentence is on the best-practices page, not in the numbered checklist. The versioning page’s delist rule is the one quoted above.

The compliance-webhook TOML sample still shows `api_version = "2024-07"`. That version is not in the supported table above.

## 15. Pages that failed or were not used

- `https://shopify.dev/changelog/script-tags-are-deprecated-and-will-stop-running-on-march-1-2027` returned 404. The dates in section 9 come from the script-tag docs that did load.
- The Partner Program Agreement, the Acceptable Use Policy, and the Shopify API License and Terms of Use were not fetched. Requirements that say “comply with” those documents are recorded as Shopify’s instruction, not as a summary of the legal text.
- Shopify Community forum threads appeared in search. They are not sources for any requirement in this note.
