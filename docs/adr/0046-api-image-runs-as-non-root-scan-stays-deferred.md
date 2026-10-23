# API image runs as non-root; image scan stays deferred

The production FastAPI image (root `Dockerfile` and `api-py/Dockerfile`, kept behaviour-identical) will run the process as a non-root `USER`. That is the only container-image hygiene we commit to for now. Digests, multi-stage runtime, CIS-style extras, and merge-gating on image scan stay out of scope. App-level security (Clerk, CORS, webhooks, env secrets) and ADR 0044’s secrets gate are unchanged: image scan remains outside that gate. The `USER` change ships in its own small PR, not mixed into unrelated product work.

**Considered:** defer all Dockerfile changes (leaves an avoidable root process); full container supply-chain program now (digests, multi-stage, Trivy in CI — fights “cheap hygiene” and reopens 0044); hardening Railway networking / broader API surface in the same decision (different threat model).
