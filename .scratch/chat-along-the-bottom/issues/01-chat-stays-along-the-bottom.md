# 01 — Chat stays along the bottom

**What to build:** On the signed-in workspace, Chat is always along the bottom of the content area, centered, overlaying the Destination. The seller sends a message and the real act still runs, on the one thread for that shop, the same thread on every Destination. Choose photos still starts each photo as its own draft product on New listing, the open Destination stays, and that choice does not add a turn. Each pick adds a sentence in the panel; a later pick stacks another; the sentences stay until the page reloads, and the drafts stay. There is no open button and no Close. The sidebar and every Destination stay as they are. The chat prototype, its other variants, and the variant switch are gone. ADR 0052.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] On every signed-in Destination, Chat is already along the bottom of the content area, centered. There is no open button and no Close. Chat is absent from the Landing page.
- [ ] The sidebar and every Destination stay as they are. Chat overlays the content area. Destinations gain no clearance padding.
- [ ] It sits with a short bottom margin. It is 40rem wide, at most the page width minus 2rem, and 24rem tall, at most the space above that margin. The corner radius is 1rem. The prototype bar's extra lift is gone.
- [ ] The panel is warm near-black, with a gold border at about 40% opacity and a gold shadow. "Chat", Choose photos, and Send use the gold accent. Send keeps dark text on gold. The seller's lines are gold bubbles with dark text. Chat's lines sit on a slightly lighter warm surface. The message field has a gold-tinted border. Only the existing gold accent is used.
- [ ] The panel is at opacity 0.6 until the pointer is on it or focus is inside it, including while the seller is typing, and then it is fully solid. The opacity fades over about 200ms. That fade is skipped when the seller prefers reduced motion. The message field is not focused on load.
- [ ] The words stay: Chat, Choose photos, Send, and the placeholder "Ask for an act". While a turn runs, the label stays Send and the button disables. "Chat is not available right now." and "That message didn't send." stay.
- [ ] Sending still runs the real act. The thread on screen is the shop's thread, including the separate workspace thread before a shop is connected. No sample thread is shown.
- [ ] Choosing photos still starts each photo as its own draft product on New listing and does not add a turn. A pick with no photos still yields "None of those are photos." A cancelled pick adds nothing. Dropping files on Chat does nothing.
- [ ] A later pick stacks another sentence. Nothing in the session clears those sentences. A reload does. The drafts stay either way. The page-helper test asserts that stack and those drafts, and there is no seller operation that clears the sentences.
- [ ] Chat does not invent listing copy. The unmounted workspace prototype stays.
