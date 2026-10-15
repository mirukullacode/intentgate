"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { HeroWindow } from "./hero-window";
import { LivePulse } from "./live-pulse";
import { NpmBanner } from "./npm-banner";
import { SetupPrompt } from "./setup-prompt";
import { Sidebar } from "./sidebar";
import { FadeIn } from "./tweenly/fade-in";
import { docsUrl } from "@/lib/site";

type Audience = "human" | "agent";

const COPY: Record<Audience, { h1: string; sub: string }> = {
  human: {
    h1: "intentgate is the gateway that makes any MCP agent keep its word.",
    sub: "The agent declares a plan, ArmorIQ signs it, and only calls inside that plan run. Available as an npm package, a one-command Claude Desktop or Cursor install, and an MCP endpoint for ElevenLabs voice agents.",
  },
  agent: {
    h1: "intentgate is an MCP server you place in front of your other MCP servers.",
    sub: "Install with npx intentgate-mcp init. Before any other tool, call declare_plan with the user's goal and the exact calls you will make. Your servers' tools appear as <server>__<tool>. Blocked calls return an error you should not retry.",
  },
};

const WORKS_WITH = ["Claude Desktop", "Cursor", "Claude Code", "ElevenLabs", "MCP", "ArmorIQ"];

/** Document layout: sticky sidebar on the left, one reading column on the right. */
export function LandingShell({ children }: { children: React.ReactNode }) {
  const [audience, setAudience] = useState<Audience>("human");
  const copy = COPY[audience];

  return (
    <>
      <NpmBanner />
      <div className="mx-auto grid max-w-[1400px] lg:grid-cols-[300px_1px_1fr]">
      <Sidebar audience={audience} onAudience={setAudience} />
      <div className="hidden bg-line lg:block" />

      <main className="min-w-0 px-5 pb-28 pt-12 sm:px-10 lg:px-14 lg:pt-16">
        {/* Mobile brand */}
        <div className="mb-8 flex items-center justify-between lg:hidden">
          <Link href="/" className="text-[18px] font-semibold tracking-tight">
            intentgate
          </Link>
          <Link href="/playground" className="label flex items-center gap-1.5 text-text">
            Playground <span className="size-1.5 rounded-full bg-allowed" />
          </Link>
        </div>

        {/* Hero */}
        <div className="max-w-[720px]">
          <FadeIn direction="up" distance={10} duration={0.5}>
            <Link href="/playground" className="inline-flex items-stretch border border-line text-[13px]">
              <span className="flex items-center gap-2 bg-panel px-3 py-1.5 text-muted">
                <span className="size-1.5 rounded-full bg-allowed" /> Live playground against the real ArmorIQ API
              </span>
              <span className="flex items-center gap-1.5 border-l border-line px-3 py-1.5 text-text">
                Run the attack <ArrowUpRight className="size-3.5" />
              </span>
            </Link>
          </FadeIn>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={audience}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <h1 className="mt-7 text-[2.1rem] font-medium leading-[1.12] tracking-[-0.025em] sm:text-[2.75rem]">{copy.h1}</h1>
              <p className="mt-5 text-[17px] leading-relaxed text-text/70">{copy.sub}</p>
            </motion.div>
          </AnimatePresence>

          <FadeIn direction="up" distance={10} duration={0.5} delay={0.15}>
            <div className="mt-7 flex flex-wrap gap-2">
              <Link
                href="/playground"
                className="label flex h-11 items-center gap-2.5 bg-brand px-5 text-white! transition-colors hover:bg-brand-strong"
              >
                <ArrowRight className="size-4" /> Run the attack live
              </Link>
              <a
                href={docsUrl("quickstart")}
                target="_blank"
                rel="noreferrer"
                className="label flex h-11 items-center gap-2 border border-brand/40 px-5 text-brand transition-colors hover:bg-brand/5"
              >
                Read the docs <ArrowUpRight className="size-3.5" />
              </a>
            </div>
            <div className="mt-2 max-w-[560px]">
              <SetupPrompt />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="label">Works with</span>
              {WORKS_WITH.map((w) => (
                <span key={w} className="text-[13.5px] font-medium text-text/70">
                  {w}
                </span>
              ))}
            </div>
          </FadeIn>
        </div>

        {/* Figure 1 */}
        <figure className="mt-12">
          <HeroWindow />
          <figcaption className="figure-caption mt-3">
            Figure 1 · The Flight Recorder during the poisoned-README attack: the plan ArmorIQ signed on the left, what the agent tried on the right.
          </figcaption>
        </figure>
        <LivePulse />

        {children}
      </main>
      </div>
    </>
  );
}
