---
status: awaiting_human_verify
trigger: "upload-dropzone-broken: drag-and-drop upload area does not respond after Phase 7 changes"
created: 2026-04-06T00:00:00Z
updated: 2026-04-06T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Phase 7 mode state machine hides groups section and Analyze button when mode=choosing, making drops appear to do nothing
test: Verified dropzone wiring identical pre/post Phase 7; groups and button visibility gated on mode
expecting: Fix mode gating so groups + button visible in choosing mode
next_action: Apply fix to upload-zone.tsx

## Symptoms

expected: Dragging files onto the upload zone should accept them and show them in the UI
actual: Drop area doesn't respond at all — no visual feedback, no files accepted
errors: None reported
reproduction: Navigate to upload page, drag and drop image files
started: After Phase 7 (AI auto-grouping agent) changes to upload-zone.tsx

## Eliminated

- hypothesis: dropzone getRootProps/getInputProps/onDrop broken or disconnected
  evidence: Verified wiring identical pre/post Phase 7 (lines 453-457, 577-586). Build succeeds with no errors.
  timestamp: 2026-04-06

- hypothesis: useAutoGroup hook crashes component at runtime
  evidence: Hook only uses useState/useRef on init, no runtime errors possible. api.images.autoGroup exists in shared/routes.ts.
  timestamp: 2026-04-06

- hypothesis: TypeScript compilation error prevents component rendering
  evidence: tsc --noEmit shows no errors in upload-zone.tsx or use-auto-group.ts. Vite build succeeds.
  timestamp: 2026-04-06

- hypothesis: Radix ScrollArea blocks drag events
  evidence: ScrollArea was used before Phase 7 and drag worked. Viewport overflow styles don't block drag events.
  timestamp: 2026-04-06

- hypothesis: Module import failure (@shared/routes -> drizzle-orm in browser)
  evidence: Other client files already import @shared/routes successfully. Vite build produces working bundle.
  timestamp: 2026-04-06

## Evidence

- timestamp: 2026-04-06
  checked: git diff cf4ddfb..4d0896a of upload-zone.tsx
  found: Phase 7 added mode state machine (choosing/auto/manual), autoGroup hook, mode choice UI. Dropzone wiring unchanged.
  implication: Dropzone mechanism itself is not broken

- timestamp: 2026-04-06
  checked: Groups section visibility condition (line 678)
  found: Changed from `totalFiles > 0 && !isUploading` to `totalFiles > 0 && !isUploading && (mode === "manual" || (mode === "auto" && ...))`
  implication: Groups hidden when mode=choosing (initial state after file drop)

- timestamp: 2026-04-06
  checked: Analyze button visibility condition (line 874)
  found: Changed from `!isUploading` to `!isUploading && (mode === "manual" || (mode === "auto" && !autoGroup.isGrouping && groups.length > 0))`
  implication: Analyze button hidden when mode=choosing (initial state after file drop)

- timestamp: 2026-04-06
  checked: onDrop handler (lines 433-451) and chunkArray function
  found: onDrop creates groups correctly. Files accepted and state updated. But UI doesn't reflect it because groups section hidden.
  implication: Files ARE accepted but appear invisible due to mode gating

- timestamp: 2026-04-06
  checked: Vite production build
  found: Build succeeds, 2184 modules transformed, no errors
  implication: No compilation/bundling issues

## Resolution

root_cause: Phase 7 commits (9476678, 4d0896a) introduced a mode state machine (choosing/auto/manual) that gates the groups section and Analyze button visibility on mode !== "choosing". Since mode starts as "choosing" and only changes when user clicks "Auto-group with AI" or "Group manually", the initial file drop creates groups in state but the UI hides them. The user sees only the mode choice UI with no visible groups and no Analyze button, making the drop appear to have no effect.
fix: Added `if (mode === "choosing") setMode("manual")` at the top of the onDrop handler, and added `mode` to the useCallback dependency array. This ensures that when files are dropped, mode transitions from "choosing" to "manual" immediately, making the groups section and Analyze button visible. The mode choice UI (auto vs manual) still appears for IDB-restored images since that path doesn't go through onDrop.
verification: Vite build succeeds. TypeScript check passes. No new errors introduced.
files_changed: [client/src/components/upload-zone.tsx]
