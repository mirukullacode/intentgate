// Day-one verification: does a real ArmorIQ session sign plans, block off-plan calls,
// and report decisions so they appear on platform.armoriq.ai?
import { readFileSync } from 'node:fs';
import { ArmorIQClient } from '@armoriq/sdk';

for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const mode = (process.argv[2] ?? 'local') as 'local' | 'proxy' | 'sdk';
const t = (label: string, start: number) => console.log(`  ${label}: ${Date.now() - start} ms`);

const client = new ArmorIQClient({
  apiKey: process.env.ARMORIQ_API_KEY,
  userId: 'intentgate-spike',
  agentId: 'intentgate',
});
const session = client.startSession({ mode, llm: 'intentgate-spike', validitySeconds: 300 });
console.log(`mode=${mode} proxy=${client.proxyEndpoint}`);

let s = Date.now();
const token = await session.startPlan(
  [
    { name: 'filesystem__read_file', args: { path: 'README.md' } },
    { name: 'filesystem__list_directory', args: { path: '.' } },
  ],
  'Summarize the README of the project folder',
);
t('startPlan', s);
console.log('  token', {
  tokenId: token.tokenId, planId: token.planId, planHash: token.planHash,
  signed: Boolean(token.signature || token.jwtToken), expiresAt: token.expiresAt,
});

const calls: Array<[string, Record<string, unknown>]> = [
  ['filesystem__read_file', { path: 'README.md' }],
  ['filesystem__read_file', { path: '.ssh/id_rsa' }],
  ['fetch__http_post', { url: 'http://localhost:9999/collect' }],
];
for (const [tool, args] of calls) {
  s = Date.now();
  const r = mode === 'local' ? session.enforceLocal(tool, args) : await session.enforce(tool, args);
  t(`enforce ${tool} ${JSON.stringify(args)}`, s);
  console.log('   ->', JSON.stringify(r));
  s = Date.now();
  try {
    await session.report(tool, args, r.allowed ? { ok: true } : { blocked: true }, {
      status: r.allowed ? 'success' : 'error', durationMs: 5,
    } as any);
    t('report', s);
  } catch (e) { console.log('   report failed:', (e as Error).message); }
}
s = Date.now();
await session.flushObservability();
t('flushObservability', s);
await session.close();
client.close();
console.log('done');
