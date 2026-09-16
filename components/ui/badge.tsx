import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-transparent",
        secondary: "bg-secondary text-secondary-foreground border-transparent",
        destructive: "bg-destructive text-destructive-foreground border-transparent",
        success: "bg-success text-success-foreground border-transparent",
        warning: "bg-warning text-warning-foreground border-transparent",
        outline: "text-foreground bg-transparent border-border",
        accent: "bg-accent text-accent-foreground border-transparent",
        // Glass variants for dark mode
        glass: "bg-background/80 backdrop-blur-sm text-foreground border-border/50",
        "glass-primary": "bg-primary/15 text-primary border-primary/30",
        "glass-warning": "bg-warning/15 text-warning border-warning/30",
        "glass-success": "bg-success/15 text-success border-success/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };