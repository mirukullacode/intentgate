import { readFileSync } from 'node:fs';
import { ArmorIQClient } from '@armoriq/sdk';
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const client = new ArmorIQClient({ apiKey: process.env.ARMORIQ_API_KEY, userId: 'intentgate-spike', agentId: 'intentgate' });
const session = client.startSession({ mode: 'sdk', llm: 'intentgate-spike', validitySeconds: 300 });
const token = await session.startPlan([{ name: 'filesystem__read_file', args: { path: 'README.md' } }, { name: 'filesystem__list_directory', args: { path: '.' } }], 'Summarize README');
console.log('via SDK:', JSON.stringify(await session.enforceSdk('filesystem__read_file', { path: 'README.md' })));
const t: any = token;
console.log('token keys:', Object.keys(t));
console.log('jwt present:', Boolean(t.jwtToken), 'signature:', String(t.signature).slice(0, 20), 'publicKey:', t.publicKey ?? t.public_key);
console.log('policySnapshot:', JSON.stringify(t.policySnapshot)?.slice(0, 400));
console.log('policyValidation:', JSON.stringify(t.policyValidation)?.slice(0, 400));
const internals = client._sessionInternals();
try {
  const r = await internals.httpClient.post(`${internals.backendEndpoint}/iap/sdk/enforce`, {
    tool: 'read_file', arguments: { path: 'README.md' }, intent_token: t.rawToken,
    policy_snapshot: t.policySnapshot, agent_id: 'intentgate',
  }, { headers: { 'X-API-Key': internals.apiKey, 'Content-Type': 'application/json' }, timeout: 10000 });
  console.log('enforce OK:', JSON.stringify(r.data));
} catch (e: any) {
  console.log('enforce status:', e?.response?.status, JSON.stringify(e?.response?.data)?.slice(0, 800));
}
await session.close(); client.close();
