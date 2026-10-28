# Choose photos may start from Chat

The seller may **Choose photos** from the open **Chat** card. Each photo starts as its own **draft product** on this browser's **New listing** canvas. The open **Destination** stays. That choice does not add a turn: a sentence in the card says the drafts are on New listing until the card closes or the page reloads. A message that asks for photos and brings no files asks the seller to use the control, and nothing is created. The control is not a message, so a turn in progress does not hold it. [0050](./0050-chat-is-a-card-beside-the-api.md) still holds for buying **Credits**, connecting or disconnecting a **Channel**, a **Channel claim**, and cancelling a **Plan**. The card opens on click.

A **Group** message runs only while New listing is open and at least two photos are selected. The reply is a turn on the shop thread, the canvas updates, and no Credit is spent. Any other Group message asks the seller to select them on New listing, and nothing groups. The selection is not kept after leaving New listing.

We rejected adding those files to the product page that is open, starting intake from a message, storing the Choose photos sentence on the shop thread, remembering a selection the seller can no longer see, letting the model pick the files, and opening the card when the pointer enters it.
