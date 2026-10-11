---
title: How it works
description: The enforcement pipeline, and why argument binding matters.
order: 2
---

# How it works

```
 MCP client / voice agent                IntentGate                              Your MCP servers
┌──────────────────────┐   tools/call   ┌───────────────────────────────┐        ┌──────────────┐
│ Claude Desktop       │ ─────────────► │ 1. plan declared?             │        │ workspace    │
│ Cursor · Claude Code │                │ 2. ArmorIQ: tool in signed    │ allow  │ web          │
│ ElevenLabs agent     │ ◄───────────── │    plan + org policies        │ ─────► │ shop         │
└──────────────────────┘  result/block  │ 3. argument binding           │        │ github …     │
                                        │ 4. hold → human approval      │        └──────────────┘
                                        │ 5. execute, report, record    │
                                        └──────────────┬────────────────┘
                                                       │ events
                                              Flight Recorder + ElevenLabs voice alerts
```

## The problem

MCP gives agents real power: files, payments, email, databases. But an agent decides what to do *from text it reads*, and some of that text is written by attackers. A hidden line in a README, a web page, a support ticket, or a caller on the phone can steer the agent into actions the user never asked for. This is **prompt injection**, and you can't fix it with a better system prompt alone.

[ArmorIQ](https://armoriq.ai) solves this with **intent verification**: the agent commits to a plan up front, ArmorIQ signs it, and every action is checked against that signed plan. But using it needs code (`capturePlan`, `getIntentToken`, `invoke`), and off-the-shelf clients like Claude Desktop or an ElevenLabs voice agent can't call an SDK.

**IntentGate is the bridge.** It speaks MCP on both sides, so any client gets ArmorIQ enforcement with zero code changes.

## The pipeline

### 0. `declare_plan`

IntentGate adds a `declare_plan` tool and tells the model (through MCP server instructions and the tool description) to call it first:

```json
{
  "goal": "Summarize the README in my workspace",
  "steps": [{ "tool": "workspace__read_file", "params": { "path": "README.md" } }]
}
```

IntentGate validates the tool names, then calls ArmorIQ's `ArmorIQSession.startPlan()`. ArmorIQ's IAP issues an **Ed25519-signed intent token** bound to the plan hash.

A conversation gets exactly **one** `declare_plan`. If injected text convinces the model to "declare a new plan", the call is refused. Changes go through `amend_plan`, which needs a human.

### 1. No plan, no tools

Any tool call before a plan exists is blocked, with a message that tells the model exactly what to do instead. Models correct themselves on the next turn.

### 2. ArmorIQ decision

IntentGate calls `session.enforceLocal(tool, args)`. ArmorIQ verifies the token's signature against its trusted public key, checks that the tool was declared in the signed plan, and applies your org's policies (deny lists, allow lists, default actions, amount thresholds). Result: `allow`, `block` or `hold`.

### 3. Argument binding

ArmorIQ's local check works at the **tool** level. If the plan contains `read_file(README.md)`, a later `read_file(.ssh/id_rsa)` uses the same tool, so a tool-level check allows it.

IntentGate adds **argument binding**: every declared parameter must match. Paths are normalized first, so `README.md/../.ssh/id_rsa` doesn't sneak through. Values can be exact, a glob (`docs/**`), or `"*"` for "anything".

| Plan step | Call | Result |
|---|---|---|
| `read_file { path: "README.md" }` | `read_file { path: "README.md" }` | ✅ allowed |
| `read_file { path: "README.md" }` | `read_file { path: ".ssh/id_rsa" }` | 🛑 binding |
| `read_file { path: "docs/**" }` | `read_file { path: "docs/api/auth.md" }` | ✅ allowed |
| `lookup_order { order_id: "*" }` | `lookup_order { order_id: "2001" }` | ✅ allowed |
| `issue_refund { amount_inr: 599 }` | `issue_refund { amount_inr: 4999 }` | 🛑 binding |

Set `"binding": "tool-only"` to turn this off and rely on ArmorIQ alone.

### 4. Holds and approvals

When an ArmorIQ policy returns `hold` (for example, refunds over a threshold), IntentGate pauses the call and asks a human in the Flight Recorder. With ElevenLabs enabled, the recorder also **says it out loud**: *"Approval needed. The agent wants to shop issue refund."* Approve and the call runs. Deny it, or let it time out, and the agent is told it can't.

`amend_plan` uses the same flow, so a plan can only grow with human consent. On approval IntentGate re-anchors the plan with ArmorIQ, and the audit chain links the old plan hash to the new one.

### 5. Execute, report, record

Allowed calls go to the real server. The outcome is reported back to ArmorIQ (`session.report`) for the audit trail, and every step streams to the Flight Recorder and to `~/.intentgate/sessions/<date>.jsonl`.

## Fail closed

If ArmorIQ is unreachable or a token can't be verified, the call is **blocked**, never silently allowed.

## What IntentGate is not

- **Not a replacement for ArmorIQ's proxy.** For servers registered in ArmorIQ's MCP directory, the proxy (`client.invoke`) enforces centrally. IntentGate is for MCP clients you can't modify, and for local and stdio servers.
- **Not a content filter.** It doesn't judge whether text is malicious. It checks whether actions match the declared intent, which is a much more reliable signal.
- **Not magic.** If the user's own request is harmful, the plan will be too. IntentGate protects the user from injected instructions, not from themselves.
