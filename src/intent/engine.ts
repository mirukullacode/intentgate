import type { Decision, Plan, PlanReceipt } from '../types.js';

export type EngineKind = 'armoriq' | 'offline' | 'passthrough';

/**
 * One engine instance per agent session. It turns a declared plan into a verifiable
 * intent and decides whether each tool call is inside that intent.
 */
export interface IntentEngine {
  readonly kind: EngineKind;
  /** Registers (or replaces) the session's plan and returns proof of acceptance. */
  declare(plan: Plan): Promise<PlanReceipt>;
  /** Tool-level decision for a call. Argument binding is layered on top by the gateway. */
  check(tool: string, args: Record<string, unknown>): Promise<Decision>;
  /** Records the outcome of an executed call for the audit trail. */
  report(tool: string, args: Record<string, unknown>, result: unknown, ok: boolean, durationMs: number): Promise<void>;
  close(): Promise<void>;
}

export interface EngineOptions {
  engine: EngineKind;
  apiKey?: string;
  userId: string;
  agentId: string;
  validitySeconds: number;
  /** ArmorIQ session mode. `sdk` decides on their backend; `local` verifies in-process. Default: sdk */
  mode?: 'sdk' | 'local' | 'proxy';
}
