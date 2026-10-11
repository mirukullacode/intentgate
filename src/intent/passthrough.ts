import { createHash } from 'node:crypto';
import type { Decision, Plan, PlanReceipt } from '../types.js';
import type { IntentEngine } from './engine.js';

/**
 * No enforcement at all. Every call is forwarded and only recorded. This exists for the
 * "without IntentGate" half of the demo, so the comparison is honest: ArmorIQ is never
 * constructed, nothing is signed, nothing is checked. Never use it outside a sandbox.
 */
export class PassthroughEngine implements IntentEngine {
  readonly kind = 'passthrough' as const;

  async declare(plan: Plan): Promise<PlanReceipt> {
    const planHash = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
    return { engine: 'passthrough', signed: false, planHash };
  }

  async check(): Promise<Decision> {
    return { action: 'allow', reason: 'passthrough mode: nothing is checked', source: 'passthrough' };
  }

  async report(): Promise<void> {}

  async close(): Promise<void> {}
}
