import { ArmorIQClient, type ArmorIQSession } from '@armoriq/sdk';
import type { Decision, Plan, PlanReceipt } from '../types.js';
import type { EngineOptions, IntentEngine } from './engine.js';

/**
 * Real ArmorIQ engine. Plans are captured and signed by ArmorIQ's IAP. Every call is
 * decided by ArmorIQ's backend (`enforceSdk`, session mode `sdk`), so each decision is
 * made and recorded server-side. Off-plan tools are rejected by the SDK before any
 * network call; in-plan tools are checked against the org's policies on the server.
 *
 * Why not `local` mode: the backend does not publish its IAP public key yet
 * (`GET /iap/public-key` returns `enabled: false`), so local JWT verification fails
 * closed on every call. See docs/spike-notes.md.
 */
/**
 * One ArmorIQClient per credential set, shared across sessions. The client validates the
 * API key and warms caches on first use (several seconds); sharing it means only the first
 * session in a process pays that, instead of every conversation.
 */
const clients = new Map<string, ArmorIQClient>();
function sharedClient(opts: EngineOptions): ArmorIQClient {
  const key = `${opts.apiKey}|${opts.userId}|${opts.agentId}`;
  let client = clients.get(key);
  if (!client) {
    client = new ArmorIQClient({ apiKey: opts.apiKey, userId: opts.userId, agentId: opts.agentId });
    clients.set(key, client);
  }
  return client;
}

export class ArmorIQEngine implements IntentEngine {
  readonly kind = 'armoriq' as const;
  private readonly client: ArmorIQClient;
  private readonly session: ArmorIQSession;

  constructor(opts: EngineOptions) {
    this.client = sharedClient(opts);
    this.session = this.client.startSession({
      mode: opts.mode ?? 'sdk',
      llm: 'intentgate',
      validitySeconds: opts.validitySeconds,
    });
  }

  async declare(plan: Plan): Promise<PlanReceipt> {
    const toolCalls = plan.steps.map((s) => ({ name: s.tool, args: s.params ?? {} }));
    const token = await this.session.startPlan(toolCalls, plan.goal);
    return {
      engine: 'armoriq',
      signed: Boolean(token.signature || token.jwtToken),
      planHash: token.planHash,
      tokenId: token.tokenId,
      planId: token.planId,
      expiresAt: token.expiresAt,
    };
  }

  async check(tool: string, args: Record<string, unknown>): Promise<Decision> {
    const started = Date.now();
    const r = await this.session.enforceSdk(tool, args);
    return {
      action: r.action,
      reason: r.reason ?? (r.allowed ? 'in signed plan' : 'blocked by ArmorIQ'),
      source: 'armoriq',
      matchedPolicy: r.matchedPolicy,
      latencyMs: Date.now() - started,
    };
  }

  async report(tool: string, args: Record<string, unknown>, result: unknown, ok: boolean, durationMs: number) {
    try {
      await this.session.report(tool, args, result, { status: ok ? 'success' : 'error', durationMs });
    } catch {
      // Reporting is best effort and must never break the agent's tool call.
    }
  }

  async close() {
    try {
      await this.session.flushObservability();
    } catch {
      // Best effort: the decisions were already made and logged locally.
    }
    await this.session.close();
    // The client is shared across sessions and lives for the process; do not close it here.
  }
}
