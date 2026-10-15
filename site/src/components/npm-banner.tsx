"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, Check } from "lucide-react";
import { useReducedMotion } from "./tweenly/use-reduced-motion";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

const PACKAGE = "intentgate-mcp";
const COMMANDS = [
  { cmd: `npx ${PACKAGE} agent --hijacked`, note: "the attack, blocked" },
  { cmd: `npx ${PACKAGE} init`, note: "protect Claude Desktop" },
];

/**
 * A short, dark install card in the spirit of tweenly's hero: brand mark, one line, and
 * the `$ npx …` pill with the accent dollar sign. Version is read live from the registry.
 */
export function NpmCard({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const [version, setVersion] = useState<string>();
  const [copied, setCopied] = useState<string>();

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

  const copy = async (cmd: string) => {
    await navigator.clipboard.writeText(cmd);
    setCopied(cmd);
    setTimeout(() => setCopied(undefined), 1500);
  };

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn("scheme-dark relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#0b0b10] p-5 text-text sm:p-6", className)}
    >
      {/* warm corner glow, like the reference */}
      <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(10,61,255,0.35),transparent_60%)]" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
            <span className="flex size-6 items-center justify-center rounded-md bg-white text-black">
              <svg width="12" height="12" viewBox="0 0 32 32" aria-hidden>
                <path d="M9 22V10l7 6 7-6v12" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {PACKAGE}
          </span>
          <a href={site.npm} target="_blank" rel="noreferrer" className="label flex items-center gap-1.5 text-text/70 hover:text-text">
            {version ? `v${version}` : <span className="inline-block h-3 w-8 animate-pulse rounded-sm bg-white/10" />} on npm <ArrowUpRight className="size-3" />
          </a>
        </div>

        <p className="mt-4 text-[1.5rem] font-medium leading-[1.15] tracking-[-0.02em] sm:text-[1.8rem]">
          One package.
          <br />
          <span className="text-text/60">Any MCP client.</span>
        </p>

        <div className="mt-5 grid gap-2">
          {COMMANDS.map((c) => (
            <button
              key={c.cmd}
              type="button"
              onClick={() => copy(c.cmd)}
              aria-label={`Copy ${c.cmd}`}
              className="group flex items-center gap-3 rounded-md border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-left font-mono text-[13px] transition-colors hover:border-white/20"
            >
              <span className="text-[#5b7cff]">$</span>
              <span className="shrink-0 whitespace-nowrap">{c.cmd}</span>
              <span className="ml-auto hidden truncate text-[11px] font-sans text-text/50 lg:inline">{c.note}</span>
              <span className="w-4 shrink-0 text-text/40 group-hover:text-text/80">
                {copied === c.cmd ? <Check className="size-3.5 text-allowed" /> : <span className="text-[11px]">⌘C</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
