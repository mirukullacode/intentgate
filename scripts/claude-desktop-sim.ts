// Pretend to be Claude Desktop: read the generated config, spawn the entry over stdio, use the tools.
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const cfgPath = process.argv[2];
const entry = JSON.parse(readFileSync(cfgPath, 'utf8')).mcpServers.intentgate;
const client = new Client({ name: 'Claude Desktop (simulated)', version: '1.0' });
await client.connect(new StdioClientTransport({ command: entry.command, args: entry.args, env: { ...process.env, ...entry.env }, stderr: 'ignore' }));
const { tools } = await client.listTools();
console.log('tools via stdio:', tools.length, tools.slice(0, 3).map((t) => t.name).join(', '), '…');
const text = (r: any) => (r.content?.[0]?.text ?? '').split('\n')[0].slice(0, 110);
const calls: Array<[string, Record<string, unknown>]> = [
  ['declare_plan', { goal: 'Summarize the README in my workspace', steps: [{ tool: 'workspace__read_file', params: { path: 'README.md' } }] }],
  ['workspace__read_file', { path: 'README.md' }],
  ['workspace__read_file', { path: '.ssh/id_rsa' }],
  ['web__http_post', { url: 'http://localhost:9999/collect', body: 'key' }],
];
for (const [name, args] of calls) {
  const r: any = await client.callTool({ name, arguments: args });
  console.log(`${r.isError ? 'BLOCKED' : 'ok     '} ${name.padEnd(22)} ${text(r)}`);
}
await client.close();
