import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { isStdioServer, type ServerConfig } from './config.js';

export const SEPARATOR = '__';

export interface DownstreamTool {
  /** Namespaced name exposed to the agent, e.g. `workspace__read_file`. */
  name: string;
  server: string;
  originalName: string;
  definition: Tool;
}

/** Connects to the real MCP servers IntentGate protects and routes calls to them. */
export class DownstreamManager {
  private readonly clients = new Map<string, Client>();
  private readonly tools = new Map<string, DownstreamTool>();

  /** Connects to every configured server. A server that fails is reported, not fatal. */
  static async connect(
    servers: Record<string, ServerConfig>,
    log: (msg: string) => void = () => {},
  ): Promise<DownstreamManager> {
    const manager = new DownstreamManager();
    await Promise.all(
      Object.entries(servers).map(async ([name, cfg]) => {
        try {
          const client = new Client({ name: `intentgate→${name}`, version: '0.1.0' });
          const transport = isStdioServer(cfg)
            ? new StdioClientTransport({
                command: cfg.command,
                args: cfg.args,
                env: { ...getDefaultEnvironment(), ...(cfg.env ?? {}) },
                cwd: cfg.cwd,
                stderr: 'pipe',
              })
            : new StreamableHTTPClientTransport(new URL(cfg.url), {
                requestInit: { headers: cfg.headers },
              });
          await client.connect(transport);
          await manager.add(name, client);
          log(`connected to '${name}' (${manager.toolsFor(name).length} tools)`);
        } catch (err) {
          log(`could not connect to '${name}': ${err instanceof Error ? err.message : String(err)}`);
        }
      }),
    );
    return manager;
  }

  /** Registers an already-connected client. Used by `connect` and by tests. */
  async add(name: string, client: Client): Promise<void> {
    this.clients.set(name, client);
    const { tools } = await client.listTools();
    for (const tool of tools) {
      const namespaced = `${name}${SEPARATOR}${tool.name}`;
      this.tools.set(namespaced, { name: namespaced, server: name, originalName: tool.name, definition: tool });
    }
  }

  get serverNames(): string[] {
    return [...this.clients.keys()];
  }

  toolsFor(server: string): DownstreamTool[] {
    return [...this.tools.values()].filter((t) => t.server === server);
  }

  list(): DownstreamTool[] {
    return [...this.tools.values()];
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async call(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool '${name}'`);
    const client = this.clients.get(tool.server)!;
    return (await client.callTool({ name: tool.originalName, arguments: args })) as CallToolResult;
  }

  async close(): Promise<void> {
    await Promise.allSettled([...this.clients.values()].map((c) => c.close()));
  }
}
