# Secrets gate and `main` protection

CI job `secrets` (in `.github/workflows/ci.yml`) fails when:

1. Any committed file matches `.env` or `.env.*` except `.env.example` and `api-py/.env.example`
2. [gitleaks](https://github.com/gitleaks/gitleaks) finds secret content (those two example paths are allowlisted in `.gitleaks.toml`)

A red check alone does not block merge. Turn on branch protection so `main` requires a PR and the three CI jobs.

## Enable protection (checklist)

In GitHub → **Settings → Branches → Branch protection rules** (or **Rules → Rulesets**), for `main`:

- [ ] Require a pull request before merging
- [ ] Require status checks to pass before merging
- [ ] Require branches to be up to date before merging (recommended)
- [ ] Required checks: `web`, `api`, `secrets`  
  (If the UI lists them as `CI / web`, etc., select those. Names appear after the workflow has run once on a PR.)
- [ ] Do **not** enable “Do not allow bypassing the above settings” if you want admin break-glass (ADR 0044 / grill: admin bypass allowed)

## `gh` sketch (classic branch protection)

After the `secrets` job has appeared at least once on a PR, adjust owner/repo and exact check contexts if your UI shows `CI / …`:

```bash
OWNER=YOUR_ORG_OR_USER
REPO=snapsyncai

gh api -X PUT "repos/${OWNER}/${REPO}/branches/main/protection" \
  -H "Accept: application/vnd.github+json" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["web", "api", "secrets"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

If the API rejects `contexts`, switch to the newer `checks` array form from the GitHub branch-protection docs, using the exact check names from the Actions tab.

## Allowlisting a new env template

1. Add the path to the allowlist in the `Deny committed dotenv files` step in `.github/workflows/ci.yml`
2. Add the same path regex to `[allowlist].paths` in `.gitleaks.toml`
3. Keep real secrets in gitignored files (e.g. `.env.local`), never in templates
