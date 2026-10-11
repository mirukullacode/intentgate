import { readFileSync } from 'node:fs';
import { ArmorIQClient } from '@armoriq/sdk';
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const client = new ArmorIQClient({ apiKey: process.env.ARMORIQ_API_KEY, userId: 'intentgate-spike', agentId: 'intentgate' });
try { console.log('bootstrap:', JSON.stringify(await client.bootstrap(), null, 1).slice(0, 3000)); } catch (e: any) { console.log('bootstrap failed:', e?.response?.status, JSON.stringify(e?.response?.data)); }
const internals = client._sessionInternals();
const session = client.startSession({ mode: 'proxy', llm: 'intentgate-spike', validitySeconds: 300 });
const token: any = await session.startPlan([{ name: 'filesystem__read_file', args: { path: 'README.md' } }], 'Summarize README');
try {
  const r = await internals.httpClient.post(`${client.proxyEndpoint}/invoke`, {
    enforce_only: true, mcp: 'filesystem', tool: 'read_file', action: 'read_file', params: { path: 'README.md' }, arguments: { path: 'README.md' },
    intent_token: token.rawToken, plan: token.rawToken?.plan,
  }, { headers: { 'X-API-Key': internals.apiKey, 'Content-Type': 'application/json' }, timeout: 10000 });
  console.log('proxy OK:', JSON.stringify(r.data).slice(0, 800));
} catch (e: any) { console.log('proxy status:', e?.response?.status, JSON.stringify(e?.response?.data)?.slice(0, 800)); }
await session.close(); client.close();
