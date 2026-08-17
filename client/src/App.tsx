import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";
import { AmbientProvider } from "@/components/ambient/AmbientProvider";
import { AuroraBackground } from "@/components/ambient/AuroraBackground";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { lazy, Suspense, useEffect, useRef } from "react";

// Route-level code splitting: each page ships as its own chunk so the
// initial bundle stays small and loads fast.
const Products = lazy(() => import("@/pages/Products"));
const NewListing = lazy(() => import("@/pages/NewListing"));
const ImportPage = lazy(() => import("@/pages/Import"));
const InventoryPage = lazy(() => import("@/pages/Inventory"));
const BulkSeoPage = lazy(() => import("@/pages/BulkSeo"));
const Settings = lazy(() => import("@/pages/Settings"));
const Landing = lazy(() => import("@/pages/Landing"));
const ProductDetails = lazy(() => import("@/pages/ProductDetails"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Clerk publishable key — baked in at build time via Vite env var.
// Falls back to fetching from the server API for environments where
// the env var isn't set (e.g. legacy deploys).
const VITE_CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

// Ink/aurora Clerk theme — matches the ambient design tokens in index.css
const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: "hsl(45 70% 50%)",
    colorBackground: "hsl(0 0% 7%)",
    colorInputBackground: "hsl(0 0% 13%)",
    colorText: "hsl(0 0% 95%)",
    colorTextSecondary: "hsl(0 0% 63%)",
    borderRadius: "1rem",
    fontFamily: "'Instrument Sans', sans-serif",
  },
  elements: {
    card: "shadow-2xl backdrop-blur-2xl",
    formButtonPrimary: "shadow-[0_0_24px_-6px_hsl(45_70%_50%/0.5)]",
  },
};

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

function AuthScreen() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Landing />
    </Suspense>
  );
}

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Products} />
      <Route path="/new" component={NewListing} />
      <Route path="/import" component={ImportPage} />
      <Route path="/inventory" component={InventoryPage} />
      <Route path="/bulk-seo" component={BulkSeoPage} />
      <Route path="/settings" component={Settings} />
      <Route path="/product/:id" component={ProductDetails} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Clears all cached query data whenever the authenticated user changes.
// Prevents user A's data from being visible to user B after an account switch.
function CacheFlusher() {
  const { user } = useUser();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const currentId = user?.id ?? null;
    // undefined = first render (skip); null = signed out; string = signed in
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== currentId) {
      queryClient.clear();
    }
    prevUserIdRef.current = currentId;
  }, [user?.id]);

  return null;
}

// Warms lazy chunks during idle time so navigation feels instant without
// blocking the initial render.
function useIdlePreload() {
  useEffect(() => {
    const preload = () => {
      import("@/pages/ProductDetails");
      import("@/pages/NewListing");
      import("@/pages/Settings");
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preload, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(preload, 1500);
    return () => window.clearTimeout(id);
  }, []);
}

function AuthenticatedLayout() {
  useIdlePreload();

  return (
    <SidebarProvider className="min-h-svh">
      <AppSidebar />
      <SidebarInset className="min-h-svh min-w-0 overflow-hidden bg-transparent">
        <header className="flex h-12 items-center gap-2 px-2 md:hidden shrink-0">
          <SidebarTrigger />
        </header>
        <div className="flex-1 min-h-0 overflow-hidden">
          <Suspense fallback={<RouteFallback />}>
            <AuthenticatedRouter />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function ClerkApp() {
  // In dev bypass mode, skip Clerk sign-in gates and go straight to the app.
  if (DEV_BYPASS_AUTH) {
    return <AuthenticatedLayout />;
  }
  return (
    <>
      <CacheFlusher />
      <SignedOut>
        <AuthScreen />
      </SignedOut>
      <SignedIn>
        <AuthenticatedLayout />
      </SignedIn>
    </>
  );
}

function AppWithClerk() {
  // If the env var is present (recommended), mount immediately — no network round-trip.
  if (VITE_CLERK_KEY) {
    return (
      <ClerkProvider publishableKey={VITE_CLERK_KEY} appearance={clerkAppearance}>
        <ClerkApp />
      </ClerkProvider>
    );
  }

  // Legacy fallback: fetch the key from the server API.
  return <AppWithClerkFallback />;
}

function AppWithClerkFallback() {
  const { data: config, isLoading, error } = useQuery<{ publishableKey: string }>({
    queryKey: ["/api/auth/clerk-config"],
    retry: 3,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !config?.publishableKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-sm text-destructive">Authentication configuration error</p>
          <p className="text-xs text-muted-foreground">Please check your Clerk API keys.</p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={config.publishableKey} appearance={clerkAppearance}>
      <ClerkApp />
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" forcedTheme="dark" storageKey="snapsyncai-theme">
      <QueryClientProvider client={queryClient}>
        <AmbientProvider>
          <TooltipProvider>
            <AuroraBackground />
            {DEV_BYPASS_AUTH ? <AuthenticatedLayout /> : <AppWithClerk />}
            <Toaster />
          </TooltipProvider>
        </AmbientProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
