import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { decide, useEventStream } from './store';
import type { AmendView, CallView, SessionView } from './types';

const EASE = [0.22, 1, 0.36, 1] as const;

function timeAgo(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return new Date(at).toLocaleTimeString();
}

function toolParts(tool: string): { server: string; name: string } {
  const i = tool.indexOf('__');
  return i === -1 ? { server: '', name: tool } : { server: tool.slice(0, i), name: tool.slice(i + 2) };
}

function statusOf(c: CallView): 'allowed' | 'blocked' | 'held' | 'pending' {
  if (c.held && !c.held.outcome) return 'held';
  if (c.decision?.action === 'block') return 'blocked';
  if (c.decision?.action === 'allow') return 'allowed';
  return 'pending';
}

const SOURCE_LABEL: Record<string, string> = {
  armoriq: 'ArmorIQ',
  binding: 'Argument binding',
  offline: 'Offline check',
  gateway: 'IntentGate',
  human: 'Human reviewer',
};

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--panel-2)" />
      <path d="M9 22V10l7 6 7-6v12" stroke="var(--brand)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Args({ args }: { args: Record<string, unknown> }) {
  const entries = Object.entries(args);
  if (entries.length === 0) return <span className="muted mono">no arguments</span>;
  return (
    <span className="mono args">
      {entries.map(([k, v], i) => (
        <span key={k}>
          <span className="arg-key">{k}</span>=<span className="arg-val">{JSON.stringify(v)}</span>
          {i < entries.length - 1 ? ', ' : ''}
        </span>
      ))}
    </span>
  );
}

function CallCard({ call }: { call: CallView }) {
  const status = statusOf(call);
  const { server, name } = toolParts(call.tool);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: EASE }}
      className={`card call ${status}`}
    >
      <div className="call-head">
        <span className={`dot ${status}`} />
        <span className="tool mono">
          {server && <span className="server">{server}/</span>}
          {name}
        </span>
        <span className={`pill ${status}`}>{status}</span>
        <span className="muted time">{timeAgo(call.at)}</span>
      </div>
      <Args args={call.args} />
      {call.decision && call.decision.action !== 'allow' && (
        <p className="reason">
          <strong>{SOURCE_LABEL[call.decision.source] ?? call.decision.source}:</strong> {call.decision.reason}
        </p>
      )}
      {call.decision?.source === 'human' && call.decision.action === 'allow' && (
        <p className="reason ok">Approved by a human reviewer</p>
      )}
      {call.held && !call.held.outcome && <Approval approvalId={call.held.approvalId} label={call.held.reason} />}
      {call.completed && (
        <pre className={`preview ${call.completed.ok ? '' : 'err'}`}>
          {call.completed.preview}
          <span className="muted"> · {call.completed.durationMs} ms</span>
        </pre>
      )}
    </motion.li>
  );
}

function Approval({ approvalId, label }: { approvalId: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const act = async (d: 'approved' | 'denied') => {
    setBusy(true);
    await decide(approvalId, d);
  };
  return (
    <div className="approval">
      <span className="pulse" />
      <span className="approval-label">Needs your approval · {label}</span>
      <button className="btn deny" disabled={busy} onClick={() => act('denied')}>
        Deny
      </button>
      <button className="btn approve" disabled={busy} onClick={() => act('approved')}>
        Approve
      </button>
    </div>
  );
}

function AmendCard({ amend }: { amend: AmendView }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className={`card amend ${amend.outcome ?? 'held'}`}
    >
      <div className="call-head">
        <span className={`dot ${amend.outcome === 'approved' ? 'allowed' : amend.outcome ? 'blocked' : 'held'}`} />
        <span className="tool">Plan change requested</span>
        <span className={`pill ${amend.outcome === 'approved' ? 'allowed' : amend.outcome ? 'blocked' : 'held'}`}>
          {amend.outcome ?? 'waiting'}
        </span>
        <span className="muted time">{timeAgo(amend.at)}</span>
      </div>
      <p className="reason">“{amend.reason}”</p>
      <ul className="amend-steps">
        {amend.steps.map((s, i) => (
          <li key={i} className="mono">
            + {s.tool} <Args args={s.params ?? {}} />
          </li>
        ))}
      </ul>
      {!amend.outcome && <Approval approvalId={amend.approvalId} label="adds new actions to the signed plan" />}
    </motion.li>
  );
}

function PlanPanel({ session }: { session: SessionView }) {
  if (!session.plan || !session.receipt) {
    return (
      <section className="panel plan empty">
        <h3>Declared intent</h3>
        <p className="muted">No plan yet. Every tool call is blocked until the agent calls declare_plan.</p>
      </section>
    );
  }
  const executed = new Set(session.calls.filter((c) => c.decision?.action === 'allow').map((c) => c.tool));
  return (
    <section className="panel plan">
      <div className="plan-head">
        <h3>Declared intent</h3>
        {session.receipt.signed ? (
          <span className="badge signed">✓ Signed by ArmorIQ</span>
        ) : (
          <span className="badge unsigned">Offline · unsigned</span>
        )}
      </div>
      <p className="goal">{session.plan.goal}</p>
      <ol className="steps">
        {session.plan.steps.map((s, i) => (
          <li key={i} className={executed.has(s.tool) ? 'done' : ''}>
            <span className="step-check">{executed.has(s.tool) ? '✓' : i + 1}</span>
            <div>
              <div className="mono tool">{s.tool}</div>
              {s.params && <Args args={s.params} />}
              {s.why && <div className="muted why">{s.why}</div>}
            </div>
          </li>
        ))}
      </ol>
      <div className="hash mono muted">
        plan hash {session.receipt.planHash.slice(0, 16)}…{session.receipt.tokenId ? ` · token ${session.receipt.tokenId.slice(0, 8)}…` : ''}
      </div>
    </section>
  );
}

function SessionDetail({ session }: { session: SessionView }) {
  const items = useMemo(
    () =>
      [
        ...session.calls.map((c) => ({ kind: 'call' as const, at: c.at, call: c })),
        ...session.amends.map((a) => ({ kind: 'amend' as const, at: a.at, amend: a })),
      ].sort((a, b) => a.at - b.at),
    [session],
  );
  const counts = {
    allowed: session.calls.filter((c) => statusOf(c) === 'allowed').length,
    blocked: session.calls.filter((c) => statusOf(c) === 'blocked').length,
    held: session.calls.filter((c) => statusOf(c) === 'held').length + session.amends.filter((a) => !a.outcome).length,
  };
  return (
    <div className="detail">
      <PlanPanel session={session} />
      <section className="panel timeline">
        <div className="plan-head">
          <h3>What the agent tried</h3>
          <div className="counts">
            <span className="pill allowed">{counts.allowed} allowed</span>
            <span className="pill blocked">{counts.blocked} blocked</span>
            {counts.held > 0 && <span className="pill held">{counts.held} waiting</span>}
          </div>
        </div>
        {items.length === 0 ? (
          <p className="muted">No tool calls yet.</p>
        ) : (
          <ul className="calls">
            <AnimatePresence initial={false}>
              {items.map((it) =>
                it.kind === 'call' ? (
                  <CallCard key={it.call.callId} call={it.call} />
                ) : (
                  <AmendCard key={it.amend.approvalId} amend={it.amend} />
                ),
              )}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <Logo />
      <h2>Waiting for an agent…</h2>
      <p className="muted">Sessions appear here the moment an MCP client or voice agent connects through IntentGate.</p>
      <pre className="mono">npx intentgate demo</pre>
    </div>
  );
}

export function App() {
  const { sessions, connection, voiceEnabled, subscribe } = useEventStream();
  // Deep link: /?session=<id> opens that session (used for screenshots and shared links).
  const [selected, setSelected] = useState<string | undefined>(
    () => new URLSearchParams(window.location.search).get('session') ?? undefined,
  );
  const [sound, setSound] = useState(false);
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  const [toast, setToast] = useState<string>();

  useEffect(
    () =>
      subscribe((e) => {
        if (e.type !== 'voice.alert') return;
        setToast(e.text);
        setTimeout(() => setToast(undefined), 5000);
        if (soundRef.current) void new Audio(e.audioUrl).play().catch(() => {});
      }),
    [subscribe],
  );

  const active = sessions.find((s) => s.id === selected) ?? sessions[0];
  const totals = sessions.reduce(
    (acc, s) => {
      for (const c of s.calls) acc[statusOf(c)] = (acc[statusOf(c)] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <Logo />
            <span className="brand-name">IntentGate</span>
            <span className="muted">Flight Recorder</span>
          </div>
          <div className="top-stats">
            <span className="stat">
              <b className="allowed-text">{totals.allowed ?? 0}</b> allowed
            </span>
            <span className="stat">
              <b className="blocked-text">{totals.blocked ?? 0}</b> blocked
            </span>
            {voiceEnabled && (
              <button className={`btn ghost ${sound ? 'on' : ''}`} onClick={() => setSound((v) => !v)}>
                {sound ? '🔊 Voice alerts on' : '🔈 Enable voice alerts'}
              </button>
            )}
            <span className={`conn ${connection}`}>
              <span className="conn-dot" />
              {connection}
            </span>
          </div>
        </header>

        <div className="layout">
          <aside className="sidebar">
            <h4 className="muted">Sessions</h4>
            {sessions.length === 0 && <p className="muted small">None yet</p>}
            <ul>
              {sessions.map((s) => {
                const blocked = s.calls.filter((c) => statusOf(c) === 'blocked').length;
                return (
                  <li key={s.id}>
                    <button className={`session ${active?.id === s.id ? 'active' : ''}`} onClick={() => setSelected(s.id)}>
                      <span className="session-top">
                        <span className="session-client">{s.client}</span>
                        {blocked > 0 && <span className="pill blocked">{blocked}</span>}
                      </span>
                      <span className="muted small">
                        {/elevenlabs/i.test(s.client) ? '🎙 voice agent' : s.transport === 'http' ? 'remote · http' : 'local · stdio'} ·{' '}
                        {timeAgo(s.startedAt)}
                        {s.ended ? ' · ended' : ''}
                      </span>
                      {s.plan && <span className="small session-goal">{s.plan.goal}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
          <main className="main">{active ? <SessionDetail session={active} /> : <EmptyState />}</main>
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div
              className="toast"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <span className="toast-icon">🔊</span> {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
