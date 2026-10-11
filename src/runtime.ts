import pc from 'picocolors';
import { ApprovalCenter } from './approvals.js';
import type { IntentGateConfig } from './config.js';
import { DownstreamManager } from './downstream.js';
import { EventBus } from './events.js';
import type { GatewayDeps } from './gateway.js';
import { LocalHub, RemoteHub, type Hub } from './hub.js';
import { createEngine, type EngineKind } from './intent/index.js';
import { startRecorder, type Recorder, type RecorderRoute } from './recorder.js';
import { VoiceAlerts } from './voice.js';

/** All logs go to stderr: in stdio mode, stdout belongs to the MCP protocol. */
export function log(msg: string): void {
  process.stderr.write(`${pc.dim('[intentgate]')} ${msg}\n`);
}

export interface Runtime {
  deps: GatewayDeps;
  bus: EventBus;
  engineKind: EngineKind;
  recorderUrl?: string;
  shutdown(): Promise<void>;
}

export interface RuntimeOptions {
  /** Enforce plans without ArmorIQ signing. Local testing only. */
  offline?: boolean;
  /** Forward everything, check nothing. The "without IntentGate" half of the demo. */
  passthrough?: boolean;
  /** Bind the Flight Recorder to this host instead of 127.0.0.1 (hosted playground). */
  recorderHost?: string;
  /** Extra HTTP routes served by the Flight Recorder (hosted playground). */
  recorderRoutes?: RecorderRoute[];
  /** Override the recorder port from the config. */
  recorderPort?: number;
}

export async function createRuntime(config: IntentGateConfig, opts: RuntimeOptions = {}): Promise<Runtime> {
  const engine: EngineKind = opts.passthrough ? 'passthrough' : opts.offline ? 'offline' : config.engine;
  const apiKey = process.env.ARMORIQ_API_KEY;
  if (engine === 'armoriq' && !apiKey) {
    throw new Error(
      'ARMORIQ_API_KEY is not set. Get one at https://platform.armoriq.ai, or add --offline to try IntentGate without signing.',
    );
  }
  if (engine === 'offline') log(pc.yellow('offline mode: plans are enforced but NOT signed by ArmorIQ'));
  if (engine === 'passthrough') log(pc.red('PASSTHROUGH mode: nothing is checked. Demo only.'));

  const downstream = await DownstreamManager.connect(config.servers, log);
  if (downstream.list().length === 0) log(pc.yellow('no downstream tools available. Check your servers config.'));

  const timeoutMs = config.approvals.timeoutSeconds * 1000;
  const bus = new EventBus();
  const approvals = new ApprovalCenter(timeoutMs);
  const voice = new VoiceAlerts({ apiKey: process.env.ELEVENLABS_API_KEY, ...config.voice });

  let hub: Hub = new LocalHub(bus, approvals);
  let recorder: Recorder | undefined;
  let recorderUrl: string | undefined;
  const recorderPort = opts.recorderPort ?? config.recorder.port;
  if (config.recorder.enabled) {
    try {
      recorder = await startRecorder({
        port: recorderPort,
        host: opts.recorderHost,
        routes: opts.recorderRoutes,
        bus,
        approvals,
        voice,
        log,
      });
      recorderUrl = recorder.url;
      voice.attach(bus, log);
      if (voice.active) log('ElevenLabs voice alerts on');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw err;
      recorderUrl = `http://localhost:${recorderPort}`;
      hub = new RemoteHub(recorderUrl, timeoutMs);
      log(`Flight Recorder already running on ${recorderUrl}; streaming this session to it`);
    }
  }

  const deps: GatewayDeps = {
    downstream,
    hub,
    binding: config.binding,
    passthrough: engine === 'passthrough',
    log,
    createEngine: () =>
      createEngine({
        engine,
        apiKey,
        userId: config.armoriq.userId,
        agentId: config.armoriq.agentId,
        validitySeconds: config.armoriq.validitySeconds,
        mode: config.armoriq.mode,
      }),
  };

  return {
    deps,
    bus,
    engineKind: engine,
    recorderUrl,
    shutdown: async () => {
      await downstream.close();
      await recorder?.close();
    },
  };
}
