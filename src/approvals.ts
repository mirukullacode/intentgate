import { randomUUID } from 'node:crypto';
import type { ApprovalOutcome } from './types.js';

interface Pending {
  sessionId: string;
  resolve: (outcome: ApprovalOutcome) => void;
  timer: NodeJS.Timeout;
}

/**
 * Human-in-the-loop approvals. A held call or plan amendment waits here until someone
 * approves or denies it in the Flight Recorder, or the timeout passes (which denies).
 */
export class ApprovalCenter {
  private readonly pending = new Map<string, Pending>();

  constructor(private readonly timeoutMs: number) {}

  /** Creates an approval and returns its id plus a promise for the outcome. */
  request(sessionId: string): { approvalId: string; outcome: Promise<ApprovalOutcome> } {
    const approvalId = randomUUID();
    const outcome = new Promise<ApprovalOutcome>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(approvalId);
        resolve('timeout');
      }, this.timeoutMs);
      this.pending.set(approvalId, { sessionId, resolve, timer });
    });
    return { approvalId, outcome };
  }

  /** Returns false if the approval does not exist or was already decided. */
  resolve(approvalId: string, outcome: 'approved' | 'denied'): boolean {
    const p = this.pending.get(approvalId);
    if (!p) return false;
    clearTimeout(p.timer);
    this.pending.delete(approvalId);
    p.resolve(outcome);
    return true;
  }

  isPending(approvalId: string): boolean {
    return this.pending.has(approvalId);
  }
}
