# Secrets gate blocks merge to main

Gitignore alone does not stop a `.env.production` (or a pasted API key) from landing on `main`: those names were not ignored, and `main` had no branch protection. Merge to `main` therefore requires a CI `secrets` job that (1) denies committed dotenv paths except `.env.example` and `api-py/.env.example`, and (2) runs gitleaks on the full tree at the commit, with those example paths skipped for content rules. We run the gitleaks CLI in Actions rather than `gitleaks/gitleaks-action`, to avoid an org license secret. Local pre-commit hooks and broader DevSecOps (SAST, dependency audit, image scan) stay out of this gate.

**Considered:** gitignore-only (misses alternate dotenv names and in-source keys); `gitleaks-action` (license friction); TruffleHog or dual scanners (extra noise for v1); PR-diff-only scan (misses secrets already on the branch).
