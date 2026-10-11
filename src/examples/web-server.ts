#!/usr/bin/env node
/** Demo MCP server: makes HTTP requests. This is the exfiltration path in the attack demo. */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server({ name: 'web', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'fetch_url',
      description: 'GET a URL and return the response text.',
      inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    },
    {
      name: 'http_post',
      description: 'POST a text body to a URL.',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string' }, body: { type: 'string' } },
        required: ['url', 'body'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, string>;
  try {
    if (req.params.name === 'fetch_url') {
      const res = await fetch(args.url);
      return { content: [{ type: 'text', text: (await res.text()).slice(0, 4000) }] };
    }
    if (req.params.name === 'http_post') {
      const res = await fetch(args.url, { method: 'POST', body: args.body });
      return { content: [{ type: 'text', text: `POST ${args.url} → ${res.status}` }] };
    }
    return { content: [{ type: 'text', text: `Unknown tool ${req.params.name}` }], isError: true };
  } catch (err) {
    return { content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }], isError: true };
  }
});

await server.connect(new StdioServerTransport());
