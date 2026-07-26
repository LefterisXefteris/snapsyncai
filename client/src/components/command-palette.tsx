import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Upload,
  ClipboardList,
  Download,
  Crown,
  Boxes,
  Package,
  Home as HomeIcon,
  ShoppingCart,
} from "lucide-react";
import { SiShopify, SiEtsy, SiInstagram } from "react-icons/si";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useImages } from "@/hooks/use-images";
import { dispatchAppCommand, onAppCommand, type AppCommand } from "@/lib/app-commands";
import type { Image } from "@shared/schema";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { data: images } = useImages();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const offCommand = onAppCommand((cmd) => {
      if (cmd === "open-palette") setOpen(true);
    });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      offCommand();
    };
  }, []);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  const runCommand = (cmd: AppCommand) =>
    run(() => {
      if (window.location.pathname !== "/") navigate("/");
      // Let the Home page mount before it receives the command
      setTimeout(() => dispatchAppCommand(cmd), 50);
    });

  const products = (images ?? []).filter((img: Image) => img.title).slice(0, 40);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search products..." />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand("upload")} data-testid="cmd-upload">
            <Upload />
            Upload product photos
            <CommandShortcut>drop anywhere</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand("review-queue")} data-testid="cmd-review-queue">
            <ClipboardList />
            Open review queue
          </CommandItem>
          <CommandItem onSelect={() => runCommand("export-json")} data-testid="cmd-export-json">
            <Download />
            Export products as JSON
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Marketplaces">
          <CommandItem onSelect={() => runCommand("connect-shopify")} data-testid="cmd-connect-shopify">
            <SiShopify className="text-[#96BF48]" />
            Connect Shopify
          </CommandItem>
          <CommandItem onSelect={() => runCommand("connect-etsy")} data-testid="cmd-connect-etsy">
            <SiEtsy className="text-[#F56400]" />
            Connect Etsy
          </CommandItem>
          <CommandItem onSelect={() => runCommand("connect-amazon")} data-testid="cmd-connect-amazon">
            <ShoppingCart className="text-[#FF9900]" />
            Connect Amazon
          </CommandItem>
          <CommandItem onSelect={() => runCommand("connect-instagram")} data-testid="cmd-connect-instagram">
            <SiInstagram className="text-[#E1306C]" />
            Connect Instagram
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Workspace">
          <CommandItem onSelect={() => run(() => navigate("/"))} data-testid="cmd-go-home">
            <HomeIcon />
            Go to workspace
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/inventory"))} data-testid="cmd-inventory">
            <Boxes />
            Inventory Autopilot
          </CommandItem>
          <CommandItem onSelect={() => runCommand("subscribe")} data-testid="cmd-billing">
            <Crown />
            Billing & subscription
          </CommandItem>
        </CommandGroup>

        {products.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Jump to product">
              {products.map((img: Image) => (
                <CommandItem
                  key={img.id}
                  value={`product-${img.id} ${img.title ?? ""} ${img.category ?? ""}`}
                  onSelect={() => run(() => navigate(`/product/${img.id}`))}
                >
                  <Package />
                  <span className="truncate">{img.title}</span>
                  {img.price && (
                    <CommandShortcut className="font-mono">£{img.price}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
