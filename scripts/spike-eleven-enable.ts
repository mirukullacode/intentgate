import { readFileSync } from 'node:fs';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const c = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
const before = await c.conversationalAi.settings.get();
console.log('canUseMcpServers before:', before.canUseMcpServers);
const after = await c.conversationalAi.settings.update({ canUseMcpServers: true });
console.log('canUseMcpServers after:', after.canUseMcpServers);
