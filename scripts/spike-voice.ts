import { readFileSync, writeFileSync } from 'node:fs';
import { VoiceAlerts } from '../src/voice.js';
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const voice = new VoiceAlerts({ apiKey: process.env.ELEVENLABS_API_KEY, enabled: true, voiceId: 'JBFqnCBsd6RMkjVDRZzb', modelId: 'eleven_flash_v2_5' });
const t = Date.now();
const id = await voice.synthesize('Blocked. The agent tried to web http post, which is outside its declared intent.');
const clip = voice.clip(id)!;
console.log(`clip ${id}: ${clip.length} bytes in ${Date.now() - t} ms`);
writeFileSync('docs/sample-alert.mp3', clip);
