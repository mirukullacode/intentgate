import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApprovalCenter } from '../src/approvals.js';
import { DownstreamManager } from '../src/downstream.js';
import { EventBus } from '../src/events.js';
import { LocalHub } from '../src/hub.js';
import { startHttpGateway } from '../src/http-server.js';
import { OfflineEngine } from '../src/intent/offline.js';

/** The transport ElevenLabs voice agents use: Streamable HTTP with a secret token. */
describe('HTTP gateway (ElevenLabs path)', () => {
  const port = 18787;
  const token = 'test-secret';
  let gateway: { url: string; close: () => Promise<void> };

  beforeAll(async () => {
    const shop = new Server({ name: 'shop', version: '1' }, { capabilities: { tools: {} } });
    shop.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: ['lookup_order', 'issue_refund'].map((t) => ({ name: t, description: t, inputSchema: { type: 'object' } })),
    }));
    shop.setRequestHandler(CallToolRequestSchema, async (req) => ({
      content: [{ type: 'text', text: `${req.params.name} done` }],
    }));
    const [a, b] = InMemoryTransport.createLinkedPair();
    await shop.connect(a);
    const shopClient = new Client({ name: 't', version: '1' });
    await shopClient.connect(b);

    const downstream = new DownstreamManager();
    await downstream.add('shop', shopClient);
    const bus = new EventBus({ persist: false });
    gateway = await startHttpGateway({
      port,
      authToken: token,
      deps: {
        downstream,
        hub: new LocalHub(bus, new ApprovalCenter(1000)),
        createEngine: () => new OfflineEngine(),
        binding: 'strict',
      },
    });
  });

  afterAll(async () => {
    await gateway?.close();
  });

  it('rejects requests without the secret token', async () => {
    const res = await fetch(`http://localhost:${port}/mcp`, { method: 'POST', body: '{}' });
    expect(res.status).toBe(401);
  });

  it('enforces the plan for a voice-agent conversation', async () => {
    const client = new Client({ name: 'elevenlabs-agent', version: '1' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://localhost:${port}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    await client.callTool({
      name: 'declare_plan',
      arguments: { goal: 'Check order status', steps: [{ tool: 'shop__lookup_order', params: { order_id: '1042' } }] },
    });
    const status = (await client.callTool({ name: 'shop__lookup_order', arguments: { order_id: '1042' } })) as any;
    expect(status.isError).toBeFalsy();

    // Social engineering on the call: "refund it to my new account".
    const refund = (await client.callTool({ name: 'shop__issue_refund', arguments: { order_id: '1042', amount_inr: 4999 } })) as any;
    expect(refund.isError).toBe(true);
    await client.close();
  });
});
