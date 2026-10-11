import { randomUUID, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { GatewaySession, type GatewayDeps } from './gateway.js';

export interface HttpGatewayOptions {
  port: number;
  deps: GatewayDeps;
  /** If set, every request must send this token (ElevenLabs "Secret Token" field). */
  authToken?: string;
  log?: (msg: string) => void;
}

function tokenMatches(header: string | undefined, expected: string): boolean {
  if (!header) return false;
  const provided = header.replace(/^Bearer\s+/i, '').trim();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : undefined;
}

/**
 * Streamable HTTP MCP endpoint at `/mcp`. This is how ElevenLabs voice agents (and any
 * remote MCP client) connect. Each MCP session gets its own GatewaySession, so every
 * phone call or conversation has its own signed plan.
 */
export function startHttpGateway(opts: HttpGatewayOptions): Promise<{ url: string; close: () => Promise<void> }> {
  const sessions = new Map<string, { transport: StreamableHTTPServerTransport; session: GatewaySession }>();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, sessions: sessions.size }));
    }
    if (url.pathname !== '/mcp') {
      res.writeHead(404).end();
      return;
    }
    if (opts.authToken && !tokenMatches(req.headers.authorization, opts.authToken)) {
      res.writeHead(401, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: 'invalid or missing authorization token' }));
    }

    try {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      const body = req.method === 'POST' ? await readBody(req) : undefined;
      let entry = sessionId ? sessions.get(sessionId) : undefined;

      if (!entry) {
        if (req.method !== 'POST' || !isInitializeRequest(body)) {
          res.writeHead(400, { 'content-type': 'application/json' });
          return res.end(
            JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'No valid session. Send initialize first.' }, id: null }),
          );
        }
        const session = new GatewaySession(opts.deps, 'http');
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            sessions.set(id, { transport, session });
          },
        });
        transport.onclose = () => {
          if (transport.sessionId) sessions.delete(transport.sessionId);
          void session.close();
        };
        await session.createServer().connect(transport);
        entry = { transport, session };
      }

      await entry.transport.handleRequest(req, res, body);
    } catch (err) {
      opts.log?.(`http error: ${err instanceof Error ? err.message : String(err)}`);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null }));
      }
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port, () => {
      const url = `http://localhost:${opts.port}/mcp`;
      opts.log?.(`MCP endpoint on ${url}`);
      resolve({
        url,
        close: async () => {
          await Promise.allSettled([...sessions.values()].map((s) => s.transport.close()));
          await new Promise<void>((done) => server.close(() => done()));
        },
      });
    });
  });
}
