import { workspaceStubCopy, type WorkspaceNavId } from "@/lib/workspace-nav";

export function WorkspaceStubPage({ id }: { id: WorkspaceNavId }) {
  const copy = workspaceStubCopy(id);

  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <h1 className="font-display text-lg font-semibold">{copy.title}</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">{copy.body}</p>
    </div>
  );
}
