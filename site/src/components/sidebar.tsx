"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { docsUrl, site } from "@/lib/site";
import { cn } from "@/lib/utils";

export const TOC = [
  { id: "problem", label: "The problem" },
  { id: "mission", label: "Mission" },
  { id: "how", label: "How it works" },
  { id: "production", label: "In production" },
  { id: "voice", label: "Voice" },
  { id: "runs", label: "Where it runs" },
  { id: "findings", label: "Findings" },
  { id: "takeaways", label: "Takeaways" },
  { id: "writing", label: "Writing" },
] as const;

const NAV = [
  { href: "/", label: "Home" },
  { href: "/playground", label: "Playground", live: true },
  { href: docsUrl("quickstart"), label: "Docs", external: true },
  { href: site.github, label: "GitHub", external: true },
  { href: site.npm, label: "npm", external: true },
  { href: site.hackathonUrl, label: "Hackathon", external: true },
];

/**
 * Document-style sidebar: brand, audience toggle, primary nav, and an "on this page"
 * index that follows the reader. `audience` is lifted so the hero can switch copy.
 */
export function Sidebar({ audience, onAudience }: { audience: "human" | "agent"; onAudience: (a: "human" | "agent") => void }) {
  const [active, setActive] = useState<string>(TOC[0].id);

  useEffect(() => {
    const sections = TOC.map((t) => document.getElementById(t.id)).filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0, 1] },
    );
    for (const s of sections) io.observe(s);
    return () => io.disconnect();
  }, []);

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-0 flex h-screen flex-col gap-7 px-8 pt-14">
        <Link href="/" className="flex items-center gap-2.5 text-[19px] font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-text text-bg">
            <svg width="14" height="14" viewBox="0 0 32 32" aria-hidden>
              <path d="M9 22V10l7 6 7-6v12" stroke="currentColor" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          intentgate
        </Link>

        <div className="inline-flex w-fit rounded-md border border-line bg-panel p-0.5 text-[12.5px]">
          {(["human", "agent"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onAudience(a)}
              className={cn("rounded px-3 py-1 capitalize transition-colors", audience === a ? "bg-bg text-text shadow-sm" : "text-muted hover:text-text")}
            >
              {a}
            </button>
          ))}
        </div>

        <nav className="grid gap-2.5 text-[15px]">
          {NAV.map((n) => (
            <a
              key={n.label}
              href={n.href}
              target={n.external ? "_blank" : undefined}
              rel={n.external ? "noreferrer" : undefined}
              className="flex items-center gap-2 text-text/85 hover:text-text"
            >
              {n.href === "/" && <span className="-ml-4 size-1.5 rounded-sm bg-brand" />}
              {n.label}
              {n.live && <span className="size-1.5 rounded-full bg-allowed" />}
              {n.external && <ArrowUpRight className="size-3.5 text-muted" />}
            </a>
          ))}
        </nav>

        <div className="border-t border-dashed border-line" />

        <div>
          <div className="label mb-3">On this page</div>
          <ol className="grid gap-2 text-[14.5px]">
            {TOC.map((t) => (
              <li key={t.id} className="flex items-center gap-3">
                <span className={cn("h-px w-5 transition-colors", active === t.id ? "bg-brand" : "bg-line")} />
                <a href={`#${t.id}`} className={cn("transition-colors", active === t.id ? "text-text" : "text-muted hover:text-text")}>
                  {t.label}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </aside>
  );
}
