import { site } from "./site";

/** Base URL of the hosted playground API (the Railway service). */
export const PLAYGROUND_API = site.playground.replace(/\/play\/?$/, "");

export type RunMode = "protected" | "passthrough" | "hijacked" | "hijacked-passthrough" | "voice";

export type AgentEvent =
  | { type: "text"; text: string; at: number }
  | { type: "caller"; text: string; at: number }
  | { type: "tool_call"; name: string; args: Record<string, unknown>; at: number }
  | { type: "tool_result"; name: string; ok: boolean; preview: string; at: number }
  | { type: "fallback"; from: string; to: string; at: number }
  | { type: "refusal"; reason: string; at: number }
  | { type: "error"; message: string; at: number }
  | { type: "done"; turns: number; at: number };

export interface Run {
  id: string;
  mode: RunMode;
  driver: "claude" | "scripted" | "voice";
  protected: boolean;
  status: "running" | "done" | "error";
  startedAt: number;
  endedAt?: number;
  sessionId?: string;
  events: AgentEvent[];
  exfiltrated: string[];
}

export interface Decision {
  action: "allow" | "block" | "hold";
  reason: string;
  source: "armoriq" | "binding" | "offline" | "gateway" | "human" | "passthrough";
  matchedPolicy?: string;
  latencyMs?: number;
}

export type GatewayEvent =
  | { type: "session.started"; sessionId: string; client: string; at: number }
  | { type: "plan.declared"; sessionId: string; plan: { goal: string; steps: { tool: string; params?: Record<string, unknown> }[] }; receipt: { signed: boolean; planHash: string; tokenId?: string; planId?: string }; at: number }
  | { type: "call.decided"; sessionId: string; callId: string; tool: string; args: Record<string, unknown>; decision: Decision; at: number }
  | { type: "call.completed"; sessionId: string; callId: string; tool: string; ok: boolean; durationMs: number; preview: string; at: number }
  | { type: "call.held"; sessionId: string; callId: string; approvalId: string; tool: string; args: Record<string, unknown>; reason: string; at: number }
  | { type: "plan.amend_requested"; sessionId: string; approvalId: string; reason: string; steps: { tool: string; params?: Record<string, unknown> }[]; at: number }
  | { type: "approval.resolved"; sessionId: string; approvalId: string; outcome: "approved" | "denied" | "timeout"; at: number }
  | { type: "voice.alert"; sessionId: string; text: string; audioUrl: string; at: number }
  | { type: "session.ended"; sessionId: string; at: number }
  | { type: string; sessionId?: string; at: number };

export interface PlaygroundInfo {
  model: string;
  prompt: string;
  modes: RunMode[];
  /** True when the hosted deployment can run the ElevenLabs voice call. */
  voice: boolean;
  busy: boolean;
  runs: Array<Omit<Run, "events" | "exfiltrated"> & { leaked: boolean }>;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${PLAYGROUND_API}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const playground = {
  info: () => getJson<PlaygroundInfo>("/api/playground"),
  run: (id: string) => getJson<Run>(`/api/runs/${id}`),
  events: (sessionId: string) => getJson<{ events: GatewayEvent[] }>(`/api/events?session=${encodeURIComponent(sessionId)}`),
  async start(mode: RunMode): Promise<{ id: string } | { error: string }> {
    const res = await fetch(`${PLAYGROUND_API}/api/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    return (await res.json()) as { id: string } | { error: string };
  },
  /** Resolve a hold from the page. The recorder requires the x-intentgate header on every write. */
  async approve(approvalId: string, decision: "approved" | "denied"): Promise<boolean> {
    const res = await fetch(`${PLAYGROUND_API}/api/approvals/${approvalId}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-intentgate": "1" },
      body: JSON.stringify({ decision }),
    });
    return res.ok;
  },
};

export const MODES: Array<{ mode: RunMode; driver: string; title: string; detail: string; protected: boolean }> = [
  { mode: "protected", driver: "Claude Opus", title: "With IntentGate", detail: "ArmorIQ decides every call", protected: true },
  { mode: "passthrough", driver: "Claude Opus", title: "Without", detail: "no gateway, no checks", protected: false },
  { mode: "hijacked", driver: "Hijacked agent", title: "With IntentGate", detail: "scripted, does what the README says", protected: true },
  { mode: "hijacked-passthrough", driver: "Hijacked agent", title: "Without", detail: "watch the key leak", protected: false },
  { mode: "voice", driver: "Voice agent", title: "Run a support call", detail: "real ElevenLabs agent, you are the supervisor", protected: true },
];
