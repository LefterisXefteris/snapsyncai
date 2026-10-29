**Status:** ready-for-agent

# Chat runs the act, and Undo lasts nine seconds

## Problem Statement

Chat stalls. A message that already asks for an act the seller can perform on the shop often comes back as a question, and nothing is written. The seller has to answer again before the same act runs. When a write does land, there is no way to put the previous value back.

## Solution

A message that already carries the act and its inputs runs on that turn. Chat does not ask the seller to confirm. One missing input is asked, and nothing runs. Chat does not invent a price, a quantity, a fibre, or a legal fact. The page’s gates and Credit rules stay as they are.

**Undo** is a control on the reply that landed a rewindable write, shown for 9 seconds. Each such reply keeps its own control until that reply’s 9 seconds end. Using it puts that reply’s previous value back through the same page write, adds no turn, and spends no Credit. A reload clears the control and leaves the write. Push, Go live, delete, Import, and Accept have no Undo. A proposal is still dropped by dismiss.

## User Stories

1. As a seller, I want a message that already names the act and its inputs to run on that turn, so that Chat does not stall on a confirmation.
2. As a seller, I want no confirmation question when those inputs are already in the message, so that one message is enough.
3. As a seller whose message leaves out one required input, I want Chat to ask for that input and change nothing, so that the missing value is not invented.
4. As a seller, I want Chat to leave a price, a quantity, a fibre, and a legal fact unwritten when I did not supply them, so that the shop stays tied to what I said.
5. As a seller who names a product Chat cannot see, I want to be asked which product, so that a different product is not changed.
6. As a seller on a product page who means this product, I want that open product used, so that I do not have to repeat its name.
7. As a seller whose words match more than one product, I want to be asked which one, so that Chat does not pick.
8. As a seller on the catalogue, with no product page open, whose message needs a product and names none, I want to be asked to open its page or name it, so that nothing is written.
9. As a seller on the open product, I want “set the price to 19” to save that price and reply that it is the selling, so that the price lands in one turn.
10. As a seller, I want one message that names a price and a compare-at price to save both, so that I do not send a second message.
11. As a seller who sends only “19”, I want to be asked which Selling field, so that a bare number is not treated as a price.
12. As a seller who says “change the price” and gives no number, I want to be asked for the value, and nothing saved, so that a price is not invented.
13. As a seller who names a cost, a SKU, or a barcode and the value, I want that Selling field saved, so that those fields are the same kind of act as price.
14. As a seller, I want a Selling write to spend no Credit, so that setting a price stays free.
15. As a seller who gives a quantity and a reason, I want Inventory set to that quantity, so that stock lands in one turn.
16. As a seller who gives a quantity and no reason, I want to be asked for the reason, and no stock change, so that the page’s reason rule still holds.
17. As a seller who gives a reason and no quantity, I want to be asked for the quantity, and no stock change, so that a quantity is not invented.
18. As a seller whose product has no SKU, I want the existing Inventory refusal, so that Chat does not create a stock row.
19. As a seller who names publications, I want those publications set, so that availability lands in one turn.
20. As a seller who asks to change publications and names none, I want to be asked which publications, and nothing changed.
21. As a seller who names a publication the shop does not have, I want the existing refusal, so that an unknown name is not created.
22. As a seller who sends a complete Shop GPSR identity, I want it saved, so that the shop default lands in one turn.
23. As a seller who sends an incomplete Shop GPSR identity, I want to be told it is incomplete, and nothing saved.
24. As a seller who quotes words for a named listing-copy field, I want those words saved as typed listing copy, so that the quote lands in one turn.
25. As a seller who names the field and gives no words, I want to be asked what it should say, and nothing saved.
26. As a seller who gives words and no field, I want to be asked which part of the listing copy, and nothing saved.
27. As a seller who sends the facts the page would confirm, I want those facts confirmed, so that confirm facts lands in one turn.
28. As a seller whose facts message is missing a required fact, I want to be asked, and nothing confirmed, so that a legal fact is not invented.
29. As a seller who says “write the listing” once facts are confirmed, I want generate to run, so that the existing job still starts from Chat.
30. As a seller who says “write the listing” before facts are confirmed, I want the existing refusal, so that the facts gate still holds.
31. As a seller who accepts a proposal already in the thread, I want that Accept to spend one Credit under the shop’s Credit rules, so that Accept from Chat stays the same Accept.
32. As a seller who says accept when no proposal is in the thread, I want the existing refusal, and no Credit spent.
33. As a seller who starts listing copy refresh with the inputs the page demands, I want that job to run as it does today.
34. As a seller who starts Bulk SEO and names the products, or has ticked eligible ones, I want that job to run as it does today.
35. As a seller who starts Bulk SEO without naming products and without a tick, I want to be asked which products, and nothing started.
36. As a seller who dismisses a proposal already in the thread, I want it dismissed, so that dismiss stays the way a proposal is dropped.
37. As a seller who names a listing-copy field to regenerate after an Accept, I want that field regenerated under the existing Credit rule.
38. As a seller who asks to regenerate and names no field, I want to be asked which field, and nothing regenerated.
39. As a seller who says “put it live” when listing copy exists and the price is greater than zero, I want Go live to run, so that the existing Push still starts from Chat.
40. As a seller who says “put it live” when the page would refuse, I want that refusal, so that the gate still holds.
41. As a seller who names Shopify or Trendyol International for a Push, I want that Push to run under the existing rules for that Channel.
42. As a seller who says push and names no Channel where both are possible, I want to be asked which Channel, and nothing sent.
43. As a seller who says delete and names one product, I want that product deleted, so that delete still runs in one turn.
44. As a seller who starts Import, I want Import to start as it does today, so that the turn still ends once Import has started.
45. As a seller, I want buying Credits, connecting or disconnecting a Channel, claiming a shop, cancelling a Plan, and choosing photos to stay on the page, so that those boundaries do not move.
46. As a seller who Groups from Chat, I want Group to follow the existing New listing rule, so that this change does not grow a new canvas.
47. As a seller, I want one message that runs two acts to run them in order, so that a later refusal still stops what follows, as it does today.
48. As a seller whose Selling write just landed, I want an Undo control on that reply for 9 seconds, so that I can put the previous Selling back.
49. As a seller, I want that control to restore every Selling field that reply changed, so that a price and a SKU from one reply come back together.
50. As a seller whose price was empty before that reply, I want Undo to clear the price, so that “previous” includes empty.
51. As a seller whose Inventory write just landed, I want Undo to set the previous quantity, so that the stock count returns.
52. As a seller whose typed listing copy just landed, I want Undo to restore the previous words of that field, including empty.
53. As a seller whose confirm facts just landed, I want Undo to confirm the previous pack again, so that the facts return through the same confirm.
54. As a seller, I want a facts Undo to stale listing copy the same way any facts change does, so that Undo is not a special path around stale listing copy.
55. As a seller whose publications just changed, I want Undo to restore the previous set.
56. As a seller whose Shop GPSR identity just changed, I want Undo to restore the previous identity.
57. As a seller, I want Undo to spend no Credit and to add no turn, so that the thread stays the turns I sent.
58. As a seller, I want the open Destination to stay put when I use Undo, so that the control does not navigate.
59. As a seller, I want the control to disappear once the write-back has landed, so that the same reply cannot rewind twice.
60. As a seller whose write-back fails, I want the current value left as it is and the control kept until the 9 seconds end, so that I can try again inside the window.
61. As a seller who waits 9 seconds, I want the control gone and the write left as it landed, so that Undo does not linger.
62. As a seller who lands a second rewindable write while the first control is still showing, I want each reply to keep its own control until its own 9 seconds end, so that the stock control rewinds stock and the price control rewinds price.
63. As a seller who reloads during the 9 seconds, I want the control gone and the write kept, so that Undo is not remembered on the shop.
64. As a seller on another browser, I want no Undo control for a write this browser just made, so that the other browser only sees the shop as it stands.
65. As a seller, I want no Undo on a question, or on a refusal that wrote nothing, so that a reply that changed nothing has nothing to put back.
66. As a seller, I want no Undo on generate, listing copy refresh, Bulk SEO, dismiss, regenerate a field, or Group, so that a proposal is still dropped only by dismiss.
67. As a seller, I want no Undo on Push, Go live, delete, Import, or Accept, so that a send, a deletion, a started Import, and a spent Credit stay landed.
68. As a seller, I want the stored thread to keep the reply text and not the previous value, so that a later read of the thread cannot rebuild Undo.

## Implementation Decisions

- ADR 0053. ADR 0050 still holds for the page’s gates, Credits, one thread per shop, and the acts that stay in the browser. ADR 0052 still holds: Chat stays along the bottom.
- The model is instructed to name the act and the inputs the message already contains, and to ask in text, with no act, only when one required input is absent. It is instructed not to ask for confirmation, and not to invent a price, a quantity, a fibre, or a legal fact. Tests do not call the live model. They lock that instruction.
- The turn keeps today’s rule. A complete act runs. A missing input asks, and that call writes nothing. An ambiguous product asks. Gates, job caps, and Credit rules are unchanged. Browser acts still record their existing lines and do not run here. One message may still run several acts in order, and the first refusal still stops the later ones.
- A rewindable write is Selling, Inventory, typed listing copy, confirmed facts, publications, or Shop GPSR. When one lands, the turn result carries the previous value of what that reply changed, tied to that new reply. The stored thread stays role and text. A later read of the thread has no previous value.
- The panel holds those previous values in this browser. Each rewindable reply shows Undo for 9 seconds from the moment the reply is shown. A later message does not clear an earlier control. A reload reads the stored thread, finds no previous value, and shows no control. Another browser never receives the previous value.
- Undo calls the same page write that act already uses, with the previous value. It does not send a Chat message. Selling restores each field that reply changed, and an empty previous field is cleared. Inventory sets the previous quantity with the reason Undo. Typed listing copy writes the previous words, including empty. Confirm facts confirms the previous pack, and stale listing copy follows the existing facts rule. Publications restore the previous set. Shop GPSR restores the previous identity.
- A write-back that lands removes that control. A write-back that fails leaves the shop value and keeps the control until the 9 seconds end. Using Undo spends no Credit and does not change Destination.
- A question, a refusal that wrote nothing, generate, listing copy refresh, Bulk SEO, dismiss, regenerate a field, Group, Push, Go live, delete, Import, Accept, and the browser acts carry no previous value and show no control.
- The panel chrome is not a test seam. Tests lock the turn and the reply control.

## Testing Decisions

- Test external behavior. A good test asserts the stored thread, what was written, the previous value handed to the browser, and whether the control is present. It does not assert component structure or styling.
- The Chat turn is the seam for one-shot. Prior art is the existing Chat service tests: a Selling step with fields saves those fields and spends no Credit; a Selling step with no field asks which field and writes nothing; a missing product asks and writes nothing; Push, Go live, delete, Import, and Accept follow the gates they already have.
- A rewindable write that lands returns the previous value with that reply, and the stored thread text does not contain it. A missing input, a refusal that wrote nothing, and a non-rewindable act return no previous value. Two rewindable acts in one message return two previous values, each tied to its own reply.
- The model instruction is asserted as text: act when the inputs are present, ask only for one missing input, do not confirm, do not invent a price, a quantity, a fibre, or a legal fact.
- The reply control is the seam for Undo. Prior art is the existing page-helper tests, which lock what this browser remembers without writing the shop thread. Given a previous value and a clock, the control is present before 9 seconds and absent after. A second reply keeps the first control until the first deadline. A thread with no previous value shows no control. Activating the control yields the page write for that previous value and drops the control. A failed write-back keeps the control and does not claim the value changed.

## Out of Scope

- Guessing a price, a quantity, a fibre, a legal fact, or which product the seller meant.
- A typed “undo”, or one shared control that the next message clears.
- Storing Undo on the shop, or showing it after a reload or on another browser.
- Undoing Push, Go live, delete, Import, or Accept.
- Undoing generate, listing copy refresh, Bulk SEO, dismiss, regenerate a field, or Group. Dismiss stays the way a proposal is dropped.
- Changing Credit rules, the page’s gates, or which acts stay in the browser.
- A second parser that overrides the model when the model asks despite the instruction.

## Further Notes

- Glossary: Chat, Undo, Selling, Inventory, listing copy, confirmed facts, publications, Shop GPSR, Push, Go live, delete, Import, Accept, Credit, Channel. Avoid agent, revert, and undo message.
- ADR 0050’s line that a missing input is asked, and nothing runs, still holds when an input is absent. It no longer means Chat asks for confirmation before an act the message already fully asked for.
