"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Check, Copy, X } from "lucide-react";
import { useReducedMotion } from "./tweenly/use-reduced-motion";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

const PACKAGE = "intentgate-mcp";
const COMMAND = `npx ${PACKAGE} agent --hijacked`;
const STORAGE_KEY = "intentgate.banner.npm";
const DISMISS_EVENT = "ig-banner-dismiss";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(DISMISS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DISMISS_EVENT, onChange);
  };
}
const readDismissed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dismissed";
  } catch {
    return false;
  }
};

/**
 * A one-line announcement bar for the npm package, in the spirit of tweenly's Banner but
 * trimmed to the document idiom: thin rule, mono label, version badge read live from the
 * registry, one copyable command, dismissible and remembered.
 */
export function NpmBanner({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
  const [version, setVersion] = useState<string>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`https://registry.npmjs.org/${PACKAGE}/latest`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { version?: string } | null) => {
        if (!cancelled && d?.version) setVersion(d.version);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "dismissed");
    } catch {}
    window.dispatchEvent(new Event(DISMISS_EVENT));
  };
  const copy = async () => {
    await navigator.clipboard.writeText(COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <AnimatePresence initial={false}>
      {!dismissed && (
        <motion.div
          initial={reduced ? false : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          className={cn("overflow-hidden border-b border-line bg-panel/70", className)}
        >
          <div className="mx-auto flex h-9 max-w-[1400px] items-center gap-3 px-5 text-[12.5px]">
            <a href={site.npm} target="_blank" rel="noreferrer" className="label flex items-center gap-1.5 text-text">
              <span className="size-1.5 rounded-full bg-brand" />
              npm
              <AnimatePresence mode="wait" initial={false}>
                {version ? (
                  <motion.span
                    key={version}
                    initial={reduced ? false : { opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-sm border border-line bg-bg px-1.5 text-[10.5px] normal-case tracking-normal text-muted"
                  >
                    v{version}
                  </motion.span>
                ) : (
                  <span className="inline-block h-4 w-9 animate-pulse rounded-sm bg-panel-2" />
                )}
              </AnimatePresence>
            </a>
            <span className="hidden text-muted sm:inline">Try the attack from any terminal:</span>
            <button
              type="button"
              onClick={copy}
              className="group flex items-center gap-2 font-mono text-[12px] text-text hover:text-brand"
              aria-label={`Copy ${COMMAND}`}
            >
              <span className="text-muted">$</span>
              {COMMAND}
              {copied ? <Check className="size-3.5 text-allowed" /> : <Copy className="size-3.5 text-muted group-hover:text-brand" />}
            </button>
            <a href={site.npm} target="_blank" rel="noreferrer" className="ml-auto hidden items-center gap-1 text-muted hover:text-text md:flex">
              View on npm <ArrowUpRight className="size-3.5" />
            </a>
            <button type="button" onClick={dismiss} aria-label="Dismiss" className="-mr-1 flex size-7 items-center justify-center text-muted hover:text-text">
              <X className="size-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
