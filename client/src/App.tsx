import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignedIn, SignedOut, SignIn } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Landing from "@/pages/Landing";
import { Loader2 } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";

function AuthScreen() {
  return <Landing />;
}

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 min-w-0">
          <AuthenticatedRouter />
        </main>
      </div>
    </SidebarProvider>
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
    <ThemeProvider defaultTheme="system" storageKey="listai-theme">
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
