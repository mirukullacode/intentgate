import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CallView, GatewayEvent, SessionView } from './types';

/** Folds the raw event stream into one view model per session. */
export function reduceSessions(events: GatewayEvent[]): SessionView[] {
  const sessions = new Map<string, SessionView>();
  const get = (id: string, at: number): SessionView => {
    let s = sessions.get(id);
    if (!s) {
      s = { id, client: 'agent', transport: 'stdio', startedAt: at, ended: false, calls: [], amends: [], alerts: [] };
      sessions.set(id, s);
    }
    return s;
  };
  const call = (s: SessionView, callId: string, tool: string, args: Record<string, unknown>, at: number): CallView => {
    let c = s.calls.find((x) => x.callId === callId);
    if (!c) {
      c = { callId, tool, args, at };
      s.calls.push(c);
    }
    return c;
  };

  for (const e of events) {
    const s = get(e.sessionId, e.at);
    switch (e.type) {
      case 'session.started':
        s.client = e.client;
        s.transport = e.transport;
        s.startedAt = e.at;
        break;
      case 'plan.declared':
      case 'plan.amended':
        s.plan = e.plan;
        s.receipt = e.receipt;
        break;
      case 'plan.amend_requested':
        s.amends.push({ approvalId: e.approvalId, reason: e.reason, steps: e.steps, at: e.at });
        break;
      case 'call.held':
        call(s, e.callId, e.tool, e.args, e.at).held = { approvalId: e.approvalId, reason: e.reason };
        break;
      case 'call.decided':
        call(s, e.callId, e.tool, e.args, e.at).decision = e.decision;
        break;
      case 'call.completed': {
        const c = s.calls.find((x) => x.callId === e.callId);
        if (c) c.completed = { ok: e.ok, durationMs: e.durationMs, preview: e.preview };
        break;
      }
      case 'approval.resolved': {
        const held = s.calls.find((c) => c.held?.approvalId === e.approvalId);
        if (held?.held) held.held.outcome = e.outcome;
        const amend = s.amends.find((a) => a.approvalId === e.approvalId);
        if (amend) amend.outcome = e.outcome;
        break;
      }
      case 'voice.alert':
        s.alerts.push({ text: e.text, audioUrl: e.audioUrl, at: e.at });
        break;
      case 'session.ended':
        s.ended = true;
        break;
    }
  }
  return [...sessions.values()].sort((a, b) => b.startedAt - a.startedAt);
}

export type ConnectionState = 'connecting' | 'live' | 'offline';

export function useEventStream() {
  const [events, setEvents] = useState<GatewayEvent[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const liveSince = useRef(Date.now());
  const listeners = useRef(new Set<(e: GatewayEvent) => void>());

  useEffect(() => {
    let ws: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const connect = async () => {
      try {
        const res = await fetch('/api/events');
        const data = (await res.json()) as { events: GatewayEvent[]; voice: boolean };
        if (cancelled) return;
        setEvents(data.events);
        setVoiceEnabled(data.voice);
        liveSince.current = Date.now();
      } catch {
        // Recorder not reachable yet; the socket retry below handles it.
      }
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => setConnection('live');
      ws.onmessage = (msg) => {
        const event = JSON.parse(msg.data) as GatewayEvent;
        setEvents((prev) => [...prev, event]);
        for (const l of listeners.current) l(event);
      };
      ws.onclose = () => {
        if (cancelled) return;
        setConnection('offline');
        retry = setTimeout(connect, 1500);
      };
    };
    void connect();
    return () => {
      cancelled = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, []);

  const sessions = useMemo(() => reduceSessions(events), [events]);
  const subscribe = useCallback((fn: (e: GatewayEvent) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);
  return { sessions, connection, voiceEnabled, subscribe };
}

export async function decide(approvalId: string, decision: 'approved' | 'denied'): Promise<void> {
  await fetch(`/api/approvals/${approvalId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-intentgate': '1' },
    body: JSON.stringify({ decision }),
  });
}
