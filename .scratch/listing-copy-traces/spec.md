**Status:** ready-for-agent

# Listing-copy traces

## Problem Statement

I can generate listing copy, regenerate one field, refresh one product from search demand, and run Bulk SEO, and I cannot see what the model actually returned in production. When the words are wrong I cannot tell whether the prompt, the completion, or a seller edit caused it. A failed call disappears into a log line. I need that record on a Langfuse I run myself, on Railway, without sellers seeing it and without a tracing outage stopping a listing.

## Solution

Each listing-copy model call writes one trace: the text prompt, the completion (or the error), the model, the latency, and the token counts. The product photo is not in the trace. The jobs are listing-copy generate, per-field regenerate, listing copy refresh, and Bulk SEO. Langfuse is its own Railway service. The API only sends traces to it. Local and production are two Langfuse projects. Prompts stay in the repo.

After the call, the trace records what the seller did with the reply. Generate and per-field regenerate mark each field unchanged, edited, or still open, and an edit stores the text they accepted. Listing copy refresh Accept marks the trace accepted. Dismiss tells the server and marks the trace dismissed. Bulk SEO Accept marks that product’s trace accepted. Leaving Bulk SEO leaves the trace unmarked. A newer regenerate supersedes the previous trace for that field or that refresh, so the old reply is not left looking abandoned.

If Langfuse is down, unconfigured, or the export fails, the seller still gets the listing copy, the accept still persists, and the dismiss still drops the proposal. The trace or the mark is dropped, and the API logs the export failure. Tracing does not spend Allowance.

## User Stories

1. As the operator, I want one trace per listing-copy model call, so that I can read what the model returned in production.
2. As the operator, I want listing-copy generate traced, so that the first title, description, tags, SEO title, meta description, and AEO are visible together.
3. As the operator, I want per-field regenerate traced under that field, so that a second description is not mixed up with the first full generate.
4. As the operator, I want listing copy refresh traced as its own job, so that a demand rewrite is not labelled as first generate.
5. As the operator, I want Bulk SEO traced as its own job, so that a catalogue run is not labelled as a single-product refresh.
6. As the operator, I want Bulk SEO traces from one run to share a pack id, so that I can open the pack as one session.
7. As the operator, I want each Bulk SEO trace to carry the product id, so that I can see which product inside the pack produced which reply.
8. As the operator, I want the catalogue photo id on every trace, so that I can find the product the call was for.
9. As the operator, I want the group id on the trace when several photos are one product, so that a grouped product is not a pile of unrelated photos.
10. As the operator, I want the text prompt on the trace, so that I can see the instructions and the confirmed facts the model was given.
11. As the operator, I want fibre composition and GPSR name, address, and email kept in that text when they were in the prompt, so that I can see why the copy named a manufacturer.
12. As the operator, I want the product photo left out of the trace, so that image bytes do not fill the trace store.
13. As the operator, I want an image part in the model request stored as omitted, so that a caller cannot accidentally persist the photo.
14. As the operator, I want the completion text on the trace, so that I can read the reply without reconstructing it from the product.
15. As the operator, I want the model name, latency, and token counts on the trace, so that I can see cost and slowness as well as the words.
16. As the operator, I want a trace even when token counts are missing, so that a stream that never reports usage is still readable.
17. As the operator, I want a failed model call traced with the error, so that a generation failure is visible in the same place as a success.
18. As the operator, I want a failed stream to keep whatever text was already produced, plus the error, so that a cut-off reply is not blank.
19. As the operator, I want the generate trace written when the stream finishes, so that the trace is the assembled reply, not one row per token.
20. As the operator, I want prompts to stay in the repo, so that changing copy still ships with the app and not from the Langfuse UI.
21. As the operator, I want Langfuse deployed on Railway as its own service, so that the API service is not also the trace database.
22. As the operator, I want local traces in a different Langfuse project from production, so that development calls do not sit in the production project.
23. As the operator, I want the API to send traces only when a host and keys are configured, so that an environment without Langfuse simply does not trace.
24. As the operator, I want a dropped export written to the API log, so that I can tell Langfuse was unreachable.
25. As the operator, I want Classification on upload absent from this trace store, so that category guesses are not mixed into listing-copy traces.
26. As a seller, I want generate to finish when Langfuse is down, so that a trace store cannot stop listing copy.
27. As a seller, I want per-field regenerate to finish when Langfuse is down, so that fixing one field does not wait on tracing.
28. As a seller, I want listing copy refresh to return the proposal when Langfuse is down, so that search-demand copy still appears.
29. As a seller, I want Bulk SEO to return the pack when Langfuse is down, so that one unreachable trace host cannot fail the run.
30. As a seller, I want a failed export to leave the error I already see for a failed model call unchanged, so that tracing does not invent a second failure.
31. As the operator, I want each generate field marked unchanged, edited, or still open, so that I can see which part of the reply they kept.
32. As the operator, I want the fields to be title, description, tags, SEO title, meta description, and AEO, so that the marks use the same listing copy the seller accepts.
33. As the operator, I want an unchanged mark only when the accepted field is an exact match to the model’s field, so that a small edit is not recorded as kept.
34. As the operator, I want tags compared as the list the seller submitted, so that order and membership decide unchanged.
35. As the operator, I want AEO compared as the FAQ pairs the seller submitted, so that a rewritten answer counts as edited.
36. As the operator, I want an edited mark to store the text they accepted, so that I can read the correction next to the completion.
37. As the operator, I want that comparison to use the accept input, so that a facts-block stamp on description is not counted as the seller’s edit.
38. As the operator, I want a field they have not accepted to stay open, so that silence is not recorded as a rejection.
39. As the operator, I want an open field to stay unmarked, so that “not accepted yet” and “never” are the same absence.
40. As the operator, I want a field regenerate to supersede the previous trace for that field only, so that the new description receives the mark and the title stays on the original generate.
41. As the operator, I want the superseded field not to look abandoned, so that asking for another description is not a dismissed reply.
42. As the operator, I want the accept of a regenerated field marked on the new trace, so that the mark sits on the words they actually saw.
43. As the operator, I want a generate completion that cannot be split into a field, when that field is accepted, marked edited with the accepted text, so that a broken JSON reply is not called unchanged.
44. As a seller, I want accepting a generated field to persist exactly as it does today when the mark cannot be written, so that Langfuse cannot block Accept.
45. As a seller, I want description Accept to keep stamping fibre, care, and GPSR blocks, so that tracing does not change the facts gate.
46. As the operator, I want listing copy refresh Accept to mark that trace accepted, so that I can see they kept the demand proposal.
47. As the operator, I want refresh Accept recorded as accepted rather than edited, so that a pack they cannot edit is not labelled as a correction.
48. As a seller, I want refresh Accept to persist the four fields as it does today when the mark cannot be written, so that tracing cannot block the write.
49. As a seller, I want Dismiss on listing copy refresh to tell the server, so that the trace can record that I rejected the proposal.
50. As the operator, I want that Dismiss to mark the latest refresh trace dismissed, so that an explicit no is not the same as an open trace.
51. As a seller, I want Dismiss to persist nothing and spend nothing, so that rejecting a proposal still leaves the product and the Allowance alone.
52. As a seller, I want Dismiss to clear the proposal even when the mark cannot be written, so that Langfuse cannot leave a rejected pack on screen.
53. As the operator, I want a refresh regenerate to supersede the previous refresh trace, so that Accept or Dismiss lands on the latest proposal.
54. As the operator, I want a product-page refresh not to supersede a Bulk SEO trace for the same product, so that the two jobs stay separate.
55. As the operator, I want a Bulk SEO regenerate for one product to supersede that product’s previous trace in the pack, so that the mark lands on the latest proposal.
56. As the operator, I want Bulk SEO Accept to mark that product’s trace accepted, so that a kept catalogue proposal is visible.
57. As the operator, I want leaving Bulk SEO to leave the trace unmarked, so that closing the page is not recorded as a dismiss.
58. As a seller, I want Bulk SEO Accept to persist and spend as it does today when the mark cannot be written, so that tracing cannot change Allowance.
59. As the operator, I want a mark dropped when the original trace was dropped, so that an accept does not invent a trace that has no completion.
60. As the operator, I want no seller-facing Langfuse screen, so that sellers keep working in the product page and Bulk SEO.
61. As the operator, I want tracing and marks to spend no Allowance, so that looking at a reply is not a use.
62. As the operator, I want a trace kept until I delete it, so that a correction I want to study is not expired by a timer.
63. As a seller, I want the generate gate, the refresh gate, and Bulk SEO eligibility unchanged, so that tracing cannot bypass confirmed facts or search demand.
64. As a seller, I want Push, Website, and Inventory unchanged, so that a trace is not a publish path.

## Implementation Decisions

- One **listing-copy trace** module is the seam. HTTP, the SPA, the model, and Langfuse are adapters. Tests call the module with a fake sink. The module does not decide whether listing copy may be generated, whether refresh may run, or whether Bulk SEO may start. Callers that already passed those gates call the module.
- Langfuse is a self-hosted deploy on Railway, its own service (ADR 0024). The API process is not that service. The module talks to a sink. Production sink is Langfuse using the configured host and keys. Missing host or keys means the sink drops the trace. A sink error is logged and swallowed. The caller still returns the model result, the persisted accept, or the cleared dismiss.
- Local and production are two Langfuse projects, selected by which keys the environment has. The module has no environment branch of its own.
- Prompts stay in the repo. This module does not fetch prompts from Langfuse.
- One trace per model call. The caller passes the job (`listing_copy_generate`, `listing_copy_regenerate`, `listing_copy_refresh`, `bulk_seo`), the text prompt, the completion or the error, the model name, latency, token counts when the provider sent them, the catalogue photo id, the group id when the photos are grouped, the field name on a per-field regenerate, and the pack id on Bulk SEO. Bulk SEO traces that share a pack id are one session. Generate and refresh traces are found by product id and job, not by a session.
- The stored prompt is text only. Image parts are omitted. The module does not accept photo bytes as trace content.
- Generate’s completion is the assembled stream, written once when the stream ends. A stream error still records a trace with the error and any text already assembled. The seller’s event stream is unchanged.
- Listing copy refresh and Bulk SEO keep today’s proposal shape. The trace stores the prompt and the raw completion those jobs already parse. A parse failure is an error trace and still returns today’s failure to the seller.
- Identity uses the catalogue photo id Bulk SEO already treats as the product id, plus the group id when one exists. No new product column. No pack table. Trace state lives in the sink.
- Marks are a second call on the same module, after a successful accept or a refresh dismiss. The mark compares the accept input to the completion on the current trace, before description-block stamping. Exact match: strings equal; tags equal as a list; AEO equal as FAQ pairs. A match is unchanged. A difference is edited and the accepted text is stored. A generate completion that cannot yield the field is edited, with the accepted text stored.
- Current trace for a field: the latest listing-copy generate for that product, until a listing-copy regenerate for that field supersedes it. Other fields on the generate trace stay current. Refresh current trace is the latest listing-copy refresh for that product. Bulk SEO current trace is the latest bulk-seo trace for that product and pack. A refresh does not supersede generate or Bulk SEO. Superseded traces do not receive later marks and are not left as open.
- Refresh Accept and Bulk SEO Accept mark the current trace accepted. They do not mark edited. There is no edit step on those packs.
- Refresh Dismiss calls the server with the product id, marks the current refresh trace dismissed, persists no listing copy, and spends nothing. The proposal still disappears in the client when the call fails.
- Fields the seller has not accepted stay open: no mark. Leaving Bulk SEO writes no mark. Unmarked means not accepted yet.
- If the current trace is missing because the export was dropped, the mark is dropped. Accept and dismiss behaviour otherwise stay on the product-facts module, the listing-copy-refresh module, and the Bulk SEO module.
- Allowance is untouched. Generate persist, refresh accept, and Bulk SEO persist still spend only when those writes land, under the existing rules. Tracing, a dropped trace, a mark, and Dismiss do not spend.
- No schema change. No seller-facing screen. Classification is not a caller of this module. Do not wrap the shared model client, or Classification would be traced with the listing-copy jobs.
- FastAPI only (ADR 0001). ADR 0016 still holds: Bulk SEO is listing copy refresh per product, and tracing must not block that job.

## Testing Decisions

- Test external behaviour of the listing-copy trace module, not Langfuse HTTP, prompt wording, OpenAI, or React layout.
- The module is the test surface. A good test puts a job, a text prompt, a completion or an error, identity, and a fake sink in, and asserts the stored trace, the omitted image, the mark, or a dropped export. The fake sink can fail on command.
- Cases that must exist: a generate call stores text, completion, model, latency, tokens, photo id, and group id; an image part is omitted; a missing token count still stores the trace; a model error stores the error and any partial text; a sink failure returns success to the caller and records nothing; missing keys record nothing; a field regenerate is named with the field; a Bulk SEO call is a different job from refresh and carries the pack id; two Bulk SEO calls in one pack share that pack id; an exact field accept is unchanged; a changed field is edited and stores the accepted text; tags and AEO use list and pair equality; a facts-block string that is not in the accept input does not flip the mark; an unparsable generate field accept is edited with the accepted text; a second regenerate supersedes only that field; refresh Accept marks accepted; refresh Dismiss marks dismissed and the module reports no listing-copy write; Bulk SEO Accept marks accepted; a missing current trace drops the mark; a refresh trace does not supersede a generate trace; Classification is not a job the module records on behalf of a shared client.
- Thin HTTP tests are optional and are not a second seam: refresh Dismiss returns success without persisting listing copy; an accept route still persists when the sink fails. Prior art: listing-copy-refresh module tests, product-facts accept tests, Bulk SEO module tests.
- Do not call Langfuse, OpenAI, or a query vendor from CI. Do not assert prompt prose.

## Out of Scope

- Classification, quick preview, and other vision calls that run before listing copy
- Moving prompts into Langfuse, or editing prompts from the Langfuse UI
- Storing the product photo or other media on the trace
- A seller-facing trace, score, or “why this copy” panel
- An edit step on listing copy refresh or Bulk SEO
- A dismiss control on Bulk SEO, or marking a Bulk SEO trace because the seller left the page
- A timer that turns an open trace into abandoned
- Auto-deleting traces
- Provisioning the Railway Langfuse service, its disks, or its login (the API only consumes host and keys)
- Langfuse Cloud, or a VM outside Railway
- Changing the generate gate, refresh gate, Bulk SEO eligibility, description-block stamping, or Allowance
- Push, Website, Inventory, or Import
- A database table for traces or packs

## Further Notes

- Glossary: **listing copy**, **listing copy refresh**, **Bulk SEO**, **product**, **photo**, **confirmed facts**, **GPSR identity**, **Allowance**. The trace is operator tooling, not a seller term, and it stays out of `CONTEXT.md`.
- ADRs: 0024 (self-hosted Langfuse on Railway, fail-open, text only), 0016 (Bulk SEO reuses refresh and tracing must not block it), 0001 (FastAPI), 0002 (facts gate), 0007 (rules on the server).
- Deploying Langfuse on Railway is a human step after this spec. It is not a ticket that an agent can finish alone.
- After this spec: split into tracer-bullet tickets with blocking edges (`/to-tickets`). Do not implement from this file in one shot.
