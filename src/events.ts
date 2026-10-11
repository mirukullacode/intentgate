import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { GatewayEvent } from './types.js';

/** Directory for session logs: `~/.intentgate/sessions/<date>.jsonl`. */
export const DATA_DIR = process.env.INTENTGATE_HOME ?? path.join(os.homedir(), '.intentgate');

/**
 * In-process event bus. Every event is also appended to a JSONL file so sessions can be
 * replayed in the Flight Recorder after the agent has exited.
 */
export class EventBus extends EventEmitter {
  private readonly history: GatewayEvent[] = [];
  private readonly logFile?: string;

  constructor(opts: { persist?: boolean; maxHistory?: number } = {}) {
    super();
    this.setMaxListeners(100);
    this.maxHistory = opts.maxHistory ?? 5000;
    if (opts.persist !== false) {
      const dir = path.join(DATA_DIR, 'sessions');
      fs.mkdirSync(dir, { recursive: true });
      this.logFile = path.join(dir, `${new Date().toISOString().slice(0, 10)}.jsonl`);
    }
  }

  private readonly maxHistory: number;

  publish(event: GatewayEvent): void {
    this.history.push(event);
    if (this.history.length > this.maxHistory) this.history.shift();
    if (this.logFile) {
      fs.appendFile(this.logFile, `${JSON.stringify(event)}\n`, () => {});
    }
    this.emit('event', event);
  }

  snapshot(): GatewayEvent[] {
    return [...this.history];
  }

  onEvent(listener: (event: GatewayEvent) => void): () => void {
    this.on('event', listener);
    return () => this.off('event', listener);
  }
}
