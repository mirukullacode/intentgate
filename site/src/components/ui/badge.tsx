import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-px font-mono text-[10.5px] uppercase tracking-[0.08em] leading-5 whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-line bg-panel text-muted",
        brand: "border-brand/30 bg-brand/5 text-brand",
        allowed: "border-allowed/30 bg-allowed/5 text-allowed",
        blocked: "border-blocked/30 bg-blocked/5 text-blocked",
        held: "border-held/30 bg-held/5 text-held",
        live: "border-allowed/30 bg-allowed/5 text-allowed",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
