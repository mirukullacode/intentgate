---
title: Quickstart
description: Protect your first agent, and know where to look when something is blocked.
order: 1
---

# Quickstart

IntentGate sits between an agent and its MCP tools. The agent declares what it intends to do, ArmorIQ signs that plan, and every tool call outside it is blocked. This page is the whole path, from nothing to a protected Claude Desktop, including the one step people miss: the policy.

## 0. See it work before you set anything up

```bash
npx intentgate-mcp agent --hijacked --offline
```

A scripted, already-compromised agent reads a poisoned README, tries to read a fake key and post it to a local attacker. Offline mode enforces the plan without ArmorIQ, so you can watch the blocks with no account. Open http://localhost:4747 while it runs to see the Flight Recorder.

## 1. Get an ArmorIQ key

Create an account at [platform.armoriq.ai](https://platform.armoriq.ai), then Settings, API Keys, create one.

```bash
export ARMORIQ_API_KEY=ak_live_...        # macOS / Linux
setx ARMORIQ_API_KEY ak_live_...          # Windows, new terminals
```

## 2. Register on the platform, and create ONE policy

ArmorIQ decides every call on its server, against your org's policies. With no policy, **everything is blocked**. This is the step that turns "signed but blocked" into "signed and allowed".

1. **Inventory, Agents, Add AI agent, Connect by URL.** Name `intentgate`. Any reachable URL works for registration, your deployment or even your docs site. Auth none.
2. **Inventory, MCP Servers, Add, Local command.** One entry per server IntentGate protects. The **name must match the prefix in your tool names**: a server registered as `workspace` governs `workspace__read_file`. For the demo, add `workspace`, `web` and `shop`.
3. **Policies, create one, target Org-wide.** Open the YAML tab and list the tools:

```yaml
default_action: block
rules:
  - tool: read_file
    action: allow
  - tool: list_files
    action: allow
  - tool: write_file
    action: block
  - tool: fetch_url
    action: allow
  - tool: http_post
    action: block
```

Use `hold` for anything a human should approve, for example `issue_refund`. Activate the policy.

**Keep it to one policy.** Two same-priority policies on different servers are intersected into an empty allow set, and everything is blocked again (DX note 10).

## 3. Check what ArmorIQ will do, before any agent runs

```bash
npx intentgate-mcp doctor
```

`doctor` signs a dry plan and prints, per tool, what ArmorIQ answers:

```
ArmorIQ policy check (agent 'intentgate', sdk mode)
✓ Plan signed by ArmorIQ in 2.9 s
  allow  workspace__read_file        enforcement_passed · 650 ms
  block  web__http_post              tool_denied · 879 ms
  hold   shop__issue_refund          rule_action_hold · 1.2 s
```

If every line says `block`, your policy is missing or split. Fix it on the platform and run `doctor` again.

## 4. Wire it into Claude Desktop or Cursor

```bash
npx intentgate-mcp init                   # Claude Desktop
npx intentgate-mcp init --client cursor   # Cursor
```

`init` imports the MCP servers already in your client config, routes them through IntentGate, backs up the original, and asks for the key if it is not set. Restart the client. Every conversation now starts with `declare_plan`, and the Flight Recorder opens at http://localhost:4747.

Undo at any time: `npx intentgate-mcp uninstall`.

## 5. Where to see what was blocked

| Where | What you see | When to use it |
|---|---|---|
| **Flight Recorder**, http://localhost:4747 | The signed plan next to every call: allowed, blocked or held, which layer decided (ArmorIQ, argument binding, a human) and why. Approve and Deny buttons for holds. | Live, while the agent runs |
| **Session logs**, `~/.intentgate/sessions/<date>.jsonl` | Every event as JSON, one per line. Replay with `npx intentgate-mcp ui`. | After the fact, or to ship to your own logging |
| **ArmorIQ, Policies, your policy** | Allowed, held and blocked counters for the last 7 days, and **Open Event Log** for the individual decisions. | Audit, compliance, proving it to someone else |
| **ArmorIQ, Observability** | Traces from the SDK: plan captures, enforce calls, reports. | Debugging why a decision went the way it did |

A blocked call never reaches the downstream server. The agent gets a message that names the layer and the reason, and is told not to retry.

## 6. Hosted and voice, optional

- **Hosted playground** for a team or for judges: `npx intentgate-mcp playground --host 0.0.0.0 --token <secret>` serves the demo page, the recorder and an MCP endpoint at `/mcp` on one port. The repo ships a Dockerfile and Railway config.
- **ElevenLabs voice agents**: point the agent at that `/mcp` endpoint with the token. Each call gets its own signed plan; holds reach a supervisor with a spoken alert. Details in [ElevenLabs voice agents](elevenlabs.md).

## Troubleshooting

- `no_matching_policy` or `tool_not_in_policy_intersection` on every call: see step 2, one org-wide policy.
- `token-signature-invalid` on every call: you are in `local` mode and ArmorIQ does not publish its verification key yet. Use `sdk` mode (the default).
- `Blocked by IntentGate argument binding`: the tool was in the plan, the arguments were not. The agent should declare exact arguments, or `"*"` for ones it cannot know yet.
- The agent never calls `declare_plan`: every other tool is blocked with a message telling it to. Claude and GPT models self-correct on the first turn.
