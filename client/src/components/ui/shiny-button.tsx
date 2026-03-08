import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ShinyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  gradient?: string;
}

export const ShinyButton = React.forwardRef<HTMLButtonElement, ShinyButtonProps>(
  ({ children, className, gradient = "from-primary via-purple-500 to-primary", ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "relative px-8 py-4 rounded-xl font-bold text-white overflow-hidden group shadow-lg shadow-primary/25",
          className
        )}
        {...props}
      >
        <div className={cn("absolute inset-0 bg-gradient-to-r opacity-90 transition-opacity group-hover:opacity-100", gradient)} />
        
        {/* Shine effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-20 bg-gradient-to-r from-transparent via-white to-transparent -skew-x-12 translate-x-[-100%] group-hover:animate-shine" />
        
        <span className="relative z-10 flex items-center gap-2 justify-center">
          {children}
        </span>
      </motion.button>
    );
  }
);
ShinyButton.displayName = "ShinyButton";
