import { createHash } from 'node:crypto';
import type { Decision, Plan, PlanReceipt } from '../types.js';
import type { IntentEngine } from './engine.js';

/**
 * Offline engine for local development and tests. It enforces the same plan
 * membership rule as ArmorIQ but nothing is signed, so receipts are marked
 * `signed: false` and the Flight Recorder labels the session "offline".
 */
export class OfflineEngine implements IntentEngine {
  readonly kind = 'offline' as const;
  private declared = new Set<string>();

  async declare(plan: Plan): Promise<PlanReceipt> {
    this.declared = new Set(plan.steps.map((s) => s.tool));
    const planHash = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
    return { engine: 'offline', signed: false, planHash };
  }

  async check(tool: string): Promise<Decision> {
    if (this.declared.has(tool)) {
      return { action: 'allow', reason: 'in declared plan (offline, unsigned)', source: 'offline' };
    }
    return {
      action: 'block',
      reason: `tool-not-in-plan: '${tool}' was not declared in the plan`,
      source: 'offline',
    };
  }

  async report() {}

  async close() {}
}
