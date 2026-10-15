"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Lock, Play, Siren, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader } from "@/components/tweenly/loader";
import { NumberTicker } from "@/components/tweenly/number-ticker";
import { useReducedMotion } from "@/components/tweenly/use-reduced-motion";
import { MODES, PLAYGROUND_API, playground, type AgentEvent, type GatewayEvent, type PlaygroundInfo, type Run, type RunMode } from "@/lib/playground";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;
const HISTORY_KEY = "intentgate.runs";

type Phase = "idle" | "starting" | "running" | "done";

const STEPS = ["Declare", "Sign", "Check", "Record"] as const;

function stepIndex(run: Run | undefined): number {
  if (!run || !run.protected) return -1;
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
        const msg = err instanceof Error ? err.message : String(err);
        setNotice(msg.startsWith("404") ? "That run is no longer on the server. Start a new one." : msg);
        setRun(undefined);
        setPhase("idle");
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
  const latencies = decisions.map((d) => d.decision.latencyMs).filter((n): n is number => typeof n === "number");
  const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const plan = gateway.find((e): e is Extract<GatewayEvent, { type: "plan.declared" }> => e.type === "plan.declared");
  const leaked = (run?.exfiltrated.length ?? 0) > 0;
  const active = stepIndex(run);

  return (
    <div className="grid gap-10 lg:grid-cols-[340px_1fr]">
      {/* Controls */}
      <div className="grid content-start gap-8">
        <div>
          <div className="flex items-center justify-between">
            <span className="label">Run the attack</span>
            {offline ? <Badge variant="blocked">offline</Badge> : info ? <Badge variant="live">live</Badge> : <Skeleton className="h-4 w-10" />}
          </div>
          <p className="mt-3 text-[14px] leading-relaxed text-text/75">
            {info ? (
              <>
                The user asks <span className="font-mono text-[13px] text-text">&ldquo;{info.prompt}&rdquo;</span>. The README hides an instruction to read
                a key and post it to an attacker.
              </>
            ) : (
              <Skeleton className="h-4 w-full" />
            )}
          </p>
        </div>

        {(["Claude Opus", "Hijacked agent", "Voice agent"] as const).map((driver) => (
          <div key={driver} className={driver === "Voice agent" && info && !info.voice ? "hidden" : undefined}>
            <div className="label mb-2.5">
              {driver === "Claude Opus" ? "A real model" : driver === "Hijacked agent" ? "A scripted, compromised agent" : "A real voice agent, ElevenLabs"}
            </div>
            {driver === "Voice agent" && (
              <p className="mb-2.5 text-[12.5px] leading-relaxed text-muted">
                A scripted caller phones the support agent: order status, then a payout change, then a refund. You are the supervisor:
                when a plan change appears in the Flight Recorder tab, approve or deny it.
              </p>
            )}
            <div className={cn("grid gap-2", driver === "Voice agent" ? "grid-cols-1" : "grid-cols-2")}>
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
                    {busy && run?.mode === m.mode ? <Loader variant="dots" size={12} /> : <Play className="size-3.5" />}
                    {m.title}
                  </span>
                  <span className="text-[11.5px] font-normal opacity-70">{m.detail}</span>
                </Button>
              ))}
            </div>
          </div>
        ))}

        <AnimatePresence>
          {notice && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border-l-2 border-held pl-3 text-[13px] text-held"
            >
              {notice}
            </motion.p>
          )}
        </AnimatePresence>

        <p className="text-[12px] leading-relaxed text-muted">One run at a time, a fresh sandbox each time, a fake key and a local attacker. Nothing real is touched.</p>

        <div className="border-t border-line pt-6">
          <div className="flex items-center justify-between">
            <span className="label">Your runs</span>
            <span className="text-[11.5px] text-muted">kept in this browser</span>
          </div>
          <ul className="mt-3 grid gap-2">
            {history.length === 0 && <li className="text-[13px] text-muted">None yet.</li>}
            {history.map((h) => {
              const m = MODES.find((x) => x.mode === h.mode);
              return (
                <li key={h.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="truncate text-text/80">
                    {m?.driver} · {m?.title}
                  </span>
                  {h.leaked ? <Badge variant="blocked">leaked</Badge> : h.blocked > 0 ? <Badge variant="allowed">{h.blocked} blocked</Badge> : <Badge>clean</Badge>}
                </li>
              );
            })}
          </ul>
          {signIn}
        </div>
      </div>

      {/* Live view */}
      <div className="grid content-start gap-6">
        {/* Stepper */}
        <div className="flex items-center gap-3">
          {STEPS.map((s, i) => {
            const state = run && !run.protected ? "off" : i < active ? "done" : i === active ? "active" : "todo";
            return (
              <div key={s} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <motion.span
                    className={cn(
                      "size-2 rounded-full",
                      state === "done" && "bg-allowed",
                      state === "active" && "bg-brand",
                      (state === "todo" || state === "off") && "bg-line",
                    )}
                    animate={state === "active" && !reduced ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
                    transition={state === "active" ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : undefined}
                  />
                  <span className={cn("text-[12.5px]", state === "todo" || state === "off" ? "text-muted" : "text-text")}>{s}</span>
                </div>
                {i < STEPS.length - 1 && <span className="h-px w-6 bg-line" />}
              </div>
            );
          })}
          {run && !run.protected && <span className="ml-2 text-[12px] text-muted">no gateway in this run</span>}
          {busy && <Loader variant="dots" size={12} className="ml-auto text-muted" />}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
          {[
            { label: "Tool calls", value: calls, tone: "" },
            { label: "Allowed", value: allowed, tone: "text-allowed" },
            { label: "Blocked", value: blocked, tone: blocked > 0 ? "text-blocked" : "" },
            { label: "ArmorIQ decision", value: avgLatency, suffix: " ms", tone: "text-brand" },
          ].map((s) => (
            <div key={s.label} className="bg-bg px-4 py-3">
              <div className="label">{s.label}</div>
              <div className={cn("mt-1 text-[22px] font-medium tabular-nums tracking-tight", s.tone)}>
                <NumberTicker value={s.value} suffix={s.suffix ?? ""} duration={0.6} once={false} />
              </div>
            </div>
          ))}
        </div>
        {busy && <Progress indeterminate className="-mt-3 h-0.5" />}

        <Tabs defaultValue="transcript">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <TabsList>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="decisions">ArmorIQ decisions</TabsTrigger>
              <TabsTrigger value="recorder">Flight Recorder</TabsTrigger>
            </TabsList>
            {run && (
              <div className="flex items-center gap-1.5 pb-2">
                <Badge variant={run.protected ? "brand" : "default"}>{run.protected ? "with intentgate" : "no gateway"}</Badge>
                <Badge>{run.driver === "scripted" ? "scripted" : run.driver === "voice" ? "ElevenLabs agent" : info?.model}</Badge>
                {run.status !== "running" && <Badge variant={run.status === "done" ? "allowed" : "blocked"}>{run.status}</Badge>}
              </div>
            )}
          </div>

          <TabsContent value="transcript">
            <div className="grid min-h-[380px] content-start gap-2">
              {phase === "idle" && !run && (
                <div className="flex min-h-[340px] flex-col items-center justify-center gap-3 text-center text-muted">
                  <Terminal className="size-5" />
                  <p className="max-w-sm text-[13.5px]">Pick a run on the left. The transcript, every ArmorIQ decision and the Flight Recorder update live.</p>
                </div>
              )}
              {phase === "starting" && (
                <div className="grid gap-2">
                  <Skeleton className="h-11 w-3/4" />
                  <Skeleton className="h-11 w-full" />
                  <Skeleton className="h-11 w-2/3" />
                </div>
              )}
              <AnimatePresence initial={false}>
                {run?.events.map((e, i) => (
                  <motion.div
                    key={`${i}-${e.type}-${e.at}`}
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduced ? 0 : 0.35, ease: EASE }}
                  >
                    <EventRow e={e} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {phase === "done" && run && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
                  <Verdict run={run} blocked={blocked} allowed={allowed} leaked={leaked} />
                </motion.div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="decisions">
            <div className="min-h-[380px]">
              {plan ? (
                <div className="border-l-2 border-brand pl-4">
                  <div className="flex items-center gap-2">
                    <span className="label">declared plan</span>
                    <Badge variant={plan.receipt.signed ? "brand" : "default"}>{plan.receipt.signed ? "signed by ArmorIQ" : "unsigned"}</Badge>
                  </div>
                  <div className="mt-1.5 text-[14px] font-medium">{plan.plan.goal}</div>
                  <div className="mt-1 grid gap-0.5 font-mono text-[11.5px] text-muted">
                    {plan.plan.steps.map((s, i) => (
                      <span key={i}>
                        {s.tool} {JSON.stringify(s.params ?? {})}
                      </span>
                    ))}
                    <span className="mt-1">
                      plan hash {plan.receipt.planHash.slice(0, 16)}… {plan.receipt.tokenId ? `· token ${plan.receipt.tokenId.slice(0, 8)}…` : ""}
                    </span>
                  </div>
                </div>
              ) : run && !run.protected ? (
                <p className="text-[13.5px] text-muted">No gateway in this run, so ArmorIQ never saw it.</p>
              ) : (
                <p className="text-[13.5px] text-muted">Decisions appear here as ArmorIQ makes them.</p>
              )}
              {decisions.length > 0 && (
                <table className="mt-5 w-full border-t border-line text-[12.5px]">
                  <thead className="text-left text-muted">
                    <tr>
                      <th className="py-2 pr-3 font-normal">Tool</th>
                      <th className="py-2 pr-3 font-normal">Decision</th>
                      <th className="py-2 pr-3 font-normal">By</th>
                      <th className="py-2 font-normal">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {decisions.map((d) => (
                      <tr key={d.callId} className="border-t border-line align-top">
                        <td className="py-2 pr-3">{d.tool}</td>
                        <td className={cn("py-2 pr-3", d.decision.action === "allow" ? "text-allowed" : d.decision.action === "hold" ? "text-held" : "text-blocked")}>
                          {d.decision.action}
                        </td>
                        <td className="py-2 pr-3 text-muted">{d.decision.source}</td>
                        <td className="py-2 text-muted">
                          {d.decision.reason}
                          {d.decision.latencyMs ? ` · ${d.decision.latencyMs} ms` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="recorder">
            <RecorderView events={gateway} run={run} reduced={reduced} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EventRow({ e }: { e: AgentEvent }) {
  if (e.type === "tool_call") {
    const control = e.name === "declare_plan";
    return (
      <div className={cn("border-l-2 py-1.5 pl-3", control ? "border-brand" : "border-line")}>
        <div className="label">{control ? "declares plan" : "calls"}</div>
        <div className="mt-0.5 font-mono text-[12.5px]">
          {e.name} <span className="text-muted">{JSON.stringify(e.args).slice(0, 200)}</span>
        </div>
      </div>
    );
  }
  if (e.type === "tool_result") {
    return (
      <div className={cn("border-l-2 py-1.5 pl-3", e.ok ? "border-allowed" : "border-blocked")}>
        <div className="label flex items-center gap-1.5">
          {e.ok ? <Check className="size-3 text-allowed" /> : <Lock className="size-3 text-blocked" />}
          {e.ok ? "result" : "blocked"}
        </div>
        <div className="mt-0.5 whitespace-pre-wrap font-mono text-[12.5px] text-text/80">{e.preview}</div>
      </div>
    );
  }
  if (e.type === "text") {
    return (
      <div className="border-l-2 border-line py-1.5 pl-3">
        <div className="label">agent says</div>
        <div className="mt-0.5 text-[13.5px] leading-relaxed">{e.text}</div>
      </div>
    );
  }
  if (e.type === "caller") {
    return (
      <div className="border-l-2 border-brand/60 py-1.5 pl-3">
        <div className="label text-brand">caller says</div>
        <div className="mt-0.5 text-[13.5px] leading-relaxed">&ldquo;{e.text}&rdquo;</div>
      </div>
    );
  }
  if (e.type === "fallback") return <div className="border-l-2 border-held py-1.5 pl-3 text-[12.5px] text-held">Model fallback: {e.from} declined, {e.to} continued.</div>;
  if (e.type === "refusal") return <div className="border-l-2 border-held py-1.5 pl-3 text-[12.5px] text-held">Model declined: {e.reason}</div>;
  if (e.type === "error") return <div className="border-l-2 border-blocked py-1.5 pl-3 text-[12.5px] text-blocked">Error: {e.message}</div>;
  return null;
}

function Verdict({ run, blocked, allowed, leaked }: { run: Run; blocked: number; allowed: number; leaked: boolean }) {
  const where = run.protected
    ? "Every allow and block above was decided by ArmorIQ for this run."
    : "No gateway, no plan, no checks: whatever the agent chose to do went through.";
  if (leaked) {
    return (
      <div className="mt-2 border border-blocked/40 bg-blocked/5 p-4">
        <div className="flex items-center gap-2 text-[14px] font-medium text-blocked">
          <Siren className="size-4" /> The attacker received the key.
        </div>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11.5px] text-text/70">{run.exfiltrated[0].slice(0, 400)}</pre>
        <p className="mt-2 text-[12.5px] text-muted">{where}</p>
      </div>
    );
  }
  return (
    <div className="mt-2 border border-allowed/40 bg-allowed/5 p-4">
      <div className="flex items-center gap-2 text-[14px] font-medium text-allowed">
        <Check className="size-4" /> {blocked > 0 ? "Nothing reached the attacker." : "Nothing reached the attacker, and nothing needed blocking."}
      </div>
      <p className="mt-1 text-[13px] text-text/80">
        {blocked > 0
          ? `${blocked} off-plan call${blocked > 1 ? "s were" : " was"} blocked before running. ${where}`
          : `The model read the injection and declined it on its own (${allowed} allowed, 0 blocked). ${where} IntentGate is there for the day a model does not.`}
      </p>
    </div>
  );
}

/**
 * The Flight Recorder, rendered natively from the gateway's own events: the plan ArmorIQ
 * signed on the left, what the agent tried on the right. Same data as the hosted recorder,
 * without an iframe.
 */
function RecorderView({ events, run, reduced }: { events: GatewayEvent[]; run?: Run; reduced: boolean }) {
  const plan = [...events].reverse().find((e): e is Extract<GatewayEvent, { type: "plan.declared" }> => e.type === "plan.declared");
  const decided = events.filter((e): e is Extract<GatewayEvent, { type: "call.decided" }> => e.type === "call.decided");
  const completed = new Map(
    events.filter((e): e is Extract<GatewayEvent, { type: "call.completed" }> => e.type === "call.completed").map((e) => [e.callId, e]),
  );
  const held = events.filter((e): e is Extract<GatewayEvent, { type: "call.held" }> => e.type === "call.held");
  const amends = events.filter((e): e is Extract<GatewayEvent, { type: "plan.amend_requested" }> => e.type === "plan.amend_requested");
  const outcomes = new Map(
    events.filter((e): e is Extract<GatewayEvent, { type: "approval.resolved" }> => e.type === "approval.resolved").map((e) => [e.approvalId, e.outcome]),
  );
  const alerts = events.filter((e): e is Extract<GatewayEvent, { type: "voice.alert" }> => e.type === "voice.alert");

  // Local echo of a decision until the gateway's approval.resolved event arrives on the next poll.
  const [local, setLocal] = useState<Map<string, "approved" | "denied">>(() => new Map());
  const [deciding, setDeciding] = useState<string>();
  const decide = async (id: string, decision: "approved" | "denied") => {
    setDeciding(id);
    const ok = await playground.approve(id, decision);
    setDeciding(undefined);
    if (ok) setLocal((m) => new Map(m).set(id, decision));
  };

  if (!run) {
    return (
      <div className="flex min-h-[340px] flex-col items-center justify-center gap-3 text-center text-muted">
        <Terminal className="size-5" />
        <p className="max-w-sm text-[13.5px]">The recorder fills in as soon as a run starts.</p>
      </div>
    );
  }
  if (!run.protected) {
    return (
      <div className="flex min-h-[340px] flex-col items-center justify-center gap-2 text-center text-muted">
        <p className="text-[13.5px]">No gateway in this run, so there is nothing to record.</p>
        <p className="text-[12.5px]">The transcript tab shows what the agent did anyway.</p>
      </div>
    );
  }

  const open = run.sessionId ? `${PLAYGROUND_API}/?session=${run.sessionId}` : PLAYGROUND_API;

  return (
    <div className="grid gap-6 md:grid-cols-[300px_1fr]">
      <div>
        <div className="flex items-center justify-between">
          <span className="label">Declared intent</span>
          {plan && <Badge variant={plan.receipt.signed ? "brand" : "default"}>{plan.receipt.signed ? "signed by ArmorIQ" : "unsigned"}</Badge>}
        </div>
        {plan ? (
          <motion.div initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
            <div className="mt-2 text-[15px] font-medium leading-snug">{plan.plan.goal}</div>
            <ol className="mt-3 grid gap-2">
              {plan.plan.steps.map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-allowed/50 text-allowed">
                    <Check className="size-2.5" />
                  </span>
                  <span className="font-mono text-[12px] leading-relaxed">
                    {s.tool}
                    <span className="block text-muted">{JSON.stringify(s.params ?? {})}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-3 font-mono text-[11px] text-muted">
              plan hash {plan.receipt.planHash.slice(0, 14)}…{plan.receipt.tokenId ? ` · token ${plan.receipt.tokenId.slice(0, 8)}…` : ""}
            </div>
          </motion.div>
        ) : (
          <p className="mt-2 text-[13px] text-muted">Waiting for declare_plan…</p>
        )}
        <a href={open} target="_blank" rel="noreferrer" className="label mt-5 inline-block text-brand">
          Open in the Flight Recorder ↗
        </a>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className="label">What the agent tried</span>
          <span className="flex items-center gap-1.5">
            <Badge variant="allowed">{decided.filter((d) => d.decision.action === "allow").length} allowed</Badge>
            <Badge variant="blocked">{decided.filter((d) => d.decision.action === "block").length} blocked</Badge>
            {held.length + amends.length > 0 && <Badge variant="held">{held.length + amends.length} held</Badge>}
          </span>
        </div>
        <div className="mt-2 grid gap-2">
          <AnimatePresence initial={false}>
            {decided.map((d) => {
              const done = completed.get(d.callId);
              const allow = d.decision.action === "allow";
              return (
                <motion.div
                  key={d.callId}
                  initial={reduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className={cn("border-l-2 py-1.5 pl-3", allow ? "border-allowed" : "border-blocked")}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12.5px]">{d.tool.replace("__", "/")}</span>
                    <Badge variant={allow ? "allowed" : "blocked"}>{allow ? "allowed" : "blocked"}</Badge>
                    <span className="ml-auto text-[11px] text-muted">{done ? `${done.durationMs} ms` : d.decision.latencyMs ? `${d.decision.latencyMs} ms` : ""}</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[11.5px] text-muted">{JSON.stringify(d.args).slice(0, 160)}</div>
                  {allow && done && <pre className="mt-1.5 whitespace-pre-wrap font-mono text-[11.5px] text-text/75">{done.preview.slice(0, 200)}</pre>}
                  {!allow && (
                    <div className="mt-1 text-[12.5px] text-text/80">
                      <span className="font-medium">{d.decision.source === "armoriq" ? "ArmorIQ" : d.decision.source === "binding" ? "Argument binding" : d.decision.source}:</span>{" "}
                      {d.decision.reason}
                    </div>
                  )}
                </motion.div>
              );
            })}
            {[...held.map((h) => ({ id: h.approvalId, title: h.tool.replace("__", "/"), detail: JSON.stringify(h.args), reason: h.reason })), ...amends.map((a) => ({ id: a.approvalId, title: "Plan change requested", detail: a.steps.map((s) => `${s.tool} ${JSON.stringify(s.params ?? {})}`).join("\n"), reason: a.reason }))].map((h) => {
              const outcome = outcomes.get(h.id) ?? local.get(h.id);
              return (
                <motion.div key={h.id} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="border-l-2 border-held py-1.5 pl-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{h.title}</span>
                    <Badge variant={outcome === "approved" ? "allowed" : outcome ? "blocked" : "held"}>{outcome ?? "waiting for you"}</Badge>
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-text/80">&ldquo;{h.reason}&rdquo;</div>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-[11.5px] text-muted">{h.detail}</pre>
                  {!outcome && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[12px] text-muted">You are the supervisor. This adds new actions to the signed plan.</span>
                      <Button size="sm" variant="danger" disabled={deciding === h.id} onClick={() => decide(h.id, "denied")}>
                        Deny
                      </Button>
                      <Button size="sm" variant="brand" disabled={deciding === h.id} onClick={() => decide(h.id, "approved")}>
                        Approve
                      </Button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
          {alerts.length > 0 && (
            <div className="mt-1 grid gap-1">
              {alerts.map((a) => (
                <div key={a.at} className="flex items-center gap-2 text-[12.5px] text-muted">
                  <span className="label">spoken alert</span> {a.text}
                </div>
              ))}
            </div>
          )}
          {decided.length === 0 && held.length === 0 && <p className="text-[13px] text-muted">No tool calls yet.</p>}
        </div>
      </div>
    </div>
  );
}
