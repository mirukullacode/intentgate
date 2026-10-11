// Mirrors src/types.ts in the gateway. Kept separate so the UI bundle has no Node imports.
export interface PlanStep {
  tool: string;
  params?: Record<string, unknown>;
  why?: string;
}
export interface Plan {
  goal: string;
  steps: PlanStep[];
}
export interface PlanReceipt {
  engine: 'armoriq' | 'offline';
  signed: boolean;
  planHash: string;
  tokenId?: string;
  planId?: string;
  expiresAt?: number;
}
export interface Decision {
  action: 'allow' | 'block' | 'hold';
  reason: string;
  source: 'armoriq' | 'binding' | 'offline' | 'gateway' | 'human';
  matchedPolicy?: string;
}
export type ApprovalOutcome = 'approved' | 'denied' | 'timeout';

export type GatewayEvent =
  | { type: 'session.started'; sessionId: string; client: string; transport: 'stdio' | 'http'; at: number }
  | { type: 'plan.declared'; sessionId: string; plan: Plan; receipt: PlanReceipt; at: number }
  | { type: 'plan.amend_requested'; sessionId: string; approvalId: string; reason: string; steps: PlanStep[]; at: number }
  | { type: 'plan.amended'; sessionId: string; plan: Plan; receipt: PlanReceipt; at: number }
  | { type: 'call.decided'; sessionId: string; callId: string; tool: string; args: Record<string, unknown>; decision: Decision; at: number }
  | { type: 'call.held'; sessionId: string; callId: string; approvalId: string; tool: string; args: Record<string, unknown>; reason: string; at: number }
  | { type: 'call.completed'; sessionId: string; callId: string; tool: string; ok: boolean; durationMs: number; preview: string; at: number }
  | { type: 'approval.resolved'; sessionId: string; approvalId: string; outcome: ApprovalOutcome; at: number }
  | { type: 'voice.alert'; sessionId: string; text: string; audioUrl: string; at: number }
  | { type: 'session.ended'; sessionId: string; at: number };

export interface CallView {
  callId: string;
  tool: string;
  args: Record<string, unknown>;
  at: number;
  decision?: Decision;
  held?: { approvalId: string; reason: string; outcome?: ApprovalOutcome };
  completed?: { ok: boolean; durationMs: number; preview: string };
}

export interface AmendView {
  approvalId: string;
  reason: string;
  steps: PlanStep[];
  at: number;
  outcome?: ApprovalOutcome;
}

export interface SessionView {
  id: string;
  client: string;
  transport: 'stdio' | 'http';
  startedAt: number;
  ended: boolean;
  plan?: Plan;
  receipt?: PlanReceipt;
  calls: CallView[];
  amends: AmendView[];
  alerts: { text: string; audioUrl: string; at: number }[];
}
