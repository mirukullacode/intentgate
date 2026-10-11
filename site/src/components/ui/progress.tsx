"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function Progress({
  value,
  indeterminate = false,
  className,
}: {
  /** 0 to 100. Ignored when indeterminate. */
  value?: number;
  /** Sweep continuously while the length of the task is unknown. */
  indeterminate?: boolean;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : value}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-panel-2", className)}
    >
      {indeterminate ? (
        <motion.div
          className="absolute inset-y-0 w-1/3 rounded-full bg-brand"
          animate={{ x: ["-100%", "300%"] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : (
        <motion.div
          className="h-full rounded-full bg-brand"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </div>
  );
}
