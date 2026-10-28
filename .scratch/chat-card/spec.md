**Status:** ready-for-agent

# Chat card

## Problem Statement

Chat is a plain corner card. It opens when the pointer enters the pill, and the composer asks for a question. The seller cannot choose photos from the card, and a message cannot Group photos that are already selected on New listing. Choosing photos and Group already exist on New listing. The card should be a finished place to do those two acts, without becoming a Destination or a second canvas.

## Solution

Chat stays the corner card on the signed-in workspace. Click opens it. Close is a click. The header, the text thread, and the composer stay. Dark chrome stays. The composer invites an act, and Choose photos sits in that row.

Choose photos uses the file dialog. Each photo becomes its own draft product on this browser's New listing canvas. The open Destination stays. The drafts are not selected, and they are not added to a product page that is open. The card shows a sentence for that pick. Close or reload clears those sentences. The shop thread does not gain a turn. The control works while a turn is running.

A Group message runs only while New listing is open and at least two photos are selected. The canvas updates the way the dock's Group does. Chat's reply is a turn on the shop thread, and no Credit is spent. Any other Group message asks the seller to select them on New listing, and nothing groups.

## User Stories

1. As a seller, I want Chat to open when I click it, so that moving the pointer across the corner does not cover the page.
2. As a seller, I want Close to remain a click, so that I put the card away on purpose.
3. As a seller, I want the same corner card, with its header, text thread, and composer, so that Chat does not become a bar or a Destination.
4. As a seller, I want the dark workspace chrome left as it is, so that product photos still sit on a neutral field.
5. As a seller, I want the composer to invite an act, so that I am not asked to "ask a question."
6. As a seller, I want the field to stay named Message, so that the control is still a message.
7. As a seller, I want a Choose photos control in the composer row, so that I can pick files from the computer while the card is open.
8. As a seller, I want each chosen photo to start as its own draft product, so that a one-shot garment is a product without an extra step.
9. As a seller who already has drafts on New listing, I want new photos to join that canvas, so that the earlier drafts stay.
10. As a seller, I want those new drafts not to be selected, so that a later Group is a selection I make on New listing.
11. As a seller on Products, or on a product page, I want the Destination to stay put, so that choosing photos does not navigate me away.
12. As a seller on a product page, I want the files to become new drafts, so that they are not added to the product I happen to have open.
13. As a seller, I want a sentence in the card that says how many draft products are now on New listing, so that I know the pick landed.
14. As a seller who picks again, I want another sentence, so that each pick is its own result.
15. As a seller, I want those sentences to disappear when I close the card or reload, so that the card does not keep a private history.
16. As a seller, I want the shop thread to be unchanged by Choose photos, so that another browser does not claim drafts it does not have.
17. As a seller, I want a cancelled file dialog to do nothing, so that backing out leaves no sentence and no drafts.
18. As a seller who picks a file that is not a photo, I want that file skipped, so that only photos become drafts.
19. As a seller whose pick contains no photos, I want a sentence that says so, and no drafts, so that I can tell the pick failed.
20. As a seller whose pick mixes photos and other files, I want the sentence to count only the photos, so that the canvas and the sentence agree.
21. As a seller, I want Choose photos to work while a turn is running, so that Import or a message in progress does not block the file dialog.
22. As a seller, I want that in-progress turn left alone, so that choosing photos does not send a message or spend a Credit.
23. As a seller, I want a message that asks for photos, and brings no files, to tell me to use Choose photos, so that nothing is invented.
24. As a seller, I want that message to add a turn and create no drafts, so that the thread records the refusal and the canvas stays as it was.
25. As a seller, I want dropping files on the card to do nothing, so that drop stays a shortcut on New listing only.
26. As a seller, I want New listing's own Choose photos and drop to keep working, so that the canvas still has its original door.
27. As a seller with at least two photos selected on New listing, I want a Group message to make those photos one draft product, so that I can Group without using the dock button.
28. As a seller, I want that Group to be the same Group as the dock, so that unselected photos stay on their drafts.
29. As a seller, I want Chat's reply to be kept on the shop thread, so that I still see it after a reload.
30. As a seller, I want that Group to spend no Credit, so that assembling drafts stays free.
31. As a seller on any other Destination, I want a Group message to ask me to select at least two photos on New listing, so that a selection I can no longer see is not grouped.
32. As a seller who selected one photo, I want the same ask, so that Group still needs two photos.
33. As a seller who leaves New listing, I want the selection to be forgotten, so that a later message cannot group it.
34. As a seller, I want a Products selection to be ignored by Group, so that catalogue ticks are not draft photos.
35. As a seller, I want Add to… and Separate to stay on the dock, so that a message does not gain those acts.
36. As a seller, I want buying Credits, connecting or disconnecting a Channel, claiming a shop, and cancelling a Plan to stay on their pages, so that those boundaries do not move.
37. As a seller, I want the model to never pick my files, so that Choose photos is the file dialog I use.
38. As a seller on the Landing page, I want no Chat card, so that the card stays on the signed-in workspace.

## Implementation Decisions

- ADR 0051. ADR 0050 still holds for Credits, Channel connect and disconnect, Channel claim, and cancelling a Plan. ADR 0008 still holds: each photo starts as its own draft product, and Group extracts the selection onto a new draft. ADR 0041 still holds: the workspace stays dark.
- The card opens on click. Pointer enter does not open it. Close stays a click. The pill label stays Chat.
- The composer placeholder is **Ask for an act**. The field's accessible name stays Message. Choose photos is a button in the composer row, labeled **Choose photos**.
- Choose photos accepts the same files New listing already accepts. Other files are skipped. A cancelled dialog adds no sentence and no drafts.
- Intake appends one draft product per photo onto the canvas New listing already keeps in this browser. It does not select them, does not change Destination, and does not add them to the open product.
- Each successful pick, and a pick that yields no photos, adds one sentence in the open card. One photo: "1 draft product is on New listing." Several: "N draft products are on New listing." None: "None of those are photos." Close and reload clear every such sentence. They are not turns and they are not written to the shop thread.
- The file control does not call the Chat service. A turn in progress keeps running.
- A message whose act is choosing photos stores the turn "Use Choose photos." It creates no drafts and spends no Credit. This replaces the stored line "Choosing photos stays on the page." The model still does not receive files.
- A Group message carries the selected draft photo ids only while New listing is the open Destination and at least two are selected. The same rule as Bulk SEO ticks: another Destination sends the message without those ids. A Products selection is not included.
- The model may request Group. It is not shown the draft photo ids or the file bytes. The service groups only when that request arrives with two or more ids. The stored reply is "Those photos are one draft product." The result tells the client which ids were grouped. The client then runs the existing Group on this browser's canvas. Credits spent stay 0, and the shop is unchanged.
- With fewer than two ids, the stored reply is "Select at least two photos on New listing." The result groups nothing, and the canvas stays as it was.
- The selection lives only while New listing is open. It is not stored on the shop, and it is not sent after the seller leaves.
- Add to… and Separate are not message acts. Drop on the card does nothing.
- The card is not a test seam. Tests lock the two seams below.

## Testing Decisions

- Test external behavior. A good test asserts the drafts, the sentences, the message body, and the stored thread. It does not assert component structure or styling.
- The client page helper is the seam for Choose photos and for what a Group message carries. Prior art is the existing page-helper tests: a Bulk SEO selection is sent only on Bulk SEO, and another Destination sends the message alone. Choose photos follows that shape for draft photo ids, and it is also where files become drafts and local sentences.
- One photo becomes one draft and the singular sentence. Four photos become four drafts, unselected, appended after drafts already there. A non-photo is skipped. A pick of only non-photos yields the failure sentence and no drafts. A cancelled pick yields neither. Close clears the sentences. The helper does not write a thread.
- Two or more selected ids are included only when New listing is open. One id, an empty selection, and any other Destination omit them.
- When the service says those ids were grouped, the helper's canvas is the existing Group: the selected photos are one new draft, and unselected photos stay. When the service groups nothing, the canvas is unchanged.
- `ask` is the seam for the stored turn. Prior art is the Chat service tests: a browser act stores a fixed line, spends no Credit, and does not change the shop.
- A choose-photos act stores "Use Choose photos." and creates no drafts. Buying Credits, connecting or disconnecting a Channel, claiming a shop, and cancelling a Plan keep their current lines.
- A Group act with two or more ids stores "Those photos are one draft product.", returns those ids, spends no Credit, and does not change the shop. The model payload still has no draft photo ids and no file bytes.
- A Group act with fewer than two ids stores "Select at least two photos on New listing." and returns no ids.
- Click, the placeholder, and the Choose photos control are specified behavior, checked in the browser. They are not a test seam.

## Out of Scope

- A bottom bar, a new Destination, or a different thread per Destination.
- Pictures in the thread, or a stored turn for Choose photos.
- Remembering a New listing selection after the seller leaves that page.
- The model choosing files, or files riding along with a message.
- Adding photos to the open catalogue product.
- Add to…, Separate, or drop on the card.
- Vision that groups photos on its own.
- Moving the New listing canvas onto the server.
- Changing dark chrome, the Landing page, or the Credit rules.

## Further Notes

- The first Chat ticket opened this card on pointer enter. This spec replaces that with click. The stored line "Choosing photos stays on the page." is replaced by "Use Choose photos."
- Glossary: Chat, Destination, New listing, draft product, photo, Credit, Channel, Channel claim, Plan. Avoid agent, Conversation, upload, and chat card.
