<div align="center">

# IntentGate

**Your agent said it would read the README. It tried to read your SSH key.<br/>IntentGate blocked it.**

Intent enforcement for **any MCP client** and **ElevenLabs voice agents**, powered by **ArmorIQ**.<br/>
One command. Zero code changes. A live Flight Recorder of what your agent planned vs. what it tried.

[Website](https://intentgate.vercel.app) · [Docs](https://intentgate.vercel.app/docs) · [Demo video](#demo) · [How it works](docs/how-it-works.md)

</div>

---

```bash
npx intentgate demo        # a poisoned workspace to attack
npx intentgate init        # protect Claude Desktop (or --client cursor)
```

## Why

Agents act on text they read, and attackers write some of that text. A hidden line in a README, a web page, a support ticket or a caller on the phone can steer an agent into actions nobody asked for.

[ArmorIQ](https://armoriq.ai) fixes this with **intent verification**: the agent commits to a plan, ArmorIQ signs it, and every action is checked against it. But that needs SDK code, and Claude Desktop, Cursor and ElevenLabs agents can't run your code.

**IntentGate is an MCP server that sits in front of your MCP servers** and does the ArmorIQ work for any client:

1. The agent calls `declare_plan`. **ArmorIQ signs it** (Ed25519 intent token)
2. Every tool call is checked by **ArmorIQ** (tool in plan, org policies) **plus argument binding** (the arguments match what was declared)
3. Anything off-plan is **blocked**. Policy holds and plan changes go to **a human**, with a **spoken alert via ElevenLabs**
4. Everything streams to the **Flight Recorder** at `localhost:4747`

## Demo

| Prompt injection (Claude Desktop) | Social engineering (ElevenLabs voice agent) |
|---|---|
| "Summarize the README" → README read ✅ → hidden comment makes the agent read `.ssh/id_rsa` 🛑 → and post it to an attacker 🛑 | "Where's order 1042?" ✅ → "Change my UPI to scammer@ybl" 🛑 → "Then refund ₹4,999" → 🔊 *"Approval needed…"* → supervisor denies |

```bash
npx intentgate demo && npx intentgate collector
```
Full walkthrough: [Quickstart](docs/quickstart.md) · [ElevenLabs guide](docs/elevenlabs.md)

## The finding behind argument binding

ArmorIQ's local check is **tool-level**: if `read_file(README.md)` is in the plan, `read_file(.ssh/id_rsa)` is the same tool, so it passes. IntentGate adds **argument binding** with path normalization and globs, so the plan means exactly what it says. Details in [How it works](docs/how-it-works.md#3-argument-binding) and in my [DX notes on ArmorIQ](docs/dx-notes-armoriq.md).

## Install

```bash
npx intentgate init                 # wraps the servers already in Claude Desktop
npx intentgate init --client cursor
npx intentgate serve --token <secret>   # Streamable HTTP for ElevenLabs agents
npx intentgate doctor               # checks everything, explains fixes
npx intentgate uninstall            # restores your original config
```

Needs Node 20+. Set `ARMORIQ_API_KEY` ([get one](https://platform.armoriq.ai)), and optionally `ELEVENLABS_API_KEY` for voice alerts. No key? Add `--offline` to try everything unsigned.

## Docs

- [Quickstart](docs/quickstart.md)
- [How it works](docs/how-it-works.md)
- [ElevenLabs voice agents](docs/elevenlabs.md)
- [Configuration](docs/configuration.md) · [CLI](docs/cli.md)
- [Flight Recorder](docs/flight-recorder.md) · [Security model](docs/security.md)
- [DX notes on ArmorIQ](docs/dx-notes-armoriq.md)

## Develop

```bash
npm install && npm --prefix ui install
npm test                      # unit, gateway, HTTP and end-to-end stdio tests
npm run build                 # CLI + Flight Recorder UI
npx tsx scripts/simulate.ts --offline   # scripted agents for screenshots and video
```

## Honest limitations

- An injection that reaches the model **before** it declares its plan can shape that plan. Every tool is blocked until a plan exists, which closes the common path, but not a malicious initial prompt.
- Loose plans give loose protection: `http_post { url: "*" }` allows any URL.
- Built in one week for the ArmorIQ Flow State hackathon. Tested on Windows and with the MCP TypeScript SDK; feedback welcome.

## License

MIT · Built by [Manjunath Irukulla](https://github.com/mirukullacode) for the ArmorIQ × ElevenLabs Flow State hackathon.
