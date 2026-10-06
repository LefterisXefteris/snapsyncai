import { WORKSPACE_HOME_PATH } from "./workspace-nav";

const CHOSEN_KEY = "snapsync.workspaceChosen";
const CONNECT_FROM_KEY = "snapsync.connectFrom";

export type WorkspaceArrivalInput = {
  shopConnected: boolean;
  pathname: string;
  search: string;
  chosenPath: string | null;
  connectFrom: string | null;
};

export type WorkspaceArrival = {
  path: string;
  chosenPath: string;
  clearConnectFrom: boolean;
};

export type ShopifyConnectNotice = {
  title: string;
  description: string;
  variant?: "destructive";
};

const CONNECT_FAILURES: Record<string, string> = {
  invalid_shop: "Shopify sent an invalid shop domain. Please try connecting again.",
  invalid_hmac: "Shopify callback verification failed. Check the app callback URL and API secret.",
  missing_write_products: "SnapSync AI needs Shopify's write_products permission to create draft products.",
  missing_inventory_scopes: "Reconnect Shopify and approve product, inventory, and location access.",
  token_exchange_failed:
    "Shopify authorization succeeded, but SnapSync AI could not exchange the code for an access token.",
  not_configured: "Shopify OAuth is not configured for this deployment.",
};

function query(search: string): URLSearchParams {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw);
}

function withSearch(path: string, search: string): string {
  if (!search) return path;
  return `${path}${search.startsWith("?") ? search : `?${search}`}`;
}

export function workspaceArrival(input: WorkspaceArrivalInput): WorkspaceArrival {
  const shopify = query(input.search).get("shopify");
  const returning = shopify === "connected" || shopify === "error";

  if (returning && input.connectFrom) {
    if (input.pathname === input.connectFrom) {
      return {
        path: input.pathname,
        chosenPath: input.connectFrom,
        clearConnectFrom: true,
      };
    }
    return {
      path: withSearch(input.connectFrom, input.search),
      chosenPath: input.connectFrom,
      clearConnectFrom: false,
    };
  }

  if (returning) {
    return {
      path: input.pathname,
      chosenPath: input.pathname,
      clearConnectFrom: false,
    };
  }

  if (input.pathname !== WORKSPACE_HOME_PATH) {
    return {
      path: input.pathname,
      chosenPath: input.pathname,
      clearConnectFrom: false,
    };
  }

  return {
    path: WORKSPACE_HOME_PATH,
    chosenPath: WORKSPACE_HOME_PATH,
    clearConnectFrom: false,
  };
}

export function shopifyConnectNotice(search: string): ShopifyConnectNotice | null {
  const params = query(search);
  const shopify = params.get("shopify");
  if (shopify === "connected") {
    return {
      title: "Shopify Connected",
      description: "Your Shopify store is ready to receive products.",
    };
  }
  if (shopify === "error") {
    const reason = params.get("reason") ?? "";
    return {
      title: "Shopify Connection Failed",
      description: CONNECT_FAILURES[reason] ?? "Shopify could not be connected. Please try again.",
      variant: "destructive",
    };
  }
  return null;
}

export function readWorkspaceChoice(): { chosenPath: string | null; connectFrom: string | null } {
  return {
    chosenPath: sessionStorage.getItem(CHOSEN_KEY),
    connectFrom: sessionStorage.getItem(CONNECT_FROM_KEY),
  };
}

export function rememberWorkspaceChoice(path: string) {
  sessionStorage.setItem(CHOSEN_KEY, path);
}

export function rememberConnectFrom(pathname: string) {
  sessionStorage.setItem(CONNECT_FROM_KEY, pathname);
}

export function clearConnectFrom() {
  sessionStorage.removeItem(CONNECT_FROM_KEY);
}
