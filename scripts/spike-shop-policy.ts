import { readFileSync } from 'node:fs';
import { ArmorIQClient } from '@armoriq/sdk';
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const client = new ArmorIQClient({ apiKey: process.env.ARMORIQ_API_KEY, userId: 'intentgate-user', agentId: 'intentgate' });
const session = client.startSession({ mode: 'sdk', llm: 'intentgate', validitySeconds: 300 });
await session.startPlan([
  { name: 'shop__lookup_order', args: { order_id: '1042' } },
  { name: 'shop__issue_refund', args: { order_id: '1042', amount_inr: 4999 } },
  { name: 'shop__update_payout_account', args: { customer_id: 'C-77', upi_id: 'x' } },
], 'support call');
const internals = client._sessionInternals();
const tok: any = (session as any).currentToken;
for (const [tool, args] of [['lookup_order', { order_id: '1042' }], ['issue_refund', { order_id: '1042', amount_inr: 4999 }], ['update_payout_account', { customer_id: 'C-77', upi_id: 'x' }]] as const) {
  const r = await internals.httpClient.post(`${internals.backendEndpoint}/iap/sdk/enforce`, { tool, arguments: args, intent_token: tok.rawToken, policy_snapshot: tok.policySnapshot, agent_id: 'intentgate' }, { headers: { 'X-API-Key': internals.apiKey, 'Content-Type': 'application/json' }, timeout: 10000, validateStatus: () => true });
  console.log(tool.padEnd(24), r.data.enforcementAction, '-', r.data.reason, r.data.matchedPolicy?.name ? `(${r.data.matchedPolicy.name})` : '');
}
await session.close(); client.close();
