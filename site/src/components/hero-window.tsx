"use client";

import { useCallback, useState } from "react";
import { AttackFeed, ATTACK_ROWS } from "./attack-feed";
import { FadeIn } from "./tweenly/fade-in";

const tabs = ["Overview", "Sessions", "Policies", "Approvals", "Settings"];

/** The framed product window under the hero headline, in the style of the reference landing pages. */
export function HeroWindow() {
  const [shown, setShown] = useState(1);
  const onProgress = useCallback((n: number) => setShown(n), []);

  const rows = ATTACK_ROWS.slice(0, shown);
  const checked = rows.filter((r) => r.kind === "allow" || r.kind === "block").length;
  const blocked = rows.filter((r) => r.kind === "block").length;
  const signed = rows.some((r) => r.kind === "plan");

  return (
    <FadeIn direction="up" distance={40} duration={0.9} delay={0.35} scale={0.985}>
      <div className="scheme-dark window-ring relative mx-auto max-w-5xl overflow-hidden rounded-xl border border-white/[0.06] bg-[#0d0d13]">
        {/* Title bar */}
        <div className="flex h-11 items-center gap-3 border-b border-line px-4">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="ml-2 hidden items-center gap-2 rounded-md border border-line bg-panel px-2.5 py-1 font-mono text-[11.5px] text-muted sm:flex">
            <span className="size-1.5 rounded-full bg-allowed shadow-[0_0_8px_var(--allowed)]" />
            localhost:4747 · Flight Recorder
          </span>
          <span className="ml-auto flex items-center gap-2 text-[11.5px] text-muted">
            <span className="hidden sm:inline">session · poisoned-readme</span>
            <span className="flex size-6 items-center justify-center rounded-full bg-brand/20 text-[10px] font-semibold text-brand">MI</span>
          </span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-5 border-b border-line px-5 text-[12.5px] text-muted">
          {tabs.map((t, i) => (
            <span key={t} className={`py-2.5 ${i === 0 ? "border-b border-text text-text" : ""}`}>
              {t}
            </span>
          ))}
        </div>

        {/* Body */}
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_280px]">
          <div>
            <div className="mb-4 flex items-end justify-between">
              <h3 className="text-xl font-semibold tracking-tight">Overview</h3>
              <span className="text-[11.5px] text-muted">live</span>
            </div>

            {/* KPI row */}
            <div className="mb-4 grid grid-cols-3 gap-3 rounded-xl border border-line bg-panel p-3.5">
              <Kpi label="Calls checked" value={String(checked)} />
              <Kpi label="Blocked" value={String(blocked)} tone={blocked > 0 ? "blocked" : undefined} />
              <Kpi label="Decision time" value="0.6s" sub="ArmorIQ" />
            </div>

            <AttackFeed onProgress={onProgress} />
          </div>

          {/* Sidebar */}
          <aside className="hidden flex-col gap-3 lg:flex">
            <div className="rounded-xl border border-line bg-gradient-to-br from-[#7c5cf6] to-[#4f3bb8] p-4 text-[#f4f0ff]">
              <div className="text-[10.5px] uppercase tracking-wider opacity-80">Intent token</div>
              <div className="mt-2 font-mono text-[11px] leading-relaxed opacity-95">
                planHash 93124f9d…019f
                <br />
                Ed25519 · expires 5m
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2 py-0.5 text-[10.5px]">
                <span className={`size-1.5 rounded-full ${signed ? "bg-allowed" : "bg-held"}`} />
                {signed ? "signed" : "waiting for plan"}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-panel p-4 text-[12px]">
              <div className="text-[10.5px] uppercase tracking-wider text-muted">Client</div>
              <div className="mt-1.5 font-medium">Claude Desktop</div>
              <div className="mt-3 text-[10.5px] uppercase tracking-wider text-muted">Downstream servers</div>
              <div className="mt-1.5 grid gap-1 font-mono text-[11.5px] text-[#c9c9d6]">
                <span>workspace · stdio</span>
                <span>web · stdio</span>
              </div>
              <div className="mt-3 text-[10.5px] uppercase tracking-wider text-muted">Layers</div>
              <div className="mt-1.5 grid gap-1 text-[11.5px]">
                <span className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-brand" /> ArmorIQ policy and plan
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-brand" /> Argument binding
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-brand" /> Human approval
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </FadeIn>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "blocked" }) {
  return (
    <div>
      <div className="text-[10.5px] text-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums tracking-tight ${tone === "blocked" ? "text-blocked" : ""}`}>
        {value}
        {sub && <span className="ml-1.5 text-[11px] font-normal text-muted">{sub}</span>}
      </div>
    </div>
  );
}
