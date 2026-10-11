import { readFileSync } from 'node:fs';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const c = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
const s: any = await c.conversationalAi.mcpServers.get('GZJse2BqkwgNX02kpasK');
console.log(JSON.stringify({ name: s.config?.name, url: s.config?.url, transport: s.config?.transport, approval: s.config?.approvalPolicy, keys: Object.keys(s) }, null, 1));
if (s.metadata) console.log('metadata:', JSON.stringify(s.metadata).slice(0, 400));
if (s.dependentAgents) console.log('dependents:', JSON.stringify(s.dependentAgents).slice(0, 200));
try { const tools: any = await (c.conversationalAi.mcpServers as any).tools?.list?.('GZJse2BqkwgNX02kpasK'); console.log('tools:', JSON.stringify(tools).slice(0, 600)); } catch (e) { console.log('tools list:', (e as Error).message.slice(0, 200)); }
