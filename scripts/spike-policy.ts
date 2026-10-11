import { readFileSync } from 'node:fs';
import { ArmorIQClient } from '@armoriq/sdk';
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const client = new ArmorIQClient({ apiKey: process.env.ARMORIQ_API_KEY, userId: 'intentgate-user', agentId: 'intentgate' });
const session = client.startSession({ mode: 'sdk', llm: 'intentgate', validitySeconds: 300 });
const token: any = await session.startPlan([
  { name: 'workspace__read_file', args: { path: 'README.md' } },
  { name: 'workspace__list_files', args: { dir: '.' } },
  { name: 'web__http_post', args: { url: 'http://localhost:9999/collect', body: 'x' } },
], 'Summarize README');
console.log('policyValidation:', JSON.stringify(token.policyValidation, null, 1));
console.log('policySnapshot:', JSON.stringify(token.policySnapshot, null, 1)?.slice(0, 1500));
const internals = client._sessionInternals();
for (const [tool, args] of [['read_file', { path: 'README.md' }], ['http_post', { url: 'http://localhost:9999/collect', body: 'x' }]] as const) {
  const r = await internals.httpClient.post(`${internals.backendEndpoint}/iap/sdk/enforce`, {
    tool, arguments: args, intent_token: token.rawToken, policy_snapshot: token.policySnapshot, agent_id: 'intentgate',
  }, { headers: { 'X-API-Key': internals.apiKey, 'Content-Type': 'application/json' }, timeout: 10000, validateStatus: () => true });
  console.log(`enforce ${tool}:`, r.status, JSON.stringify(r.data));
}
await session.close(); client.close();
