/** A step the agent declares it will take. `tool` uses the `<server>__<tool>` convention. */
export interface PlanStep {
  tool: string;
  /** Argument constraints. Omit to allow any arguments for this tool. Strings may use `*` globs. */
  params?: Record<string, unknown>;
  why?: string;
}

export interface Plan {
  goal: string;
  steps: PlanStep[];
}

export type DecisionAction = 'allow' | 'block' | 'hold';

/** Which layer produced a decision. */
export type DecisionSource = 'armoriq' | 'binding' | 'offline' | 'gateway' | 'human' | 'passthrough';

export interface Decision {
  action: DecisionAction;
  reason: string;
  source: DecisionSource;
  matchedPolicy?: string;
  /** How long the deciding layer took, when it involved a network call. */
  latencyMs?: number;
}

/** Proof that a plan was accepted by an intent engine. */
export interface PlanReceipt {
  engine: 'armoriq' | 'offline' | 'passthrough';
  /** True only when ArmorIQ's IAP signed the plan. */
  signed: boolean;
  planHash: string;
  tokenId?: string;
  planId?: string;
  expiresAt?: number;
}

export type ApprovalOutcome = 'approved' | 'denied' | 'timeout';

export type GatewayEvent =
  | { type: 'session.started'; sessionId: string; client: string; transport: 'stdio' | 'http'; at: number }
  | { type: 'plan.declared'; sessionId: string; plan: Plan; receipt: PlanReceipt; at: number }
  | { type: 'plan.amend_requested'; sessionId: string; approvalId: string; reason: string; steps: PlanStep[]; at: number }
  | { type: 'plan.amended'; sessionId: string; plan: Plan; receipt: PlanReceipt; at: number }
  | {
      type: 'call.decided';
      sessionId: string;
      callId: string;
      tool: string;
      args: Record<string, unknown>;
      decision: Decision;
      at: number;
    }
  | {
      type: 'call.held';
      sessionId: string;
      callId: string;
      approvalId: string;
      tool: string;
      args: Record<string, unknown>;
      reason: string;
      at: number;
    }
  | {
      type: 'call.completed';
      sessionId: string;
      callId: string;
      tool: string;
      ok: boolean;
      durationMs: number;
      preview: string;
      at: number;
    }
  | { type: 'approval.resolved'; sessionId: string; approvalId: string; outcome: ApprovalOutcome; at: number }
  | { type: 'voice.alert'; sessionId: string; text: string; audioUrl: string; at: number }
  | { type: 'session.ended'; sessionId: string; at: number };
