import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignedIn, SignedOut } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Landing from "@/pages/Landing";
import ProductDetails from "@/pages/ProductDetails";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";

// Clerk publishable key — baked in at build time via Vite env var.
// Falls back to fetching from the server API for environments where
// the env var isn't set (e.g. legacy deploys).
const VITE_CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

function AuthScreen() {
  return <Landing />;
}

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/product/:id" component={ProductDetails} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  return (
    <main className="flex-1 min-w-0 w-full min-h-screen">
      <AuthenticatedRouter />
    </main>
  );
}

function ClerkApp() {
  return (
    <>
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
      <ClerkProvider publishableKey={VITE_CLERK_KEY}>
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
    <ClerkProvider publishableKey={config.publishableKey}>
      <ClerkApp />
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="snapsyncai-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppWithClerk />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
