import mod from "../dist/index.cjs";
import { QueueClient } from "@vercel/queue";

const queue = new QueueClient();
const processInventoryQueueMessage = mod.processInventoryQueueMessage;

export const config = {
  maxDuration: 60,
};

export default queue.handleNodeCallback(
  async (message) => {
    if (typeof processInventoryQueueMessage !== "function") {
      throw new Error("Inventory worker is not available in the server bundle");
    }
    await processInventoryQueueMessage(message);
  },
  {
    visibilityTimeoutSeconds: 120,
    retry: (_error, metadata) => ({
      afterSeconds: Math.min(300, 2 ** Math.min(metadata.deliveryCount, 8)),
    }),
  },
);
