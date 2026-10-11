import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type ClientName = 'claude' | 'cursor';

/** Location of each supported MCP client's config file on this OS. */
export function clientConfigPath(client: ClientName): string {
  const home = os.homedir();
  if (client === 'cursor') return path.join(home, '.cursor', 'mcp.json');
  switch (process.platform) {
    case 'win32':
      return path.join(process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    default:
      return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  }
}

export interface ClientFile {
  mcpServers?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

export function readClientFile(file: string): ClientFile {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, 'utf8').trim();
  return raw ? (JSON.parse(raw) as ClientFile) : {};
}

export function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

export function backupPath(file: string): string {
  return `${file}.intentgate-backup`;
}

/** Server names in IntentGate become tool prefixes, so they must be simple. */
export function sanitizeServerName(name: string): string {
  return name.replace(/[^A-Za-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'server';
}

/**
 * The entry IntentGate writes into a client's config. On Windows, MCP clients need
 * `cmd /c` to launch npx reliably.
 */
export function gatewayEntry(opts: {
  configFile: string;
  offline: boolean;
  env: Record<string, string>;
  localCli?: string;
}): Record<string, unknown> {
  const runArgs = ['run', '--config', opts.configFile, ...(opts.offline ? ['--offline'] : [])];
  if (opts.localCli) {
    return { command: process.execPath, args: [opts.localCli, ...runArgs], env: opts.env };
  }
  const npxArgs = ['-y', 'intentgate@latest', ...runArgs];
  return process.platform === 'win32'
    ? { command: 'cmd', args: ['/c', 'npx', ...npxArgs], env: opts.env }
    : { command: 'npx', args: npxArgs, env: opts.env };
}
