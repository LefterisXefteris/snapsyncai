import { motion } from "framer-motion";
import { Command as CommandIcon } from "lucide-react";
import { dispatchAppCommand } from "@/lib/app-commands";

/**
 * Mobile command trigger. Desktop already exposes the same shortcut in the
 * workspace header, so this stays mobile-only and deliberately contains no
 * duplicated navigation, marketplace, or billing controls.
 */
export function GlassDock() {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0, filter: "blur(6px)" }}
      animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
      transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.15 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 md:hidden"
      data-testid="glass-dock"
    >
      <div className="glass-panel rounded-full p-1.5">
        <button
          data-testid="dock-command-palette"
          onClick={() => dispatchAppCommand("open-palette")}
          aria-label="Open command palette"
          className="h-9 rounded-full flex items-center gap-2 px-3.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
        >
          <CommandIcon className="w-4 h-4" />
          <span className="text-[11px] font-mono">⌘ K</span>
        </button>
      </div>
    </motion.div>
  );
}
