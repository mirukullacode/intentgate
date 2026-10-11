import path from 'node:path';
import type { PlanStep } from './types.js';

/**
 * Argument binding: ArmorIQ verifies that a *tool* is in the signed plan.
 * IntentGate additionally verifies that the *arguments* match what was declared,
 * so `read_file(README.md)` in the plan does not authorize `read_file(.ssh/id_rsa)`.
 */

export interface BindingResult {
  ok: boolean;
  /** Human- and model-readable explanation when `ok` is false. */
  reason?: string;
}

const PATH_KEY = /(path|file|dir|folder|filename)/i;

/** Normalizes a path so `docs/../.ssh/key` cannot masquerade as an allowed path. */
export function normalizePathLike(value: string): string {
  const unified = value.replace(/\\/g, '/');
  const normalized = path.posix.normalize(unified);
  return normalized.replace(/^\.\//, '');
}

function escapeRegex(s: string): string {
  return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/** `*` matches within a path segment, `**` matches across segments. */
export function globToRegex(glob: string): RegExp {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        out += '.*';
        i++;
      } else {
        out += '[^/]*';
      }
    } else {
      out += escapeRegex(ch);
    }
  }
  return new RegExp(`^${out}$`, 'i');
}

function valueMatches(key: string, declared: unknown, actual: unknown): boolean {
  if (declared === '*' || declared === '$any') return actual !== undefined;
  if (typeof declared === 'string' && typeof actual === 'string') {
    const isPath = PATH_KEY.test(key);
    const d = isPath ? normalizePathLike(declared) : declared;
    const a = isPath ? normalizePathLike(actual) : actual;
    if (d.includes('*')) return globToRegex(d).test(a);
    return isPath ? d.toLowerCase() === a.toLowerCase() : d === a;
  }
  if (typeof declared === 'number' && typeof actual === 'string') return String(declared) === actual;
  if (typeof declared === 'string' && typeof actual === 'number') return declared === String(actual);
  return JSON.stringify(declared) === JSON.stringify(actual);
}

/** Checks one call's arguments against one declared step. Extra, undeclared args are allowed. */
export function matchStep(step: PlanStep, args: Record<string, unknown>): BindingResult {
  const declared = step.params ?? {};
  for (const [key, expected] of Object.entries(declared)) {
    if (!(key in args)) {
      return { ok: false, reason: `missing declared argument '${key}'` };
    }
    if (!valueMatches(key, expected, args[key])) {
      return {
        ok: false,
        reason: `argument '${key}' is ${JSON.stringify(args[key])} but the plan declared ${JSON.stringify(expected)}`,
      };
    }
  }
  return { ok: true };
}

/** A call is bound if any declared step for the same tool accepts its arguments. */
export function checkBinding(steps: PlanStep[], tool: string, args: Record<string, unknown>): BindingResult {
  const candidates = steps.filter((s) => s.tool === tool);
  if (candidates.length === 0) {
    return { ok: false, reason: `'${tool}' is not in the declared plan` };
  }
  const reasons: string[] = [];
  for (const step of candidates) {
    const r = matchStep(step, args);
    if (r.ok) return r;
    if (r.reason) reasons.push(r.reason);
  }
  return { ok: false, reason: reasons[0] ?? 'arguments do not match the declared plan' };
}
