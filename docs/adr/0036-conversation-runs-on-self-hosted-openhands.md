# The Conversation runs on self-hosted OpenHands

The **Conversation** model is a self-hosted OpenHands that SnapSync runs. The seller does not run it, and SnapSync holds the model key. From a typed message it may call the start and read operations that dialogue already performs, through those existing APIs. Accept, dismiss, regenerate, and Silence stay explicit seller acts; the model cannot call them. A job offer does not start the job. File editing and a terminal stay off. A tool call runs on the server as that seller. The model sees the tool result and does not see the Shopify token, the session cookie, or the model key. The **Website agent** uses the same hosted OpenHands, as [0037](./0037-website-agent-returns-html-on-openhands.md) records.

We rejected every seller-facing route as a tool, a shell on the API server, and a copy of OpenHands on the seller’s machine. We rejected a second chat beside the Conversation.
