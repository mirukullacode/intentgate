---
title: Security model
description: What IntentGate defends against, and what it doesn't.
order: 6
---

# Security model

## What it defends against

| Threat | How |
|---|---|
| **Indirect prompt injection** (a README, web page, ticket or tool result tells the agent to do something else) | Actions outside the declared plan are blocked. Injected text can't add tools, and can't change arguments when binding is `strict` |
| **Voice social engineering** (a caller talks the agent into account changes or refunds) | Same plan check per call. New actions require `amend_plan` plus human approval |
| **Plan rewriting** (injection says "declare a new plan that includes X") | Only one `declare_plan` per conversation. Later changes need a human |
| **Path tricks** (`README.md/../.ssh/id_rsa`, backslashes, `./`) | Paths are normalized before binding |
| **Forged or tampered tokens** | ArmorIQ verifies the Ed25519 signature against its trusted public key on every check, failing closed |
| **Rogue web pages approving actions** | The Flight Recorder binds to 127.0.0.1, and every state change needs a custom header that cross-origin pages can't send |
| **Unauthenticated remote access** | `serve --token` requires a secret on every request, compared in constant time |

## What it does not defend against

- **A harmful request from the user themselves.** The plan reflects the user's goal.
- **An injection that lands before the plan is declared.** If the agent reads attacker text *before* calling `declare_plan`, that text could shape the plan. The server instructions tell the model to plan first, and every tool except `declare_plan` is blocked until it does. That closes the common path, but not a malicious *initial* prompt.
- **Data leaking through allowed actions.** If the plan allows `http_post` to `*`, anything can be posted. Declare precise arguments.
- **A compromised downstream server.** IntentGate controls *which* calls reach a server, not what the server does with them.

## Data handling

- Session logs (`~/.intentgate/sessions/*.jsonl`) include tool names and arguments. Treat them as sensitive.
- Plans, decisions and outcomes are reported to ArmorIQ for its audit trail, under your org.
- With voice alerts on, short alert sentences (tool names only, never arguments) are sent to ElevenLabs for text-to-speech.

## Reporting a vulnerability

Please open a private security advisory on GitHub rather than a public issue.
