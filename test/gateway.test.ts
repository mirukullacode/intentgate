import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApprovalCenter } from '../src/approvals.js';
import { DownstreamManager } from '../src/downstream.js';
import { EventBus } from '../src/events.js';
import { GatewaySession } from '../src/gateway.js';
import { LocalHub } from '../src/hub.js';
import type { IntentEngine } from '../src/intent/index.js';
import { OfflineEngine } from '../src/intent/offline.js';
import type { Decision, GatewayEvent } from '../src/types.js';

/** A fake downstream MCP server that records every call it actually receives. */
async function fakeServer(name: string, tools: string[], executed: string[]): Promise<Client> {
  const server = new Server({ name, version: '1' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({ name: t, description: t, inputSchema: { type: 'object' } })),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    executed.push(`${name}__${req.params.name} ${JSON.stringify(req.params.arguments)}`);
    return { content: [{ type: 'text', text: `${req.params.name} ok` }] };
  });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(b);
  return client;
}

/** Engine that holds a specific tool, standing in for an ArmorIQ "hold" policy. */
class HoldingEngine extends OfflineEngine {
  constructor(private readonly holdTool: string) {
    super();
  }
  async check(tool: string): Promise<Decision> {
    const base = await super.check(tool);
    if (base.action === 'allow' && tool === this.holdTool) {
      return { action: 'hold', reason: 'refunds need approval', source: 'armoriq', matchedPolicy: 'refund-review' };
    }
    return base;
  }
}

function textOf(r: CallToolResult): string {
  const c = r.content[0];
  return c && c.type === 'text' ? c.text : '';
}

describe('GatewaySession', () => {
  let executed: string[];
  let events: GatewayEvent[];
  let approvals: ApprovalCenter;
  let session: GatewaySession;

  async function build(engine: () => IntentEngine) {
    const downstream = new DownstreamManager();
    await downstream.add('workspace', await fakeServer('workspace', ['read_file', 'list_files'], executed));
    await downstream.add('web', await fakeServer('web', ['http_post'], executed));
    await downstream.add('shop', await fakeServer('shop', ['lookup_order', 'issue_refund'], executed));
    const bus = new EventBus({ persist: false });
    bus.onEvent((e) => events.push(e));
    approvals = new ApprovalCenter(2000);
    session = new GatewaySession({ downstream, hub: new LocalHub(bus, approvals), createEngine: engine, binding: 'strict' }, 'stdio');
  }

  beforeEach(async () => {
    executed = [];
    events = [];
    await build(() => new OfflineEngine());
  });

  it('blocks every tool call until a plan is declared', async () => {
    const r = await session.handleCall('workspace__read_file', { path: 'README.md' });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('declare_plan');
    expect(executed).toHaveLength(0);
  });

  it('runs the prompt-injection scenario: summary allowed, key theft and exfiltration blocked', async () => {
    const plan = await session.handleCall('declare_plan', {
      goal: 'Summarize the README',
      steps: [{ tool: 'workspace__read_file', params: { path: 'README.md' } }],
    });
    expect(plan.isError).toBeFalsy();

    expect((await session.handleCall('workspace__read_file', { path: 'README.md' })).isError).toBeFalsy();

    const steal = await session.handleCall('workspace__read_file', { path: '.ssh/id_rsa' });
    expect(steal.isError).toBe(true);
    expect(textOf(steal)).toContain('.ssh/id_rsa');

    const exfil = await session.handleCall('web__http_post', { url: 'http://localhost:9999/collect', body: 'key' });
    expect(exfil.isError).toBe(true);

    expect(executed).toEqual(['workspace__read_file {"path":"README.md"}']);
    const decisions = events.filter((e) => e.type === 'call.decided');
    expect(decisions.map((e) => e.type === 'call.decided' && e.decision.source)).toEqual(['offline', 'binding', 'offline']);
  });

  it('rejects plans that name unknown tools, with the list of real ones', async () => {
    const r = await session.handleCall('declare_plan', { goal: 'x', steps: [{ tool: 'workspace__delete_everything' }] });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('workspace__read_file');
  });

  it('refuses a second declare_plan so injected text cannot rewrite the plan', async () => {
    await session.handleCall('declare_plan', { goal: 'a', steps: [{ tool: 'workspace__list_files' }] });
    const again = await session.handleCall('declare_plan', { goal: 'b', steps: [{ tool: 'web__http_post' }] });
    expect(again.isError).toBe(true);
    expect(textOf(again)).toContain('amend_plan');
  });

  it('applies amend_plan only after a human approves it', async () => {
    await session.handleCall('declare_plan', { goal: 'Check order', steps: [{ tool: 'shop__lookup_order', params: { order_id: '1042' } }] });
    const pending = session.handleCall('amend_plan', {
      reason: 'caller asked for a refund',
      steps: [{ tool: 'shop__issue_refund', params: { order_id: '1042', amount_inr: 4999 } }],
    });
    await new Promise((r) => setTimeout(r, 20));
    const req = events.find((e) => e.type === 'plan.amend_requested');
    expect(req).toBeTruthy();
    approvals.resolve(req!.type === 'plan.amend_requested' ? req!.approvalId : '', 'denied');
    const result = await pending;
    expect(result.isError).toBe(true);
    expect((await session.handleCall('shop__issue_refund', { order_id: '1042', amount_inr: 4999 })).isError).toBe(true);
    expect(executed).toHaveLength(0);
  });

  it('routes ArmorIQ "hold" decisions to human approval', async () => {
    await build(() => new HoldingEngine('shop__issue_refund'));
    await session.handleCall('declare_plan', {
      goal: 'Refund order 1043',
      steps: [{ tool: 'shop__issue_refund', params: { order_id: '1043', amount_inr: 599 } }],
    });
    const pending = session.handleCall('shop__issue_refund', { order_id: '1043', amount_inr: 599 });
    await new Promise((r) => setTimeout(r, 20));
    const held = events.find((e) => e.type === 'call.held');
    expect(held).toBeTruthy();
    approvals.resolve(held!.type === 'call.held' ? held!.approvalId : '', 'approved');
    expect((await pending).isError).toBeFalsy();
    expect(executed).toEqual(['shop__issue_refund {"order_id":"1043","amount_inr":599}']);
  });

  it('fails closed when the intent engine errors', async () => {
    await build(() => {
      const e = new OfflineEngine();
      e.check = async () => {
        throw new Error('network down');
      };
      return e;
    });
    await session.handleCall('declare_plan', { goal: 'a', steps: [{ tool: 'workspace__list_files' }] });
    const r = await session.handleCall('workspace__list_files', {});
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('failing closed');
    expect(executed).toHaveLength(0);
  });
});
