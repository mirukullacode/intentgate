import { randomUUID } from 'node:crypto';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type { EventBus } from './events.js';
import type { GatewayEvent } from './types.js';

export interface VoiceOptions {
  apiKey?: string;
  enabled: boolean;
  voiceId: string;
  modelId: string;
}

/**
 * Spoken security alerts, generated with ElevenLabs text-to-speech. When an agent is
 * blocked or needs approval, the Flight Recorder plays a short spoken alert, so a
 * supervisor watching a live voice agent hears it without staring at a dashboard.
 */
export class VoiceAlerts {
  private readonly client?: ElevenLabsClient;
  private readonly clips = new Map<string, Buffer>();
  private lastSpokenAt = 0;

  constructor(private readonly opts: VoiceOptions) {
    if (opts.enabled && opts.apiKey) {
      this.client = new ElevenLabsClient({ apiKey: opts.apiKey });
    }
  }

  get active(): boolean {
    return Boolean(this.client);
  }

  /** Synthesizes `text` and returns the id of the cached MP3 clip. */
  async synthesize(text: string): Promise<string> {
    if (!this.client) throw new Error('Voice alerts are disabled (set ELEVENLABS_API_KEY).');
    const stream = await this.client.textToSpeech.convert(this.opts.voiceId, {
      text,
      modelId: this.opts.modelId,
      outputFormat: 'mp3_44100_128',
    });
    const audio = Buffer.from(await new Response(stream).arrayBuffer());
    const id = randomUUID();
    this.clips.set(id, audio);
    if (this.clips.size > 50) this.clips.delete(this.clips.keys().next().value!);
    return id;
  }

  clip(id: string): Buffer | undefined {
    return this.clips.get(id);
  }

  /** Subscribes to the bus and speaks alerts for blocks, holds and plan amendments. */
  attach(bus: EventBus, log: (msg: string) => void = () => {}): void {
    if (!this.client) return;
    bus.onEvent((event) => {
      const text = alertText(event);
      if (!text) return;
      // Avoid a wall of overlapping audio when an agent retries quickly.
      const now = Date.now();
      if (now - this.lastSpokenAt < 1500) return;
      this.lastSpokenAt = now;
      this.synthesize(text)
        .then((id) =>
          bus.publish({
            type: 'voice.alert',
            sessionId: event.sessionId,
            text,
            audioUrl: `/audio/${id}.mp3`,
            at: Date.now(),
          }),
        )
        .catch((err) => log(`voice alert failed: ${err instanceof Error ? err.message : String(err)}`));
    });
  }
}

function speakable(tool: string): string {
  return tool.replace(/__/g, ' ').replace(/_/g, ' ');
}

export function alertText(event: GatewayEvent): string | undefined {
  switch (event.type) {
    case 'call.decided':
      if (event.decision.action !== 'block') return undefined;
      return `Blocked. The agent tried to ${speakable(event.tool)}, which is outside its declared intent.`;
    case 'call.held':
      return `Approval needed. The agent wants to ${speakable(event.tool)}.`;
    case 'plan.amend_requested':
      return `Approval needed. The agent wants to change its plan: ${event.reason}`;
    default:
      return undefined;
  }
}
