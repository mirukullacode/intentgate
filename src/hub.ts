import { ApprovalCenter } from './approvals.js';
import { EventBus } from './events.js';
import type { ApprovalOutcome, GatewayEvent } from './types.js';

/**
 * Where a gateway session sends events and asks for approvals. Normally the Flight
 * Recorder runs in the same process (LocalHub). If another IntentGate process already
 * owns the recorder port, sessions attach to it over HTTP (RemoteHub), so every agent
 * shows up in one recorder.
 */
export interface Hub {
  publish(event: GatewayEvent): void;
  requestApproval(sessionId: string): Promise<{ approvalId: string; outcome: Promise<ApprovalOutcome> }>;
}

export class LocalHub implements Hub {
  constructor(
    readonly bus: EventBus,
    readonly approvals: ApprovalCenter,
  ) {}

  publish(event: GatewayEvent): void {
    this.bus.publish(event);
  }

  async requestApproval(sessionId: string) {
    return this.approvals.request(sessionId);
  }
}

export class RemoteHub implements Hub {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  publish(event: GatewayEvent): void {
    fetch(`${this.baseUrl}/api/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-intentgate': '1' },
      body: JSON.stringify(event),
    }).catch(() => {});
  }

  async requestApproval(sessionId: string) {
    const res = await fetch(`${this.baseUrl}/api/approvals`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-intentgate': '1' },
      body: JSON.stringify({ sessionId }),
    });
    const { approvalId } = (await res.json()) as { approvalId: string };
    const outcome = this.poll(approvalId);
    return { approvalId, outcome };
  }

  private async poll(approvalId: string): Promise<ApprovalOutcome> {
    const deadline = Date.now() + this.timeoutMs + 5000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 750));
      try {
        const res = await fetch(`${this.baseUrl}/api/approvals/${approvalId}`);
        const { status } = (await res.json()) as { status: string };
        if (status === 'approved' || status === 'denied' || status === 'timeout') return status;
      } catch {
        // Recorder briefly unavailable; keep polling until the deadline.
      }
    }
    return 'timeout';
  }
}
