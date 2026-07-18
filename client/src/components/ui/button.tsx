import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Borderless glow style: surfaces defined by soft shadows and inner hairlines,
  // spring-scale on press, glow ring on focus.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[transform,box-shadow,background-color,color] duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:shadow-[0_0_20px_-4px_hsl(var(--ring)/0.5)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_0_20px_-8px_hsl(var(--primary)/0.6),inset_0_1px_0_0_hsl(0_0%_100%/0.15)] hover:shadow-[0_0_28px_-6px_hsl(var(--primary)/0.75),inset_0_1px_0_0_hsl(0_0%_100%/0.2)] hover:brightness-110",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_0_20px_-8px_hsl(var(--destructive)/0.6),inset_0_1px_0_0_hsl(0_0%_100%/0.12)] hover:brightness-110",
        outline:
          // Borderless "soft surface": inner hairline via shadow instead of a stroke.
          "bg-foreground/[0.04] shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.08),inset_0_1px_0_0_hsl(0_0%_100%/0.06)] hover:bg-foreground/[0.08] hover:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.3),0_0_20px_-8px_hsl(var(--primary)/0.35)]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.05)] hover:bg-secondary/80",
        ghost: "hover:bg-foreground/[0.06]",
      },
      // Heights are set as "min" heights, because sometimes Ai will place large amount of content
      // inside buttons. With a min-height they will look appropriate with small amounts of content,
      // but will expand to fit large amounts of content.
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-lg px-3 text-xs",
        lg: "min-h-10 rounded-xl px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
