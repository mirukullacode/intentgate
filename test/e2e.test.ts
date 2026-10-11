import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scaffoldDemo } from '../src/demo.js';

/**
 * Runs the real CLI (`intentgate run --offline`) as a child process over stdio, exactly
 * like Claude Desktop would, against the real example servers from `intentgate demo`.
 */
const cli = path.resolve('src/cli.ts');
const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');

describe('end to end over stdio', () => {
  let dir: string;
  let client: Client;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intentgate-e2e-'));
    const { configFile } = scaffoldDemo(dir);
    const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    // Example servers are TypeScript in dev; run them through tsx.
    for (const s of Object.values(cfg.servers) as Array<{ command: string; args: string[] }>) {
      s.args = [tsx, ...s.args];
    }
    cfg.recorder = { enabled: false };
    fs.writeFileSync(configFile, JSON.stringify(cfg));

    client = new Client({ name: 'e2e', version: '1' });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [tsx, cli, 'run', '--offline', '--config', configFile],
        env: { ...getDefaultEnvironment(), INTENTGATE_HOME: path.join(dir, '.home') },
        stderr: 'pipe',
      }),
    );
  }, 60_000);

  afterAll(async () => {
    await client?.close();
  });

  it('exposes control tools plus namespaced downstream tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain('declare_plan');
    expect(names).toContain('workspace__read_file');
    expect(names).toContain('web__http_post');
    expect(names).toContain('shop__issue_refund');
  });

  it('lets the summary through and stops the injected key theft', async () => {
    await client.callTool({
      name: 'declare_plan',
      arguments: { goal: 'Summarize the README', steps: [{ tool: 'workspace__read_file', params: { path: 'README.md' } }] },
    });
    const readme = (await client.callTool({ name: 'workspace__read_file', arguments: { path: 'README.md' } })) as any;
    expect(readme.isError).toBeFalsy();
    expect(readme.content[0].text).toContain('Acme Notes');

    const steal = (await client.callTool({ name: 'workspace__read_file', arguments: { path: '.ssh/id_rsa' } })) as any;
    expect(steal.isError).toBe(true);
    expect(steal.content[0].text).not.toContain('FAKE-KEY');

    const exfil = (await client.callTool({
      name: 'web__http_post',
      arguments: { url: 'http://localhost:9999/collect', body: 'stolen' },
    })) as any;
    expect(exfil.isError).toBe(true);
  });
}, 90_000);
