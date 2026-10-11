import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ApprovalCenter } from './approvals.js';
import type { EventBus } from './events.js';
import type { ApprovalOutcome, GatewayEvent } from './types.js';
import type { VoiceAlerts } from './voice.js';

/**
 * An extra route served by the recorder's HTTP server. Return true when the request was
 * handled. Used by the hosted playground to add its run API next to the UI.
 */
export type RecorderRoute = (req: http.IncomingMessage, res: http.ServerResponse, url: URL) => Promise<boolean> | boolean;

export interface RecorderOptions {
  port: number;
  /** Interface to bind. Defaults to 127.0.0.1; the hosted playground binds 0.0.0.0. */
  host?: string;
  bus: EventBus;
  approvals: ApprovalCenter;
  voice?: VoiceAlerts;
  routes?: RecorderRoute[];
  log?: (msg: string) => void;
}

export interface Recorder {
  url: string;
  close(): Promise<void>;
}

const UI_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'ui', 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * Every state-changing request must carry this header. Browsers cannot attach custom
 * headers to cross-origin requests without a CORS preflight, which this server never
 * grants, so a malicious web page cannot approve held actions.
 */
const GUARD_HEADER = 'x-intentgate';

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function serveStatic(res: http.ServerResponse, urlPath: string) {
  if (!fs.existsSync(UI_DIR)) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<h1>IntentGate Flight Recorder</h1><p>The UI is not built yet. Run <code>npm run build:ui</code>.</p>');
    return;
  }
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(UI_DIR, safe);
  if (!file.startsWith(UI_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(UI_DIR, 'index.html');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

export function startRecorder(opts: RecorderOptions): Promise<Recorder> {
  const { bus, approvals, voice } = opts;
  const statuses = new Map<string, 'pending' | ApprovalOutcome>();

  bus.onEvent((e) => {
    if (e.type === 'call.held' || e.type === 'plan.amend_requested') {
      if (!statuses.has(e.approvalId)) statuses.set(e.approvalId, 'pending');
    }
    if (e.type === 'approval.resolved') statuses.set(e.approvalId, e.outcome);
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const isPost = req.method === 'POST';

    try {
      for (const route of opts.routes ?? []) {
        if (await route(req, res, url)) return;
      }
      if (isPost && req.headers[GUARD_HEADER] !== '1') return json(res, 403, { error: 'missing x-intentgate header' });

      if (req.method === 'GET' && url.pathname === '/api/events') {
        return json(res, 200, { events: bus.snapshot(), voice: Boolean(voice?.active) });
      }
      if (isPost && url.pathname === '/api/ingest') {
        bus.publish((await readJson(req)) as GatewayEvent);
        return json(res, 202, { ok: true });
      }
      if (isPost && url.pathname === '/api/approvals') {
        const { sessionId } = await readJson(req);
        const { approvalId, outcome } = approvals.request(String(sessionId));
        statuses.set(approvalId, 'pending');
        outcome.then((o) => statuses.set(approvalId, o));
        return json(res, 201, { approvalId });
      }
      const approvalMatch = url.pathname.match(/^\/api\/approvals\/([\w-]+)$/);
      if (approvalMatch) {
        const id = approvalMatch[1];
        if (req.method === 'GET') return json(res, 200, { status: statuses.get(id) ?? 'unknown' });
        if (isPost) {
          const { decision } = await readJson(req);
          if (decision !== 'approved' && decision !== 'denied') return json(res, 400, { error: 'decision must be approved or denied' });
          const ok = approvals.resolve(id, decision);
          if (ok) statuses.set(id, decision);
          return json(res, ok ? 200 : 404, { ok });
        }
      }
      const audioMatch = url.pathname.match(/^\/audio\/([\w-]+)\.mp3$/);
      if (req.method === 'GET' && audioMatch) {
        const clip = voice?.clip(audioMatch[1]);
        if (!clip) return json(res, 404, { error: 'clip not found' });
        res.writeHead(200, { 'content-type': 'audio/mpeg', 'content-length': clip.length });
        return res.end(clip);
      }
      if (req.method === 'GET') return serveStatic(res, url.pathname);
      json(res, 404, { error: 'not found' });
    } catch (err) {
      json(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  const sockets = new Set<WebSocket>();
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/ws') return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => {
      sockets.add(ws);
      ws.on('close', () => sockets.delete(ws));
    });
  });
  bus.onEvent((event) => {
    const payload = JSON.stringify(event);
    for (const ws of sockets) if (ws.readyState === ws.OPEN) ws.send(payload);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port, opts.host ?? '127.0.0.1', () => {
      const url = `http://localhost:${opts.port}`;
      opts.log?.(`Flight Recorder on ${url}`);
      resolve({
        url,
        close: () =>
          new Promise<void>((done) => {
            for (const ws of sockets) ws.terminate();
            wss.close();
            server.close(() => done());
          }),
      });
    });
  });
}
