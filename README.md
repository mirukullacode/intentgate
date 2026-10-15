<div align="center">

# IntentGate

**Your agent said it would read the README. It tried to read your SSH key.<br/>IntentGate blocked it.**

Intent enforcement for **any MCP client** and **ElevenLabs voice agents**, powered by **ArmorIQ**.<br/>
One command. Zero code changes. A live Flight Recorder of what your agent planned vs. what it tried.

[**Live playground**](https://intentgate-production.up.railway.app) · [Website](https://intentgate-alpha.vercel.app) · [How it works](docs/how-it-works.md) · [Architecture](docs/architecture.md) · [DX notes on ArmorIQ](docs/dx-notes-armoriq.md)

[![ci](https://github.com/mirukullacode/intentgate/actions/workflows/ci.yml/badge.svg)](https://github.com/mirukullacode/intentgate/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/intentgate-mcp?color=0a3dff&label=npm)](https://www.npmjs.com/package/intentgate-mcp)

<a href="https://www.npmjs.com/package/intentgate-mcp"><img src="docs/npm-card.png" alt="intentgate-mcp on npm: npx intentgate-mcp agent --hijacked runs the attack, blocked; npx intentgate-mcp init protects Claude Desktop" width="560"></a>

</div>

---

```bash
npx intentgate-mcp agent        # a real Claude agent attacks a poisoned workspace through IntentGate
npx intentgate-mcp init         # protect Claude Desktop (or --client cursor)
```

## Try it in 30 seconds

Open the **[live playground](https://intentgate-production.up.railway.app)** and press *Run with IntentGate*. A real Claude agent is asked to summarize a README that hides an instruction to read an SSH key and post it to an attacker. You watch, live:

1. the agent declares its plan and **ArmorIQ signs it**,
2. the README read is **allowed by ArmorIQ's server** under the org policy,
3. anything off-plan is **blocked**, and the attacker's inbox stays empty.

*Run without IntentGate* runs the same agent with no gateway at all, so the comparison is honest. Nothing real is touched: the key is fake and the attacker is a local port.

## Why

Agents act on text they read, and attackers write some of that text. A hidden line in a README, a web page, a support ticket or a caller on the phone can steer an agent into actions nobody asked for.

[ArmorIQ](https://armoriq.ai) fixes this with **intent verification**: the agent commits to a plan, ArmorIQ signs it, and every action is checked against it. But that needs SDK code, and Claude Desktop, Cursor and ElevenLabs agents can't run your code.

**IntentGate is an MCP server that sits in front of your MCP servers** and does the ArmorIQ work for any client:

1. The agent calls `declare_plan`. **ArmorIQ signs it** and issues an intent token.
2. Every tool call is **decided by ArmorIQ's backend** (tool in plan, org policy) **plus argument binding** (the arguments match what was declared).
3. Anything off-plan is **blocked**. Policy holds and plan changes go to **a human**, with a **spoken alert via ElevenLabs**.
4. Everything streams to the **Flight Recorder** at `localhost:4747`.

## Proof

One real session, plan signed by ArmorIQ, three decisions:

| Call | Result | Decided by |
|---|---|---|
| `read_file README.md` | allowed, `enforcement_passed` | ArmorIQ server |
| `read_file .ssh/id_rsa` | blocked, path differs from plan | IntentGate argument binding |
| `http_post` to the attacker | blocked, tool not in plan | ArmorIQ |

![Flight Recorder showing the allowed README read and the two blocked calls](docs/proof-flight-recorder.png)

The same scripted agent on the **live playground**, without the gateway and with it:

| Without IntentGate: the key leaks in 3 seconds | With IntentGate: two blocks, nothing leaks |
|---|---|
| ![Playground, no gateway, key leaked](docs/playground-leak.png) | ![Playground, with IntentGate, two blocked](docs/playground-blocked.png) |

The voice agent session, an ElevenLabs agent over the hosted gateway, lookup allowed and two plan changes held for a human:

![Flight Recorder showing the voice session with an allowed lookup and two holds](docs/proof-voice-session.png)

The agent `intentgate`, the MCP servers `workspace` and `web`, and the policy that allows `read_file`, `list_files`, `fetch_url` and blocks `write_file`, `http_post` are registered on platform.armoriq.ai. ArmorIQ's own policy page counts the decisions.

**A finding worth stating plainly.** Current Claude models (Opus 5.5, Opus 4.8, Haiku 5.5) read the poisoned README, recognise the injection and refuse it on their own. We did not tune the attack to beat them. IntentGate's job is to make the outcome *not depend on the model*: the same gateway blocks a weaker model, a scripted agent, or a future jailbreak the same way. `scripts/simulate.ts` drives a scripted hijacked agent through the real engine, which is where the screenshot above comes from.

## The finding behind argument binding

ArmorIQ's plan check is **tool-level**: if `read_file(README.md)` is in the plan, `read_file(.ssh/id_rsa)` is the same tool, so it passes. IntentGate adds **argument binding** with path normalization and globs, so the plan means exactly what it says. Details in [How it works](docs/how-it-works.md#3-argument-binding) and in the [DX notes](docs/dx-notes-armoriq.md), which collect eleven concrete findings from a week on the SDK and platform.

## Install

```bash
npx intentgate-mcp init                 # wraps the servers already in Claude Desktop
npx intentgate-mcp init --client cursor
npx intentgate-mcp agent                # run the attack demo with a real Claude agent
npx intentgate-mcp agent --passthrough  # the same agent with no enforcement at all
npx intentgate-mcp playground           # host the demo page + Flight Recorder (what the live URL runs)
npx intentgate-mcp serve --token <secret>   # Streamable HTTP for ElevenLabs agents
npx intentgate-mcp doctor               # checks keys, servers, ports, and asks ArmorIQ what it will do for each tool
npx intentgate-mcp uninstall            # restores your original config
```

Needs Node 20+. Set `ARMORIQ_API_KEY` ([get one](https://platform.armoriq.ai)). The built-in agent and playground also need `ANTHROPIC_API_KEY`. Optional `ELEVENLABS_API_KEY` for voice alerts. No ArmorIQ key? Add `--offline` to try everything unsigned.

## How a call is decided

```
client ──tools/call──▶ IntentGate ──▶ 1. plan declared?        (gateway)
                                      2. ArmorIQ decision      (their server, sdk mode)
                                      3. argument binding      (IntentGate)
                                      4. hold → human approval (recorder, voice)
                                      5. forward · report · record
```

ArmorIQ runs in **sdk mode**: every decision is made on their backend, so it appears in their trace by construction. Local mode is not usable yet because the backend does not publish its verification key; the [spike notes](docs/spike-notes.md) have the measurements.

## Deploy your own playground

The repo ships a `Dockerfile` and `railway.json`. On Railway: *Deploy from GitHub repo*, set `ARMORIQ_API_KEY`, `ANTHROPIC_API_KEY`, `HOST=0.0.0.0`, `PORT=4747`, generate a domain on port 4747. One run at a time, a fresh sandbox per run, an eight-second cooldown.

## Docs

- [Quickstart](docs/quickstart.md) · [How it works](docs/how-it-works.md) · [Architecture](docs/architecture.md)
- [ElevenLabs voice agents](docs/elevenlabs.md) · [Configuration](docs/configuration.md) · [CLI](docs/cli.md)
- [Flight Recorder](docs/flight-recorder.md) · [Security model](docs/security.md)
- [DX notes on ArmorIQ](docs/dx-notes-armoriq.md) · [Spike notes](docs/spike-notes.md)
- [Takeaways: insight, ambition, next steps](docs/takeaways.md) · [Submission kit](docs/submission.md)
- [Complete project analysis](docs/analysis.md): what is real, what was measured, what was found, the visitor verification log

## Takeaways in three lines

- **The model is not the safety layer.** Three current Claude models refused our injection on their own; the gateway makes the outcome independent of which model you run.
- **Tool-level plans have an argument-shaped hole.** Argument binding closes it, and belongs in the platform.
- **Next:** upstream binding as an SDK option, a "protect any MCP server" cookbook entry, and holds through ArmorIQ's own delegation flow. Full list in [docs/takeaways.md](docs/takeaways.md).

## Develop

```bash
npm install && npm --prefix ui install
npm test                      # unit, gateway, HTTP and end-to-end stdio tests
npm run build                 # CLI + Flight Recorder UI
npx tsx scripts/simulate.ts   # scripted hijacked agents through the real engine (add --offline without a key)
```

## Honest limitations

- An injection that reaches the model **before** it declares its plan can shape that plan. Every tool is blocked until a plan exists, which closes the common path, but not a malicious initial prompt.
- Loose plans give loose protection: `http_post { url: "*" }` allows any URL.
- Local verification mode depends on ArmorIQ publishing its IAP public key, which it does not yet.
- Built in one week for the ArmorIQ Flow State hackathon. Tested on Windows and Linux (Railway) with the MCP TypeScript SDK; feedback welcome.

## License

MIT · Built by [Manjunath Irukulla](https://github.com/mirukullacode) for the ArmorIQ × ElevenLabs Flow State hackathon.
