"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Activity, Lock, ShieldCheck, Siren } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NumberTicker } from "@/components/tweenly/number-ticker";
import { MODES, playground, type PlaygroundInfo } from "@/lib/playground";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * A strip under the hero that proves the playground is up right now: the model it runs,
 * how many runs happened recently, and the last few outcomes. Real data, refreshed every
 * 20 seconds. Renders a quiet fallback when the API is unreachable.
 */
export function LivePulse() {
  const [info, setInfo] = useState<PlaygroundInfo | null>(null);
  const [state, setState] = useState<"loading" | "live" | "offline">("loading");

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      playground
        .info()
        .then((i) => {
          if (cancelled) return;
          setInfo(i);
          setState("live");
        })
        .catch(() => {
          if (!cancelled) setState("offline");
        });
    void load();
    const id = window.setInterval(() => void load(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const runs = info?.runs ?? [];
  const blocked = runs.filter((r) => r.protected && !r.leaked && r.status === "done").length;
  const leaked = runs.filter((r) => r.leaked).length;

  return (
    <div className="mx-auto mt-6 max-w-5xl">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-line bg-panel/70 px-5 py-3.5 backdrop-blur">
        <span className="flex items-center gap-2 text-[13px]">
          {state === "loading" ? (
            <Skeleton className="h-5 w-24" />
          ) : state === "live" ? (
            <Badge variant="live">
              <span className="size-1.5 rounded-full bg-allowed shadow-[0_0_8px_var(--allowed)]" /> playground live
            </Badge>
          ) : (
            <Badge>playground waking up</Badge>
          )}
          {info && (
            <span className="hidden text-muted sm:inline">
              running <span className="font-mono text-text">{info.model}</span> against the real ArmorIQ API
            </span>
          )}
        </span>

        <span className="flex items-center gap-4 text-[13px] text-muted">
          <span className="flex items-center gap-1.5">
            <Activity className="size-3.5" />
            <NumberTicker value={runs.length} duration={0.8} className="text-text" /> recent runs
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-allowed" />
            <NumberTicker value={blocked} duration={0.8} className="text-text" /> protected
          </span>
          <span className="flex items-center gap-1.5">
            <Siren className="size-3.5 text-blocked" />
            <NumberTicker value={leaked} duration={0.8} className="text-text" /> leaks without it
          </span>
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <AnimatePresence initial={false}>
            {runs
              .slice(-6)
              .reverse()
              .map((r) => {
                const m = MODES.find((x) => x.mode === r.mode);
                return (
                  <motion.span
                    key={r.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    title={`${m?.driver} · ${m?.title} · ${r.leaked ? "leaked" : r.protected ? "protected" : "clean"}`}
                    className={`flex size-6 items-center justify-center rounded-full border text-[10px] ${
                      r.leaked
                        ? "border-blocked/50 bg-blocked/15 text-blocked"
                        : r.protected
                          ? "border-allowed/50 bg-allowed/15 text-allowed"
                          : "border-line bg-panel-2 text-muted"
                    }`}
                  >
                    {r.leaked ? <Siren className="size-3" /> : r.protected ? <Lock className="size-3" /> : "·"}
                  </motion.span>
                );
              })}
          </AnimatePresence>
          <Link href="/playground" className="ml-2 text-[13px] font-medium text-brand hover:underline">
            Run one →
          </Link>
        </div>
      </div>
    </div>
  );
}
