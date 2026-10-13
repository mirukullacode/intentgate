---
title: Flight Recorder
description: See what your agent planned, and what it actually tried.
order: 7
---

# Flight Recorder

The Flight Recorder starts with the gateway at **http://localhost:4747**. It's a local, live view of every agent session:

- **Declared intent:** the goal, each planned step with its arguments, whether ArmorIQ signed it, and a check mark as each step runs
- **What the agent tried:** every call in order, colored by outcome (allowed, blocked, waiting), with the exact arguments, *which layer* decided (ArmorIQ, argument binding, human reviewer) and why, plus a preview of the result
- **Approvals:** held calls and plan changes show **Approve / Deny** buttons
- **Voice alerts:** with `ELEVENLABS_API_KEY` set, click *Enable voice alerts* and blocks and approval requests are spoken out loud, so a supervisor can keep an ear on live voice agents

## Replay

Every event is also written to `~/.intentgate/sessions/<date>.jsonl`. Replay a day later:

```bash
npx intentgate-mcp ui --file ~/.intentgate/sessions/2026-10-14.jsonl
```

## How it relates to the ArmorIQ dashboard

ArmorIQ's dashboard is the **production** view: org-wide plan traces, policy analytics and the tamper-evident audit chain. The Flight Recorder is the **developer** view: local, instant, and focused on one machine's agents while you build and test. Plans and outcomes reach both.

## API

The recorder exposes a small local API, useful for scripts and tests:

| Endpoint | |
|---|---|
| `GET /api/events` | All events so far |
| `WS /ws` | Live event stream |
| `POST /api/approvals/:id` | `{ "decision": "approved" \| "denied" }`. Requires the header `x-intentgate: 1` |
