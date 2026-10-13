---
title: Quickstart
description: Protect your first agent in under five minutes.
order: 1
---

# Quickstart

IntentGate sits between an agent and its MCP tools. The agent declares what it intends to do, ArmorIQ signs that plan, and IntentGate blocks every tool call that falls outside it.

## 1. Try the attack demo (no setup)

```bash
npx intentgate-mcp demo
```

This creates an `intentgate-demo/` folder with:

- a **poisoned README** containing a hidden prompt injection
- a **fake** SSH key (`FAKE-KEY-FOR-THE-INTENTGATE-DEMO`). Nothing real is ever read or sent
- a ready `intentgate.config.json` wiring three demo MCP servers: `workspace`, `web` and `shop`

## 2. Get an ArmorIQ API key

Create a key at [platform.armoriq.ai](https://platform.armoriq.ai) and export it:

```bash
export ARMORIQ_API_KEY=ak_live_...        # macOS / Linux
setx ARMORIQ_API_KEY ak_live_...          # Windows (new terminals)
```

No key yet? Add `--offline` to any command. Plans are still enforced, but they aren't signed, and the Flight Recorder labels the session **Offline · unsigned**.

## 3. Wire it into Claude Desktop

```bash
npx intentgate-mcp collector                                   # terminal 1: the fake attacker
npx intentgate-mcp init --no-import --config ./intentgate-demo/intentgate.config.json
```

Restart Claude Desktop, then ask:

> Summarize the README in my workspace.

Open **http://localhost:4747** to watch the Flight Recorder. You'll see:

1. Claude declares a plan: `workspace__read_file { path: "README.md" }`, signed by ArmorIQ
2. The README read is **allowed**
3. The hidden instruction makes Claude try `workspace__read_file { path: ".ssh/id_rsa" }`. **Blocked by argument binding**: the tool is in the plan, but those arguments aren't
4. It then tries `web__http_post` to the attacker. **Blocked by ArmorIQ**: the tool was never declared
5. The collector terminal stays silent. Nothing leaked

## 4. Protect your real servers

```bash
npx intentgate-mcp init
```

`init` imports the MCP servers already in your Claude Desktop config, routes them through IntentGate, and backs up the original. Undo any time:

```bash
npx intentgate-mcp uninstall
```

Using Cursor? Add `--client cursor`.

## 5. Add voice (optional)

Set `ELEVENLABS_API_KEY` and the Flight Recorder speaks every block and approval request out loud. To put IntentGate in front of an **ElevenLabs voice agent**, see [ElevenLabs voice agents](/docs/elevenlabs).

## Check your setup

```bash
npx intentgate-mcp doctor
```

`doctor` checks your Node version, API keys, config, every downstream server and the recorder port, and tells you how to fix anything that's wrong.
