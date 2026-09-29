# CI/CD for one ship path

**Purpose:** Turn "we need CI/CD" into one specific case an implementer can build. The decision riding on this is which single path — from a ready change to a running app — gets automated first, what must pass, and where a green run goes.

**From:** the person commissioning the pipeline, **To:** the developer who ships new features and fixes bugs, **How your answers will be used:** written up as the CI/CD request, with no second meeting to interpret them.

## Context

SnapSync is a Vite SPA plus a FastAPI API. The SPA build is set up for Vercel (`npm ci`, `npm run build`, output in `dist/public`). The API is a Docker image aimed at Railway; on start it runs database migrations, then serves the API, and Railway checks `/api/health`. Local checks that already exist are `npm test`, `npm run check`, and `npm run test:api`. The only GitHub Actions workflow today opens incident-fix work. It does not test a change or deploy it. We are not asking you to design a platform. We need the one ship you already do, named tightly enough to automate.

## How to answer

No fixed deadline. About 15–20 minutes. Answer the specific case you would want automated on the next feature or bugfix you ship. Partial answers are useful. If you are unsure, say what you are unsure about instead of skipping the question.

## The one case

### Which single change you shipped recently should this pipeline have carried?

_Why this matters: we automate one case. A wish list of pipelines is not usable._

> The uncommitted sidebar work (`client/src/components/ui/sidebar.tsx` and friends). Pushed as it is, `npm run check` fails on `client/src/App.tsx` line 137 (`defaultOpen` no longer accepted), and today it would still deploy. The pipeline must turn that push red and keep it off `www` and `api`. (By build time, GitHub's `main` already carried the sidebar work with that error fixed, so the red run was proven on a deliberate type error instead, in a throwaway pull request: #42.) everyti e we aff a new feature, this feature must be pytest at the backend, front end and before we alocate any cloud resource we must make sure it wont fail in production or cause significatn issues in production inlcuding billing

### What action starts that case?

_Why this matters: the pipeline needs one trigger, such as opening a pull request, merging to `main`, pushing a tag, or clicking a button._

> A push to `main` (how shipping happens today), and opening or updating a pull request.to test if feature are perfectly wirking

## Safe to ship

### Which of the checks you already run must be green before that change is safe to ship?

_Why this matters: name commands you trust today, such as `npm test`, `npm run check`, or `npm run test:api`. Do not list checks you wish existed._

> All three: `npm run check`, `npm test`, `npm run test:api`. All green on committed `main` on 2026-09-28, each in seconds.

### If one of those checks is red, is the change still allowed to reach sellers?

> No. A red run blocks the deploy.

## Where a green run goes

### When that case is green, which running app should change?

_Why this matters: the SPA can go to Vercel and the API can go to Railway. Name which of those this first case updates, or say that it should not deploy yet._

> Both. Vercel (`www`) and Railway (`api`) each wait for the checks to be green on that commit before deploying, using their own dashboard settings: Vercel "Deployment Checks" and Railway "Wait for CI". Pull request runs only check and report; Vercel previews stay as they are.

### Does a bugfix update the same app as a feature on this path?

> Yes, the same path, with no skip lane. The escape hatch in an emergency is a manual redeploy from the Vercel or Railway dashboard.

## The request to hand over

### What one sentence should we give an implementer as the whole request?

_Why this matters: if the case needs a second sentence, it is still too big for this first pipeline._

> Add a GitHub Actions workflow that runs `npm run check`, `npm test` and `npm run test:api` on every push to `main` and every pull request, and make Vercel production (`www`) and Railway `api` deploy only once that run is green.

### What must that sentence leave out?

> GitHub doing the deploying (and the tokens that needs); new checks such as lint, browser tests, or tests against the live site; deleting the stray Railway project `selfless-spirit` (a separate step); notifications beyond GitHub's default email on a red run; making the Vercel and Railway deploys wait for each other.

## Anything else?

Anything about how you ship that we did not ask, and that would change the sentence above?

> Checks can be green and one deploy can still fail (for example Railway's Docker build), leaving `www` newer than `api`. That already happens today; accepted for now, and the live-path check after a push is what notices it. Built in one session, not a spec.
