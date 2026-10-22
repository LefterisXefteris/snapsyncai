import { Link, useLocation } from "wouter";
import {
  Boxes,
  Download,
  ImagePlus,
  Package,
  Search,
  Settings,
} from "lucide-react";
import { UserButton } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import snapsyncaiLogo from "../assets/snapsyncai-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  WORKSPACE_NAV,
  activeWorkspaceNavId,
  type WorkspaceNavId,
} from "@/lib/workspace-nav";

const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

const NAV_ICONS: Record<WorkspaceNavId, typeof Package> = {
  products: Package,
  "new-listing": ImagePlus,
  import: Download,
  inventory: Boxes,
  "bulk-seo": Search,
  settings: Settings,
};

export function AppSidebar() {
  const [pathname] = useLocation();
  const activeId = activeWorkspaceNavId(pathname);
  const { toggleSidebar } = useSidebar();
  const primary = WORKSPACE_NAV.filter((item) => item.id !== "settings");
  const settings = WORKSPACE_NAV.find((item) => item.id === "settings");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-2">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <img
            src={snapsyncaiLogo}
            alt="SnapSync AI"
            className="w-7 h-7 rounded-md shrink-0 group-data-[collapsible=icon]:hidden"
          />
          <button
            type="button"
            className="hidden h-7 w-7 shrink-0 rounded-md group-data-[collapsible=icon]:inline-flex"
            onClick={toggleSidebar}
            aria-label="Toggle Sidebar"
          >
            <img src={snapsyncaiLogo} alt="" className="h-7 w-7 rounded-md" />
          </button>
          <div className="min-w-0 flex-1 truncate font-display text-sm font-bold tracking-tight group-data-[collapsible=icon]:hidden">
            SnapSync AI
          </div>
          <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {primary.map((item) => {
                const Icon = NAV_ICONS[item.id];
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={activeId === item.id}
                      tooltip={item.label}
                    >
                      <Link href={item.path} data-testid={`nav-${item.id}`}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {settings && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={activeId === settings.id}
                tooltip={settings.label}
              >
                <Link href={settings.path} data-testid={`nav-${settings.id}`}>
                  <Settings />
                  <span>{settings.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        <SidebarSeparator />
        <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center">
          {DEV_BYPASS_AUTH ? (
            <div className="w-6 h-6 rounded-full bg-muted" title="Local dev user" />
          ) : (
            <UserButton appearance={{ baseTheme: dark, elements: { avatarBox: "w-6 h-6" } }} />
          )}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
