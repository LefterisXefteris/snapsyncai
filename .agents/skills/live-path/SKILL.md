---
name: live-path
description: >-
  Proves the live path before a change is shipped. Use when implementing a
  seller-facing feature, after code-review, before push to main, or before
  telling the user production has it.
---

# Live path

A change is **shipped** only after the **live path** is green. Push to `main` and "production has it" are that moment. Branch commits are not.

The live path is what a seller on `www` hits after deploy — not files in the diff, not OpenAPI, not an unauthenticated 401.

Read `CONTEXT.md`. Name the path in that glossary (Plan, Overflow, Allowance, listing copy, Channel).

## Steps

1. **Name the live path** in one seller-visible sentence.
   Done when: a seller action and what they must still see are named. Example: "Plan seller opens Settings and still sees the Plan meter, not Subscribe."

2. **Name the miss** — the false thing they would see if this path is absent.
   Done when: that lie is named. Example: "Settings shows Subscribe while an active Plan row exists."

3. **Get a red-capable check** for that miss. Write it if it does not exist. Run it once and confirm it can fail on *this* miss.
   Done when: one command has already run, and it would go **red** on the miss from step 2.

   A live-path check asserts the seller-visible result (subscribed Plan, Overflow confirm at 20/20, listing copy after confirmed facts). Auth-only 401s, schema dumps, and "the diff looks complete" are not this check.

4. **Run it green** on the change.
   Done when: that same command is green against the code that would deploy.

5. **Prove boot** when the path depends on schema, env, or process start.
   Done when: production boot applies the schema (Railway `alembic upgrade head` before uvicorn), and any origin/secret the path needs is named. If only a human can finish a step, stop and run `/wizard` — the live path is not green yet.

6. **Ship.** Push to `main` / tell the user production has it.
   Done when: steps 4 and 5 are green. Until then, keep the work unpushed.

## This week's miss

Overflow shipped. Settings treated any `/api/subscription/status` failure as free (`subscribed !== true` → Subscribe). Two holes, both a live-path miss:

- Production boot did not migrate, so `overflow_confirmed_month` 500'd the Plan lookup.
- `_plan_status` called `list_spends` with no import, so status still 500'd after the column existed.

The 401 tests were green. The live path was not. Checks that would have caught it: active Plan → `subscribed` true; Dockerfile CMD migrates before uvicorn.

## Relation

`/tdd` writes the check. `/code-review` checks Standards and Spec. This skill is the ship gate those two do not own: the running seller path is green, then `main`.
