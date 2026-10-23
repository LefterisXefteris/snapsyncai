# 04 — Ungrouped upload refuses above 20 vision analyzes

**Parent:** `.scratch/openai-spend-caps/spec.md`

**What to build:** Ungrouped upload of more than 20 files is refused before fan-out; grouped-as-one still one multimodal call. Existing coarser absolute max can stay or be reconciled here.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Ungrouped upload with 21 files is refused before vision fan-out
- [x] Ungrouped upload with 20 files still runs
- [x] Grouped-as-one path is unchanged (still one multimodal call)
- [x] Product `get_openai()` remains unwrapped by BudgetGuard
