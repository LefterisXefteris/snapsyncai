# Report overflow to Stripe after the spend commits

Status: needs-triage

## Problem

`settle_plan_job` (`api-py/app/services/plan_charge.py`) records an overflow spend with `overage_reported=False`, then `_flush_unreported_overage` calls `billing.report_overage` inside the same request, before `get_session` commits. If the commit then fails, Stripe has billed £0.70 and the `allowance_spends` row is rolled back: the seller is charged for a use SnapSync has no record of.

## Direction

Report after the commit (the unreported flag and `_flush_unreported_overage` already exist to retry). The accept module (`services/listing_copy_accept.py`) and website handoff are now the only callers of `settle_plan_job`, so the change has one place to land.

## Also

Backend pytest does not run in CI (`.github/workflows` has only `back-to-service-claude.yml`). The accept tests need `supabase start`; they skip without it.
