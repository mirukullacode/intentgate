import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const StdioServer = z.object({
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional(),
});

const HttpServer = z.object({
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});

export const ServerSchema = z.union([StdioServer, HttpServer]);
export type ServerConfig = z.infer<typeof ServerSchema>;

export const ConfigSchema = z.object({
  /** Downstream MCP servers to protect. Keys become tool prefixes: `<key>__<tool>`. */
  servers: z.record(
    z.string().regex(/^[A-Za-z0-9-]+$/, 'server names may only contain letters, digits and dashes'),
    ServerSchema,
  ),
  /** `armoriq` signs plans with ArmorIQ. `offline` is unsigned, for local development only. */
  engine: z.enum(['armoriq', 'offline']).default('armoriq'),
  armoriq: z
    .object({
      userId: z.string().default('intentgate-user'),
      agentId: z.string().default('intentgate'),
      validitySeconds: z.number().int().positive().default(900),
      /** `sdk` asks ArmorIQ's backend for every decision. `local` verifies in-process (needs the IAP public key). */
      mode: z.enum(['sdk', 'local', 'proxy']).default('sdk'),
    })
    .prefault({}),
  /** `strict` also checks declared arguments. `tool-only` matches ArmorIQ's tool-level check. */
  binding: z.enum(['strict', 'tool-only']).default('strict'),
  approvals: z.object({ timeoutSeconds: z.number().int().positive().default(120) }).prefault({}),
  recorder: z
    .object({ enabled: z.boolean().default(true), port: z.number().int().default(4747) })
    .prefault({}),
  http: z
    .object({ port: z.number().int().default(8787), authToken: z.string().optional() })
    .prefault({}),
  voice: z
    .object({
      enabled: z.boolean().default(true),
      voiceId: z.string().default('JBFqnCBsd6RMkjVDRZzb'),
      modelId: z.string().default('eleven_flash_v2_5'),
    })
    .prefault({}),
});

export type IntentGateConfig = z.infer<typeof ConfigSchema>;

export const CONFIG_FILE = 'intentgate.config.json';

/** Replaces `${VAR}` references with environment variables. Unset variables become empty strings. */
export function expandEnv<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name: string) => process.env[name] ?? '') as T;
  }
  if (Array.isArray(value)) return value.map(expandEnv) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expandEnv(v)])) as T;
  }
  return value;
}

export function resolveConfigPath(explicit?: string): string {
  return path.resolve(explicit ?? process.env.INTENTGATE_CONFIG ?? CONFIG_FILE);
}

export function loadConfig(explicit?: string): IntentGateConfig {
  const file = resolveConfigPath(explicit);
  if (!fs.existsSync(file)) {
    throw new Error(`No config found at ${file}. Run \`npx intentgate init\` to create one.`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const parsed = ConfigSchema.safeParse(expandEnv(raw));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
    throw new Error(`Invalid ${path.basename(file)}:\n${issues}`);
  }
  return parsed.data;
}

export function parseConfig(raw: unknown): IntentGateConfig {
  return ConfigSchema.parse(raw);
}

export function isStdioServer(s: ServerConfig): s is z.infer<typeof StdioServer> {
  return 'command' in s;
}
