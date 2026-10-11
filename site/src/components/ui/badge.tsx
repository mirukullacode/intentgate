import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5 whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-line bg-panel text-muted",
        brand: "border-brand/40 bg-brand/10 text-brand",
        allowed: "border-allowed/40 bg-allowed/10 text-allowed",
        blocked: "border-blocked/40 bg-blocked/10 text-blocked",
        held: "border-held/40 bg-held/10 text-held",
        live: "border-allowed/40 bg-allowed/10 text-allowed",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
