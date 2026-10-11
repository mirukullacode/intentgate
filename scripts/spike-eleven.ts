import { readFileSync } from 'node:fs';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const c = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
const agents = await c.conversationalAi.agents.list({ pageSize: 10 });
console.log('agents:', agents.agents.map((a) => `${a.name} (${a.agentId})`));
const mcps = await c.conversationalAi.mcpServers.list();
console.log('mcp servers:', JSON.stringify(mcps).slice(0, 400));
