import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

export type UploadProcessingMode =
  | "groupedPaid"
  | "groupedPreview"
  | "singlePaid"
  | "singlePreview";

const UploadRoutingState = Annotation.Root({
  fileCount: Annotation<number>,
  groupAsOne: Annotation<boolean>,
  hasActiveSubscription: Annotation<boolean>,
  mode: Annotation<UploadProcessingMode>,
});

const routeUploadGraph = new StateGraph(UploadRoutingState)
  .addNode("validate", async (state) => {
    if (state.fileCount <= 0) {
      throw new Error("No files uploaded");
    }
    return state;
  })
  .addNode("groupedPaid", async () => ({ mode: "groupedPaid" as const }))
  .addNode("groupedPreview", async () => ({ mode: "groupedPreview" as const }))
  .addNode("singlePaid", async () => ({ mode: "singlePaid" as const }))
  .addNode("singlePreview", async () => ({ mode: "singlePreview" as const }))
  .addEdge(START, "validate")
  .addConditionalEdges(
    "validate",
    (state) => {
      const shouldGroup = state.groupAsOne && state.fileCount > 1;
      if (shouldGroup && state.hasActiveSubscription) return "groupedPaid";
      if (shouldGroup && !state.hasActiveSubscription) return "groupedPreview";
      if (!shouldGroup && state.hasActiveSubscription) return "singlePaid";
      return "singlePreview";
    },
    {
      groupedPaid: "groupedPaid",
      groupedPreview: "groupedPreview",
      singlePaid: "singlePaid",
      singlePreview: "singlePreview",
    },
  )
  .addEdge("groupedPaid", END)
  .addEdge("groupedPreview", END)
  .addEdge("singlePaid", END)
  .addEdge("singlePreview", END)
  .compile();

export async function resolveUploadProcessingMode(input: {
  fileCount: number;
  groupAsOne: boolean;
  hasActiveSubscription: boolean;
}): Promise<UploadProcessingMode> {
  const result = await routeUploadGraph.invoke({
    fileCount: input.fileCount,
    groupAsOne: input.groupAsOne,
    hasActiveSubscription: input.hasActiveSubscription,
    mode: "singlePreview",
  });
  return result.mode;
}
