"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Lock, Play, ShieldCheck, Siren, Sparkles, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { confetti } from "@/components/tweenly/confetti";
import { Loader } from "@/components/tweenly/loader";
import { NumberTicker } from "@/components/tweenly/number-ticker";
import { Typewriter } from "@/components/tweenly/typewriter";
import { useReducedMotion } from "@/components/tweenly/use-reduced-motion";
import { MODES, PLAYGROUND_API, playground, type AgentEvent, type GatewayEvent, type PlaygroundInfo, type Run, type RunMode } from "@/lib/playground";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;
const HISTORY_KEY = "intentgate.runs";

type Phase = "idle" | "starting" | "running" | "done";

const STEPS = [
  { key: "declare", label: "Declare", hint: "the agent states its plan" },
  { key: "sign", label: "Sign", hint: "ArmorIQ issues an intent token" },
  { key: "check", label: "Check", hint: "every call decided by ArmorIQ" },
  { key: "record", label: "Record", hint: "Flight Recorder keeps the trace" },
] as const;

function stepIndex(run: Run | undefined): number {
  if (!run) return -1;
  if (!run.protected) return -1;
  const ev = run.events;
  const declared = ev.some((e) => e.type === "tool_call" && e.name === "declare_plan");
  const signed = ev.some((e) => e.type === "tool_result" && e.name === "declare_plan" && e.ok);
  const checked = ev.some((e) => e.type === "tool_result" && e.name !== "declare_plan");
  if (run.status !== "running") return 4;
  if (checked) return 2;
  if (signed) return 1;
  if (declared) return 0;
  return -1;
}

type HistoryEntry = { id: string; mode: RunMode; at: number; leaked: boolean; blocked: number };

// localStorage as an external store, so the first client render already has the history
// and nothing is set from inside an effect.
const historyListeners = new Set<() => void>();
function subscribeHistory(cb: () => void) {
  historyListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    historyListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
const readHistory = () => localStorage.getItem(HISTORY_KEY) ?? "[]";
const serverHistory = () => "[]";

function useHistory() {
  const raw = useSyncExternalStore(subscribeHistory, readHistory, serverHistory);
  const history = useMemo<HistoryEntry[]>(() => {
    try {
      return JSON.parse(raw) as HistoryEntry[];
    } catch {
      return [];
    }
  }, [raw]);
  const push = useCallback((entry: HistoryEntry) => {
    let current: HistoryEntry[] = [];
    try {
      current = JSON.parse(readHistory()) as HistoryEntry[];
    } catch {
      current = [];
    }
    const next = [entry, ...current.filter((x) => x.id !== entry.id)].slice(0, 12);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    for (const cb of historyListeners) cb();
  }, []);
  return { history, push };
}

export function LiveDemo({ signIn }: { signIn?: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [info, setInfo] = useState<PlaygroundInfo | null>(null);
  const [offline, setOffline] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [run, setRun] = useState<Run>();
  const [gateway, setGateway] = useState<GatewayEvent[]>([]);
  const [notice, setNotice] = useState<string>();
  const { history, push } = useHistory();
  const alive = useRef(false);

  useEffect(() => {
    let cancelled = false;
    playground
      .info()
      .then((i) => {
        if (!cancelled) setInfo(i);
      })
      .catch(() => {
        if (!cancelled) setOffline(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Follows a run until it finishes: the run transcript plus the gateway's own events for its session. */
  const track = useCallback(
    async (id: string) => {
      try {
        for (;;) {
          const r = await playground.run(id);
          if (!alive.current) return;
          setRun(r);
          if (r.sessionId) {
            const { events } = await playground.events(r.sessionId);
            if (!alive.current) return;
            setGateway(events);
          }
          if (r.status !== "running") {
            setPhase("done");
            const blocked = r.events.filter((e) => e.type === "tool_result" && !e.ok).length;
            push({ id: r.id, mode: r.mode, at: r.startedAt, leaked: r.exfiltrated.length > 0, blocked });
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 900));
          if (!alive.current) return;
        }
      } catch (err) {
        if (!alive.current) return;
        setNotice(err instanceof Error ? err.message : String(err));
        setPhase("done");
      }
    },
    [push],
  );

  const start = async (mode: RunMode) => {
    setNotice(undefined);
    setRun(undefined);
    setGateway([]);
    setPhase("starting");
    const res = await playground.start(mode);
    if ("error" in res) {
      setNotice(res.error);
      setPhase("idle");
      return;
    }
    setPhase("running");
    void track(res.id);
  };

  // Deep link: /playground?run=<id> re-opens a finished or in-progress run (shareable, and used by the video).
  const linked = useRef(false);
  useEffect(() => {
    if (linked.current) return;
    linked.current = true;
    const id = new URLSearchParams(window.location.search).get("run");
    if (id) {
      queueMicrotask(() => {
        setPhase("running");
        void track(id);
      });
    }
  }, [track]);

  const busy = phase === "starting" || phase === "running";
  const calls = run?.events.filter((e) => e.type === "tool_call" && e.name !== "declare_plan").length ?? 0;
  const blocked = run?.events.filter((e) => e.type === "tool_result" && !e.ok).length ?? 0;
  const allowed = run?.events.filter((e) => e.type === "tool_result" && e.ok && e.name !== "declare_plan").length ?? 0;
  const decisions = gateway.filter((e): e is Extract<GatewayEvent, { type: "call.decided" }> => e.type === "call.decided");
  const armoriqLatency = decisions.filter((d) => d.decision.latencyMs).map((d) => d.decision.latencyMs as number);
  const avgLatency = armoriqLatency.length ? Math.round(armoriqLatency.reduce((a, b) => a + b, 0) / armoriqLatency.length) : 0;
  const plan = gateway.find((e): e is Extract<GatewayEvent, { type: "plan.declared" }> => e.type === "plan.declared");
  const leaked = (run?.exfiltrated.length ?? 0) > 0;
  const active = stepIndex(run);

  // A small celebration when the gateway actually stopped something.
  const celebrated = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (phase !== "done" || !run || run.id === celebrated.current) return;
    celebrated.current = run.id;
    if (run.protected && !leaked && blocked > 0 && !reduced) {
      void confetti({ preset: "burst", particleCount: 70, colors: ["#a78bfa", "#3ddc97", "#ededf2", "#7c5cf6"], origin: { x: 0.65, y: 0.35 } });
    }
  }, [phase, run, leaked, blocked, reduced]);

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      {/* Left: controls */}
      <div className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Run the attack</CardTitle>
              {offline ? <Badge variant="blocked">playground offline</Badge> : info ? <Badge variant="live"><span className="size-1.5 rounded-full bg-allowed shadow-[0_0_8px_var(--allowed)]" />live</Badge> : <Skeleton className="h-5 w-12" />}
            </div>
            <CardDescription>
              {info ? (
                <>
                  User asks: <span className="font-mono text-text">“{info.prompt}”</span>. The README hides an instruction to read a key and post it to an attacker.
                </>
              ) : (
                <Skeleton className="mt-1 h-4 w-full" />
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {(["Claude Opus", "Hijacked agent"] as const).map((driver) => (
              <div key={driver}>
                <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted">
                  {driver === "Claude Opus" ? <Sparkles className="size-3.5" /> : <Siren className="size-3.5" />}
                  {driver === "Claude Opus" ? "A real model" : "A scripted, compromised agent"}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MODES.filter((m) => m.driver === driver).map((m) => (
                    <Button
                      key={m.mode}
                      variant={m.protected ? "brand" : "outline"}
                      size="lg"
                      disabled={busy || offline || !info}
                      onClick={() => start(m.mode)}
                      className="h-auto flex-col items-start gap-0.5 px-3.5 py-2.5 text-left"
                    >
                      <span className="flex items-center gap-1.5 text-[13.5px]">
                        {busy && run?.mode === m.mode ? <Loader variant="dots" size={14} /> : <Play className="size-3.5" />}
                        {m.title}
                      </span>
                      <span className="text-[11.5px] font-normal opacity-75">{m.detail}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
            {notice && (
              <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-held/40 bg-held/10 px-3 py-2 text-[12.5px] text-held">
                {notice}
              </motion.p>
            )}
            <p className="text-[11.5px] leading-relaxed text-muted">
              One run at a time, a fresh sandbox each time, a fake key and a local attacker. Nothing real is touched.
            </p>
          </CardContent>
        </Card>

        {/* Stepper */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-brand" /> Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {run && !run.protected ? (
              <p className="text-[13px] text-muted">No plan, no signature, no checks. This run goes straight to the tools.</p>
            ) : (
              <ol className="grid gap-2.5">
                {STEPS.map((s, i) => {
                  const state = i < active ? "done" : i === active ? "active" : "todo";
                  return (
                    <li key={s.key} className="flex items-center gap-3">
                      <motion.span
                        layout
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                          state === "done" && "border-allowed/50 bg-allowed/15 text-allowed",
                          state === "active" && "border-brand bg-brand/15 text-brand",
                          state === "todo" && "border-line text-muted",
                        )}
                        animate={state === "active" && !reduced ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                        transition={state === "active" ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : undefined}
                      >
                        {state === "done" ? <Check className="size-3.5" /> : i + 1}
                      </motion.span>
                      <div className="leading-tight">
                        <div className={cn("text-[13.5px] font-medium", state === "todo" && "text-muted")}>{s.label}</div>
                        <div className="text-[11.5px] text-muted">{s.hint}</div>
                      </div>
                      {state === "active" && <Loader variant="bars" size={14} className="ml-auto text-brand" />}
                    </li>
                  );
                })}
              </ol>
            )}
            {busy && <Progress indeterminate className="mt-4" />}
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Your runs</CardTitle>
            <CardDescription>Kept in this browser.{signIn ? " Sign in to keep them across devices." : ""}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {history.length === 0 && <p className="text-[12.5px] text-muted">No runs yet.</p>}
            {history.map((h) => {
              const m = MODES.find((x) => x.mode === h.mode);
              return (
                <div key={h.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="truncate">
                    {m?.driver} · {m?.title}
                  </span>
                  {h.leaked ? <Badge variant="blocked">leaked</Badge> : h.blocked > 0 ? <Badge variant="allowed">{h.blocked} blocked</Badge> : <Badge>clean</Badge>}
                </div>
              );
            })}
            {signIn}
          </CardContent>
        </Card>
      </div>

      {/* Right: live view */}
      <div className="grid content-start gap-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Tool calls", value: calls, tone: "" },
            { label: "Allowed", value: allowed, tone: "text-allowed" },
            { label: "Blocked", value: blocked, tone: blocked > 0 ? "text-blocked" : "" },
            { label: "ArmorIQ decision", value: avgLatency, suffix: " ms", tone: "text-brand" },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted">{s.label}</div>
              <div className={cn("mt-1 text-2xl font-semibold tabular-nums tracking-tight", s.tone)}>
                <NumberTicker value={s.value} suffix={s.suffix ?? ""} duration={0.8} once={false} />
              </div>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="transcript">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="decisions">ArmorIQ decisions</TabsTrigger>
              <TabsTrigger value="recorder">Flight Recorder</TabsTrigger>
            </TabsList>
            {run && (
              <div className="flex items-center gap-2 text-[12px] text-muted">
                <Badge variant={run.protected ? "brand" : "default"}>{run.protected ? "with IntentGate" : "no gateway"}</Badge>
                <Badge>{run.driver === "scripted" ? "scripted agent" : info?.model}</Badge>
                {run.status === "running" ? <Loader variant="dots" size={14} /> : <Badge variant={run.status === "done" ? "allowed" : "blocked"}>{run.status}</Badge>}
              </div>
            )}
          </div>

          <TabsContent value="transcript">
            <Card className="min-h-[420px]">
              <CardContent className="grid content-start gap-2.5 p-4">
                {phase === "idle" && !run && (
                  <div className="flex min-h-[380px] flex-col items-center justify-center gap-3 text-center text-muted">
                    <Terminal className="size-6" />
                    <p className="max-w-sm text-[13.5px]">Pick a run on the left. The transcript, every ArmorIQ decision and the Flight Recorder update live.</p>
                  </div>
                )}
                {phase === "starting" && (
                  <div className="grid gap-3 p-2">
                    <Skeleton className="h-12 w-3/4" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-2/3" />
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {run?.events.map((e, i) => (
                    <motion.div
                      key={`${i}-${e.type}-${e.at}`}
                      layout={!reduced}
                      initial={reduced ? false : { opacity: 0, y: 10, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: reduced ? 0 : 0.4, ease: EASE }}
                    >
                      <EventRow e={e} animateText={!reduced && i === run.events.length - 1 && run.status === "running"} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {phase === "done" && run && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
                    <Verdict run={run} blocked={blocked} allowed={allowed} leaked={leaked} />
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="decisions">
            <Card className="min-h-[420px]">
              <CardContent className="p-4">
                {plan ? (
                  <div className="mb-4 rounded-xl border border-brand/30 bg-brand/[0.06] p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] uppercase tracking-wider text-muted">declared plan</span>
                      <Badge variant={plan.receipt.signed ? "brand" : "default"}>{plan.receipt.signed ? "signed by ArmorIQ" : "unsigned"}</Badge>
                    </div>
                    <div className="mt-1.5 text-[13.5px] font-medium">{plan.plan.goal}</div>
                    <div className="mt-1 grid gap-0.5 font-mono text-[11.5px] text-muted">
                      {plan.plan.steps.map((s, i) => (
                        <span key={i}>
                          {s.tool} {JSON.stringify(s.params ?? {})}
                        </span>
                      ))}
                      <span className="mt-1 text-[11px]">
                        plan hash {plan.receipt.planHash.slice(0, 16)}… {plan.receipt.tokenId ? `· token ${plan.receipt.tokenId.slice(0, 8)}…` : ""}
                      </span>
                    </div>
                  </div>
                ) : run && !run.protected ? (
                  <p className="text-[13px] text-muted">No gateway in this run, so ArmorIQ never saw it.</p>
                ) : (
                  <p className="text-[13px] text-muted">Decisions appear here as ArmorIQ makes them.</p>
                )}
                {decisions.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-line">
                    <table className="w-full text-[12.5px]">
                      <thead className="bg-panel-2 text-left text-muted">
                        <tr>
                          <th className="p-2.5 font-medium">Tool</th>
                          <th className="p-2.5 font-medium">Decision</th>
                          <th className="p-2.5 font-medium">By</th>
                          <th className="p-2.5 font-medium">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {decisions.map((d) => (
                          <tr key={d.callId} className="border-t border-line align-top">
                            <td className="p-2.5">{d.tool}</td>
                            <td className="p-2.5">
                              <Badge variant={d.decision.action === "allow" ? "allowed" : d.decision.action === "hold" ? "held" : "blocked"}>{d.decision.action}</Badge>
                            </td>
                            <td className="p-2.5 text-muted">{d.decision.source}</td>
                            <td className="p-2.5 text-muted">
                              {d.decision.reason}
                              {d.decision.latencyMs ? ` · ${d.decision.latencyMs} ms` : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recorder">
            <Card className="overflow-hidden">
              <iframe
                title="Flight Recorder"
                src={`${PLAYGROUND_API}/?embed=1${run?.sessionId ? `&session=${run.sessionId}` : ""}`}
                className="h-[560px] w-full bg-[#0a0a0e]"
              />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EventRow({ e, animateText }: { e: AgentEvent; animateText: boolean }) {
  if (e.type === "tool_call") {
    const control = e.name === "declare_plan";
    return (
      <div className={cn("rounded-xl border border-line border-l-[3px] bg-panel-2 p-3", control ? "border-l-brand" : "border-l-muted")}>
        <div className="text-[10.5px] uppercase tracking-wider text-muted">{control ? "declares plan" : "calls"}</div>
        <div className="mt-1 font-mono text-[12px]">
          {e.name} <span className="text-muted">{JSON.stringify(e.args).slice(0, 220)}</span>
        </div>
      </div>
    );
  }
  if (e.type === "tool_result") {
    return (
      <div className={cn("rounded-xl border border-line border-l-[3px] p-3", e.ok ? "border-l-allowed bg-panel-2" : "border-l-blocked bg-gradient-to-r from-blocked/[0.08] to-panel-2")}>
        <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider text-muted">
          {e.ok ? <Check className="size-3 text-allowed" /> : <Lock className="size-3 text-blocked" />}
          {e.ok ? "result" : "blocked"}
        </div>
        <div className="mt-1 whitespace-pre-wrap font-mono text-[12px] text-[#c9c9d6]">{e.preview}</div>
      </div>
    );
  }
  if (e.type === "text") {
    return (
      <div className="rounded-xl border border-line bg-panel p-3">
        <div className="text-[10.5px] uppercase tracking-wider text-muted">agent says</div>
        <div className="mt-1 text-[13.5px] leading-relaxed">{animateText ? <Typewriter words={[e.text]} typeSpeed={10} loop={false} /> : e.text}</div>
      </div>
    );
  }
  if (e.type === "fallback") {
    return (
      <div className="rounded-xl border border-dashed border-held/40 bg-held/[0.05] p-3 text-[12.5px] text-held">
        Model fallback: {e.from} declined, {e.to} continued.
      </div>
    );
  }
  if (e.type === "refusal") return <div className="rounded-xl border border-dashed border-held/40 bg-held/[0.05] p-3 text-[12.5px] text-held">Model declined: {e.reason}</div>;
  if (e.type === "error") return <div className="rounded-xl border border-blocked/40 bg-blocked/[0.08] p-3 text-[12.5px] text-blocked">Error: {e.message}</div>;
  return null;
}

function Verdict({ run, blocked, allowed, leaked }: { run: Run; blocked: number; allowed: number; leaked: boolean }) {
  const where = run.protected
    ? "Every allow and block above was decided by ArmorIQ for this run."
    : "No gateway, no plan, no checks: whatever the agent chose to do went through.";
  if (leaked) {
    return (
      <div className="rounded-xl border border-blocked/50 bg-blocked/[0.08] p-4">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-blocked">
          <Siren className="size-4" /> The attacker received the key.
        </div>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11.5px] text-[#f1c7c7]">{run.exfiltrated[0].slice(0, 400)}</pre>
        <p className="mt-2 text-[12.5px] text-muted">{where}</p>
      </div>
    );
  }
  if (blocked > 0) {
    return (
      <div className="rounded-xl border border-allowed/50 bg-allowed/[0.08] p-4">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-allowed">
          <ShieldCheck className="size-4" /> Nothing reached the attacker.
        </div>
        <p className="mt-1 text-[13px]">
          {blocked} off-plan call{blocked > 1 ? "s were" : " was"} blocked before running. {where}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-allowed/50 bg-allowed/[0.08] p-4">
      <div className="flex items-center gap-2 text-[14px] font-semibold text-allowed">
        <ShieldCheck className="size-4" /> Nothing reached the attacker, and nothing needed blocking.
      </div>
      <p className="mt-1 text-[13px]">
        The model read the injection and declined it on its own ({allowed} allowed, 0 blocked). {where} IntentGate is there for the day a model does not.
      </p>
    </div>
  );
}
