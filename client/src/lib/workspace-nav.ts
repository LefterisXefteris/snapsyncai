export type WorkspaceNavId =
  | "products"
  | "new-listing"
  | "import"
  | "inventory"
  | "bulk-seo"
  | "settings";

export type WorkspaceNavItem = {
  id: WorkspaceNavId;
  label: string;
  path: string;
  stub: boolean;
  emptyState?: string;
};

export const WORKSPACE_HOME_PATH = "/";

export const WORKSPACE_NAV: WorkspaceNavItem[] = [
  { id: "products", label: "Products", path: "/", stub: false },
  { id: "new-listing", label: "New listing", path: "/new", stub: false },
  {
    id: "import",
    label: "Import",
    path: "/import",
    stub: true,
    emptyState: "Importing products from a channel is not available yet.",
  },
  {
    id: "inventory",
    label: "Inventory",
    path: "/inventory",
    stub: false,
  },
  {
    id: "bulk-seo",
    label: "Bulk SEO",
    path: "/bulk-seo",
    stub: true,
    emptyState: "Changing listing copy for many products at once is not available yet.",
  },
  { id: "settings", label: "Settings", path: "/settings", stub: false },
];

const NAV_BY_ID = new Map(WORKSPACE_NAV.map((item) => [item.id, item]));

export function workspaceNavItem(id: WorkspaceNavId): WorkspaceNavItem {
  const item = NAV_BY_ID.get(id);
  if (!item) {
    throw new Error(`Unknown workspace nav id: ${id}`);
  }
  return item;
}

export function activeWorkspaceNavId(pathname: string): WorkspaceNavId | null {
  if (pathname === WORKSPACE_HOME_PATH || pathname.startsWith("/product/")) {
    return "products";
  }
  const match = WORKSPACE_NAV.find((item) => item.path !== WORKSPACE_HOME_PATH && pathname === item.path);
  return match?.id ?? null;
}

export function workspaceStubCopy(id: WorkspaceNavId): { title: string; body: string } {
  const item = workspaceNavItem(id);
  return { title: item.label, body: item.emptyState ?? "" };
}
