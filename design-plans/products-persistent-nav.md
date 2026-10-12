# Products: persistent nav

- Destination: Products
- Region: persistent nav
- Commit: e1c4101d3957a20d849d2b6905479b5fbe6c93bd
- Contract: ADR 0005 states that the authenticated app is a persistent nav whose home is Products. This correction does not change that sentence. The confirmed chrome is the contract for what the seller sees around the destination list.
- Owner: `AppSidebar` in `client/src/components/app-sidebar.tsx`
- Also reaches: the product page, New listing, Import, Inventory, the Website page, Bulk SEO, Conversation, and Settings. This is the one nav on every destination.
- Correction: Change `AppSidebar` only. Leave the destination list, order, words, and icons as they are, including Settings in the footer. Leave the widths (16rem open, 3rem collapsed, 18rem on a phone), the open-rail-sheet rules, the 7-day memory, the edge toggle, and the B key. Leave the phone button in the page header (`AuthenticatedLayout` in `client/src/App.tsx`). When the nav is open, the header is the logo as a mark (not a link and not a button), the words "SnapSync AI", and the existing collapse button. Remove the line "workspace". When the nav is collapsed to the rail, the header is the logo, and pressing it expands the nav; the name and the collapse button are hidden there. The footer is the account button. Remove the Plan badge. Plan stays on Settings.

## Executor

1. Change the owner so this destination shows the correction. Keep the edit on this destination.
2. When the correction changes an ADR sentence about what the seller sees, amend that ADR.
3. Open this destination in the running workspace and confirm the corrected presentation.
