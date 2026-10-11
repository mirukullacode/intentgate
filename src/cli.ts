#!/usr/bin/env node
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Command } from 'commander';
import pc from 'picocolors';
import { DEFAULT_MODEL, runAgent } from './agent.js';
import { ApprovalCenter } from './approvals.js';
import {
  backupPath,
  clientConfigPath,
  gatewayEntry,
  readClientFile,
  sanitizeServerName,
  writeJson,
  type ClientName,
} from './clients.js';
import { loadConfig, resolveConfigPath, type IntentGateConfig } from './config.js';
import { scaffoldDemo } from './demo.js';
import { DownstreamManager } from './downstream.js';
import { DATA_DIR, EventBus } from './events.js';
import { GatewaySession, VERSION } from './gateway.js';
import { startHttpGateway } from './http-server.js';
import { ATTACK_PROMPT, prepareDemoConfig, startCollector as startLeakCollector, startPlayground } from './playground.js';
import { startRecorder } from './recorder.js';
import { createRuntime, log } from './runtime.js';
import { runScriptedAgent } from './scripted.js';
import type { GatewayEvent } from './types.js';
import { VoiceAlerts } from './voice.js';
import { startCollector } from './examples/collector.js';

const GLOBAL_CONFIG = path.join(DATA_DIR, 'intentgate.config.json');
const ok = (s: string) => console.log(`${pc.green('✓')} ${s}`);
const warn = (s: string) => console.log(`${pc.yellow('!')} ${s}`);
const bad = (s: string) => console.log(`${pc.red('✗')} ${s}`);

function fail(err: unknown): never {
  process.stderr.write(`${pc.red('error')} ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

async function ask(question: string): Promise<string> {
  if (!process.stdin.isTTY) return '';
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

const program = new Command()
  .name('intentgate')
  .description('Intent enforcement for any MCP client or ElevenLabs voice agent, powered by ArmorIQ.')
  .version(VERSION);

program
  .command('run')
  .description('Run the gateway over stdio (what Claude Desktop, Cursor and Claude Code launch)')
  .option('-c, --config <file>', 'path to intentgate.config.json')
  .option('--offline', 'enforce plans without ArmorIQ signing (local testing only)')
  .option('--passthrough', 'forward everything, check nothing (the "without IntentGate" demo)')
  .action(async (opts: { config?: string; offline?: boolean; passthrough?: boolean }) => {
    try {
      const config = loadConfig(opts.config);
      const runtime = await createRuntime(config, { offline: opts.offline, passthrough: opts.passthrough });
      const session = new GatewaySession(runtime.deps, 'stdio');
      const server = session.createServer();
      const stop = async () => {
        await session.close();
        await runtime.shutdown();
        process.exit(0);
      };
      server.onclose = () => void stop();
      process.on('SIGINT', () => void stop());
      process.on('SIGTERM', () => void stop());
      await server.connect(new StdioServerTransport());
      const tools = runtime.deps.downstream.list().length;
      log(`ready: guarding ${tools} tools${runtime.recorderUrl ? `, Flight Recorder at ${runtime.recorderUrl}` : ''}`);
    } catch (err) {
      fail(err);
    }
  });

program
  .command('serve')
  .description('Run the gateway over Streamable HTTP for ElevenLabs voice agents and remote MCP clients')
  .option('-c, --config <file>', 'path to intentgate.config.json')
  .option('-p, --port <port>', 'HTTP port for the /mcp endpoint')
  .option('-t, --token <token>', 'require this token on every request (or set INTENTGATE_HTTP_TOKEN)')
  .option('--offline', 'enforce plans without ArmorIQ signing (local testing only)')
  .option('--passthrough', 'forward everything, check nothing (the "without IntentGate" demo)')
  .action(async (opts: { config?: string; port?: string; token?: string; offline?: boolean; passthrough?: boolean }) => {
    try {
      const config = loadConfig(opts.config);
      const runtime = await createRuntime(config, { offline: opts.offline, passthrough: opts.passthrough });
      const authToken = opts.token ?? process.env.INTENTGATE_HTTP_TOKEN ?? config.http.authToken;
      const port = Number(opts.port ?? config.http.port);
      const http = await startHttpGateway({ port, deps: runtime.deps, authToken, log });
      console.error(`
${pc.bold('IntentGate is serving MCP over HTTP')}
  MCP endpoint     ${pc.cyan(http.url)}
  Flight Recorder  ${pc.cyan(runtime.recorderUrl ?? 'disabled')}
  Auth token       ${authToken ? pc.green('required') : pc.yellow('none (add --token before exposing publicly)')}

${pc.bold('Connect an ElevenLabs agent')}
  1. Expose the endpoint:   ${pc.cyan(`npx cloudflared tunnel --url http://localhost:${port}`)}
  2. ElevenLabs → Agents → Integrations → ${pc.bold('Add Custom MCP Server')}
     Server URL: https://<your-tunnel>/mcp · Secret Token: your --token
  3. Attach it to your agent and paste the system prompt from docs/elevenlabs.md
`);
      const stop = async () => {
        await http.close();
        await runtime.shutdown();
        process.exit(0);
      };
      process.on('SIGINT', () => void stop());
      process.on('SIGTERM', () => void stop());
    } catch (err) {
      fail(err);
    }
  });

program
  .command('init')
  .description('Wrap your existing Claude Desktop or Cursor MCP servers with IntentGate')
  .option('--client <name>', 'claude or cursor', 'claude')
  .option('-c, --config <file>', 'gateway config to use', GLOBAL_CONFIG)
  .option('--api-key <key>', 'ArmorIQ API key (otherwise ARMORIQ_API_KEY or a prompt)')
  .option('--offline', 'set up without ArmorIQ signing (local testing only)')
  .option('--no-import', 'do not import the servers already in the client config')
  .option('--local', 'launch this local build instead of npx intentgate@latest')
  .action(
    async (opts: { client: ClientName; config: string; apiKey?: string; offline?: boolean; import: boolean; local?: boolean }) => {
      try {
        const clientFile = clientConfigPath(opts.client);
        const configFile = path.resolve(opts.config);
        const client = readClientFile(clientFile);
        const existing = client.mcpServers ?? {};

        if (existing.intentgate) {
          warn(`IntentGate is already set up in ${clientFile}. Run \`intentgate uninstall\` first to start over.`);
          return;
        }

        const gateway = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : { servers: {} };
        gateway.servers ??= {};
        let imported = 0;
        if (opts.import) {
          for (const [name, entry] of Object.entries(existing)) {
            if ('command' in entry || 'url' in entry) {
              gateway.servers[sanitizeServerName(name)] = entry;
              imported++;
            }
          }
        }
        if (Object.keys(gateway.servers).length === 0) {
          warn('No MCP servers to protect yet. Try `intentgate demo` for a ready-made setup.');
        }
        writeJson(configFile, gateway);

        let apiKey = opts.apiKey ?? process.env.ARMORIQ_API_KEY ?? '';
        if (!apiKey && !opts.offline) apiKey = await ask(`ArmorIQ API key (from https://platform.armoriq.ai): `);
        const env: Record<string, string> = {};
        if (apiKey) env.ARMORIQ_API_KEY = apiKey;
        if (process.env.ELEVENLABS_API_KEY) env.ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

        if (fs.existsSync(clientFile) && !fs.existsSync(backupPath(clientFile))) {
          fs.copyFileSync(clientFile, backupPath(clientFile));
        }
        const localCli = opts.local ? fileURLToPath(import.meta.url) : undefined;
        client.mcpServers = {
          intentgate: gatewayEntry({ configFile, offline: Boolean(opts.offline), env, localCli }),
        };
        writeJson(clientFile, client);

        ok(`Imported ${imported} MCP server(s) into ${pc.cyan(configFile)}`);
        ok(`${opts.client === 'claude' ? 'Claude Desktop' : 'Cursor'} now launches them through IntentGate`);
        if (!apiKey && !opts.offline) warn('No ArmorIQ key set. Add ARMORIQ_API_KEY to the intentgate entry, or re-run with --offline.');
        console.log(`
${pc.bold('Next')}
  1. Restart ${opts.client === 'claude' ? 'Claude Desktop' : 'Cursor'}
  2. Open the Flight Recorder: ${pc.cyan('http://localhost:4747')} (starts with the gateway)
  3. Undo any time:            ${pc.cyan('npx intentgate uninstall')}
`);
      } catch (err) {
        fail(err);
      }
    },
  );

program
  .command('uninstall')
  .description('Restore your original Claude Desktop or Cursor config')
  .option('--client <name>', 'claude or cursor', 'claude')
  .action((opts: { client: ClientName }) => {
    const clientFile = clientConfigPath(opts.client);
    const backup = backupPath(clientFile);
    if (fs.existsSync(backup)) {
      fs.copyFileSync(backup, clientFile);
      fs.rmSync(backup);
      ok(`Restored ${clientFile} from backup. Restart the client to finish.`);
      return;
    }
    const client = readClientFile(clientFile);
    if (client.mcpServers?.intentgate) {
      delete client.mcpServers.intentgate;
      writeJson(clientFile, client);
      ok(`Removed IntentGate from ${clientFile}.`);
    } else {
      warn(`IntentGate is not set up in ${clientFile}.`);
    }
  });

program
  .command('demo [dir]')
  .description('Create a ready-to-run attack demo: a poisoned workspace, a fake key and a support-desk shop')
  .action((dir: string | undefined) => {
    const { dir: created, configFile } = scaffoldDemo(dir ?? 'intentgate-demo');
    ok(`Demo created in ${pc.cyan(created)}`);
    console.log(`
${pc.bold('Try the prompt-injection demo in Claude Desktop')}
  1. ${pc.cyan('npx intentgate collector')}                       (terminal 1: the fake attacker)
  2. ${pc.cyan(`npx intentgate init --no-import --config "${configFile}"`)}
  3. Restart Claude Desktop and ask: "Summarize the README in my workspace"
  4. Watch the Flight Recorder at ${pc.cyan('http://localhost:4747')}

${pc.bold('Try the voice-agent demo with ElevenLabs')}
  ${pc.cyan(`npx intentgate serve --config "${configFile}" --token <secret>`)}
  then follow docs/elevenlabs.md

The workspace contains ${pc.yellow('a FAKE key')} only. Nothing real is ever read or sent.`);
  });

program
  .command('collector')
  .description('Run the local "attacker" endpoint used by the demo (localhost:9999)')
  .option('-p, --port <port>', 'port', '9999')
  .action((opts: { port: string }) => {
    startCollector(Number(opts.port));
  });

program
  .command('ui')
  .description('Open the Flight Recorder on its own to replay saved sessions')
  .option('-p, --port <port>', 'port', '4747')
  .option('-f, --file <file>', 'session log to replay (defaults to today)')
  .action(async (opts: { port: string; file?: string }) => {
    try {
      const bus = new EventBus({ persist: false });
      const file = opts.file ?? path.join(DATA_DIR, 'sessions', `${new Date().toISOString().slice(0, 10)}.jsonl`);
      if (fs.existsSync(file)) {
        for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
          if (line.trim()) bus.publish(JSON.parse(line) as GatewayEvent);
        }
      }
      const voice = new VoiceAlerts({ apiKey: process.env.ELEVENLABS_API_KEY, enabled: true, voiceId: 'JBFqnCBsd6RMkjVDRZzb', modelId: 'eleven_flash_v2_5' });
      const recorder = await startRecorder({ port: Number(opts.port), bus, approvals: new ApprovalCenter(120_000), voice, log });
      voice.attach(bus, log);
      ok(`Flight Recorder at ${pc.cyan(recorder.url)} (${bus.snapshot().length} events loaded)`);
    } catch (err) {
      fail(err);
    }
  });

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer().once('error', () => resolve(false));
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)));
  });
}

program
  .command('doctor')
  .description('Check your setup and explain how to fix anything that is wrong')
  .option('-c, --config <file>', 'path to intentgate.config.json')
  .action(async (opts: { config?: string }) => {
    console.log(pc.bold(`IntentGate doctor · v${VERSION} · ${os.platform()}\n`));
    let problems = 0;
    const major = Number(process.versions.node.split('.')[0]);
    if (major >= 20) ok(`Node ${process.versions.node}`);
    else {
      bad(`Node ${process.versions.node}. IntentGate needs Node 20 or newer.`);
      problems++;
    }

    if (process.env.ARMORIQ_API_KEY) ok('ARMORIQ_API_KEY is set');
    else {
      warn('ARMORIQ_API_KEY is not set. Plans will not be signed. Get one at https://platform.armoriq.ai');
      problems++;
    }
    if (process.env.ELEVENLABS_API_KEY) ok('ELEVENLABS_API_KEY is set (voice alerts on)');
    else warn('ELEVENLABS_API_KEY is not set (optional: enables spoken alerts)');

    let config: IntentGateConfig | undefined;
    const file = opts.config ?? (fs.existsSync(resolveConfigPath()) ? undefined : GLOBAL_CONFIG);
    try {
      config = loadConfig(file);
      ok(`Config ${resolveConfigPath(file)}`);
    } catch (err) {
      bad(err instanceof Error ? err.message : String(err));
      problems++;
    }

    if (config) {
      for (const name of Object.keys(config.servers)) {
        const manager = await DownstreamManager.connect({ [name]: config.servers[name] });
        const count = manager.toolsFor(name).length;
        if (count > 0) ok(`Server '${name}': ${count} tools`);
        else {
          bad(`Server '${name}' did not start or exposes no tools. Check its command and args.`);
          problems++;
        }
        await manager.close();
      }
      const port = config.recorder.port;
      if (await portFree(port)) ok(`Port ${port} is free for the Flight Recorder`);
      else warn(`Port ${port} is in use. If it's another IntentGate, sessions will stream to it.`);
    }

    for (const c of ['claude', 'cursor'] as const) {
      const f = clientConfigPath(c);
      const entry = readClientFile(f).mcpServers?.intentgate;
      if (entry) ok(`${c === 'claude' ? 'Claude Desktop' : 'Cursor'} is wired to IntentGate`);
    }

    console.log(problems === 0 ? pc.green('\nAll good.') : pc.yellow(`\n${problems} thing(s) to fix above.`));
    process.exitCode = problems === 0 ? 0 : 1;
  });

program
  .command('agent')
  .description('Run a real LLM agent through the gateway (the reproducible attack demo)')
  .option('-c, --config <file>', 'gateway config (defaults to a fresh demo workspace)')
  .option('-p, --prompt <text>', 'what the user asks the agent', ATTACK_PROMPT)
  .option('-m, --model <id>', 'Anthropic model ID', DEFAULT_MODEL)
  .option('--offline', 'enforce plans without ArmorIQ signing (local testing only)')
  .option('--passthrough', 'no enforcement at all: the "without IntentGate" half of the demo')
  .option('--hijacked', 'drive a scripted, already-compromised agent instead of a model (no Anthropic key needed)')
  .option('--no-recorder', 'do not start the Flight Recorder')
  .action(async (opts: { config?: string; prompt: string; model: string; offline?: boolean; passthrough?: boolean; hijacked?: boolean; recorder: boolean }) => {
    try {
      if (!process.env.ANTHROPIC_API_KEY && !opts.hijacked) {
        fail(new Error('ANTHROPIC_API_KEY is not set. The built-in agent uses the Anthropic API (or add --hijacked for the scripted agent).'));
      }
      const configFile = opts.config ?? prepareDemoConfig(path.join(DATA_DIR, 'agent-demo'));
      const config = loadConfig(configFile);
      if (!opts.recorder) config.recorder.enabled = false;
      const runtime = await createRuntime(config, { offline: opts.offline, passthrough: opts.passthrough });
      if (runtime.recorderUrl) console.error(`${pc.dim('Flight Recorder')} ${pc.cyan(runtime.recorderUrl)}\n`);
      // The demo's "attacker": whatever reaches it is what leaked. Skipped if something else owns the port.
      const leaks: string[] = [];
      const collector = await startLeakCollector(9999, (hit) => leaks.push(hit)).catch(() => undefined);
      console.log(`${pc.bold('User:')} ${opts.prompt}`);
      const driver = opts.hijacked ? runScriptedAgent : runAgent;
      const run = await driver({
        deps: runtime.deps,
        prompt: opts.prompt,
        model: opts.model,
        label: `${opts.hijacked ? 'Hijacked agent (scripted)' : 'Claude'} ${opts.passthrough ? 'without' : 'with'} IntentGate`,
        onEvent: (e) => {
          if (e.type === 'tool_call') console.log(`${pc.magenta('→ calls')} ${e.name} ${pc.dim(JSON.stringify(e.args))}`);
          else if (e.type === 'tool_result') console.log(`${e.ok ? pc.green('  ✓ result') : pc.red('  ✗ blocked')} ${pc.dim(e.preview.split('\n')[0])}`);
          else if (e.type === 'text') console.log(`${pc.bold('Agent:')} ${e.text}`);
          else if (e.type === 'fallback') console.log(`${pc.yellow('Model fallback:')} ${e.from} declined, ${e.to} continued`);
          else if (e.type === 'refusal') console.log(`${pc.yellow('Model declined:')} ${e.reason}`);
          else if (e.type === 'error') console.log(`${pc.red('Error:')} ${e.message}`);
        },
      });
      const blocked = run.events.filter((e) => e.type === 'tool_result' && !e.ok).length;
      const calls = run.events.filter((e) => e.type === 'tool_call').length;
      console.log(`\n${pc.dim(`${calls} tool call(s), ${blocked} blocked · session ${run.sessionId}`)}`);
      if (collector) {
        if (leaks.length > 0) {
          console.log(`${pc.bgRed(pc.white(' EXFILTRATED '))} the attacker received ${leaks.length} request(s):`);
          console.log(pc.red(leaks[0].split('\n').slice(0, 6).join('\n')));
        } else {
          console.log(`${pc.bgGreen(pc.black(' SAFE '))} nothing reached the attacker`);
        }
        await new Promise<void>((done) => collector.close(() => done()));
      }
      await runtime.shutdown();
      // Give child-process handles a tick to close; exiting mid-close trips a libuv assertion on Windows.
      await new Promise((r) => setTimeout(r, 300));
      process.exit(0);
    } catch (err) {
      fail(err);
    }
  });

program
  .command('playground')
  .description('Hosted demo: the Flight Recorder plus a page where anyone can run the attack with and without IntentGate')
  .option('-c, --config <file>', 'gateway config (defaults to a demo workspace under ~/.intentgate/playground)')
  .option('-p, --port <port>', 'port to serve on', process.env.PORT ?? '4747')
  .option('--host <host>', 'interface to bind', process.env.HOST ?? '127.0.0.1')
  .option('-m, --model <id>', 'Anthropic model ID', DEFAULT_MODEL)
  .option('-t, --token <token>', 'also serve /mcp for remote voice agents, protected by this token (or INTENTGATE_HTTP_TOKEN)')
  .action(async (opts: { config?: string; port: string; host: string; model: string; token?: string }) => {
    try {
      if (!process.env.ANTHROPIC_API_KEY) fail(new Error('ANTHROPIC_API_KEY is not set. The playground agent uses the Anthropic API.'));
      const play = await startPlayground({
        configFile: opts.config,
        port: Number(opts.port),
        host: opts.host,
        model: opts.model,
        mcpToken: opts.token ?? process.env.INTENTGATE_HTTP_TOKEN,
      });
      ok(`Playground at ${pc.cyan(play.url)}`);
      const stop = async () => {
        await play.close();
        process.exit(0);
      };
      process.on('SIGINT', () => void stop());
      process.on('SIGTERM', () => void stop());
    } catch (err) {
      fail(err);
    }
  });

program.parseAsync().catch(fail);
