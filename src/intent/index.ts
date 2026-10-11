import { ArmorIQEngine } from './armoriq.js';
import type { EngineOptions, IntentEngine } from './engine.js';
import { OfflineEngine } from './offline.js';
import { PassthroughEngine } from './passthrough.js';

export type { EngineKind, EngineOptions, IntentEngine } from './engine.js';

export function createEngine(opts: EngineOptions): IntentEngine {
  if (opts.engine === 'passthrough') return new PassthroughEngine();
  if (opts.engine === 'offline') return new OfflineEngine();
  if (!opts.apiKey) {
    throw new Error(
      'ARMORIQ_API_KEY is not set. Get a key at https://platform.armoriq.ai, or run with --offline for local testing.',
    );
  }
  return new ArmorIQEngine(opts);
}
