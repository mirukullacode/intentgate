import Anthropic from '@anthropic-ai/sdk';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GatewaySession, type GatewayDeps } from './gateway.js';

/** Default model for the built-in agent. Override with INTENTGATE_AGENT_MODEL or --model. */
export const DEFAULT_MODEL = process.env.INTENTGATE_AGENT_MODEL ?? 'claude-opus-5-5';

export type AgentEvent =
  | { type: 'text'; text: string; at: number }
  | { type: 'tool_call'; name: string; args: Record<string, unknown>; at: number }
  | { type: 'tool_result'; name: string; ok: boolean; preview: string; at: number }
  | { type: 'fallback'; from: string; to: string; at: number }
  | { type: 'refusal'; reason: string; at: number }
  | { type: 'error'; message: string; at: number }
  | { type: 'done'; turns: number; at: number };

export interface AgentOptions {
  deps: GatewayDeps;
  /** What the user asks the agent to do. */
  prompt: string;
  /** Anthropic model ID. Default: claude-opus-5-5 */
  model?: string;
  /** Shown as the client name in the Flight Recorder. Default: "IntentGate agent" */
  label?: string;
  /** Safety cap on model turns. Default: 8 */
  maxTurns?: number;
  /** Receives each transcript event as it happens. */
  onEvent?: (event: AgentEvent) => void;
  /** Reuse an Anthropic client (tests, playground). */
  client?: Anthropic;
}

export interface AgentRun {
  sessionId: string;
  events: AgentEvent[];
  finalText: string;
}

const SYSTEM = `You are a helpful assistant working inside a developer's workspace. You have tools from the workspace's MCP servers.
Complete the user's request using the tools, then answer in two or three sentences. Be direct.`;

function resultText(result: CallToolResult): string {
  return result.content
    .map((c) => (c.type === 'text' ? c.text : `[${c.type}]`))
    .join('\n')
    .trim();
}

/**
 * A real LLM agent that talks to IntentGate in-process over the same tool surface an
 * MCP client sees: the gateway's tool list, its instructions, and its tool results.
 * The model decides what to call; IntentGate decides what runs.
 *
 * Server-side fallbacks are on: if the primary model's safety classifier declines a
 * request, Anthropic re-runs it on a fallback model inside the same call, and the
 * transcript records the switch. Without this, a demo that deliberately contains a
 * prompt injection can end before the first tool call.
 */
export async function runAgent(opts: AgentOptions): Promise<AgentRun> {
  const client = opts.client ?? new Anthropic();
  const model = opts.model ?? DEFAULT_MODEL;
  const label = opts.label ?? 'IntentGate agent';
  const maxTurns = opts.maxTurns ?? 8;
  const events: AgentEvent[] = [];
  const emit = (event: AgentEvent) => {
    events.push(event);
    opts.onEvent?.(event);
  };

  const session = new GatewaySession(opts.deps, 'stdio', label);
  session.start(`${label} · ${model}`);

  const tools: Anthropic.Beta.BetaTool[] = session.listTools().map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
  }));
  const system = `${SYSTEM}\n\nTool server instructions:\n${session.instructions}`;
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: opts.prompt }];
  let finalText = '';
  let turns = 0;

  try {
    while (turns < maxTurns) {
      turns++;
      const response = await client.beta.messages.create({
        model,
        max_tokens: 8000,
        system,
        tools,
        messages,
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
      messages.push({ role: 'assistant', content: response.content });

      for (const block of response.content) {
        if (block.type === 'text' && block.text.trim()) {
          finalText = block.text.trim();
          emit({ type: 'text', text: finalText, at: Date.now() });
        } else if (block.type === 'fallback') {
          emit({ type: 'fallback', from: block.from.model, to: block.to.model, at: Date.now() });
        }
      }

      if (response.stop_reason === 'refusal') {
        emit({ type: 'refusal', reason: response.stop_details?.explanation ?? 'the model declined', at: Date.now() });
        break;
      }
      if (response.stop_reason !== 'tool_use') break;

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const args = (block.input ?? {}) as Record<string, unknown>;
        emit({ type: 'tool_call', name: block.name, args, at: Date.now() });
        const result = await session.handleCall(block.name, args);
        const text = resultText(result);
        emit({
          type: 'tool_result',
          name: block.name,
          ok: !result.isError,
          preview: text.length > 400 ? `${text.slice(0, 400)}…` : text,
          at: Date.now(),
        });
        results.push({ type: 'tool_result', tool_use_id: block.id, content: text || '(empty)', is_error: Boolean(result.isError) });
      }
      messages.push({ role: 'user', content: results });
    }
    emit({ type: 'done', turns, at: Date.now() });
  } catch (err) {
    emit({ type: 'error', message: err instanceof Error ? err.message : String(err), at: Date.now() });
  } finally {
    await session.close();
  }

  return { sessionId: session.id, events, finalText };
}
