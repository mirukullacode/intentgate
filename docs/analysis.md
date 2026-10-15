---
title: Complete project analysis
description: Everything about IntentGate in one document: what it is, how it works, what is real, what was measured, what was found, and what is left.
order: 12
---

# IntentGate: complete project analysis

*Written 15 October 2026, after the full visitor test described in section 9.*

## 1. The problem in one paragraph

AI agents act on text they read. Some of that text is written by attackers. A hidden line in a README, a web page, a support ticket or a caller on the phone can steer an agent into actions nobody asked for: read a secret, post it somewhere, change a payout account, issue a refund. The model's own judgement is the only thing in the way, and the model's judgement is not a security boundary. ArmorIQ's answer is intent verification: the agent commits to a plan, ArmorIQ signs it, and every action is checked against the plan and the organisation's policy. The catch is that this requires the ArmorIQ SDK inside the agent, and the agents people actually use, Claude Desktop, Cursor, Claude Code, ElevenLabs voice agents, cannot run your code. They speak one protocol: MCP.

## 2. What IntentGate is

IntentGate is an MCP server that sits in front of the MCP servers an agent already uses and does the ArmorIQ work on the client's behalf. To the agent it looks like one server with the agent's usual tools plus two control tools, `declare_plan` and `amend_plan`. To ArmorIQ it looks like a registered agent in sdk mode. To the developer it is one npm package with one install command and a local dashboard.

Three faces in one process:

| Face | Protocol | Who talks to it |
|---|---|---|
| MCP server | stdio or Streamable HTTP | Claude Desktop, Cursor, Claude Code, ElevenLabs, any MCP client |
| MCP client | stdio or HTTP | the real downstream servers: filesystem, fetch, your own |
| Web server | HTTP and WebSocket | the Flight Recorder UI, the hosted playground, the run API |

ArmorIQ sits beside it as the authority that signs plans and makes decisions. Nothing in the client, and nothing in the downstream servers, ever sees ArmorIQ.

## 3. How a call is decided

1. **Startup.** IntentGate reads `intentgate.config.json`, connects to every downstream server, lists their tools and re-exposes them as `<server>__<tool>`. Server instructions tell the model to call `declare_plan` first.
2. **Plan.** The model calls `declare_plan(goal, steps)`. IntentGate maps the steps to ArmorIQ tool calls and calls `session.startPlan()`. ArmorIQ captures the plan and returns an intent token with a plan hash, step proofs and an expiry. The receipt goes back to the model and to the recorder.
3. **Call.** For every `tools/call`, the pipeline runs in order and stops at the first block:
   - no plan yet: block, with a message telling the model exactly what to do
   - **ArmorIQ decision** via `enforceSdk`: tool in plan, org policy, hold rules, decided on their server
   - **argument binding**, IntentGate's own layer: declared arguments must match, paths are normalised, globs honoured
   - **hold**: the call waits for Approve or Deny in the recorder, with an optional spoken alert
   - forward to the downstream server, report the result to ArmorIQ, emit the event
4. **Record.** Every event is appended to `~/.intentgate/sessions/<date>.jsonl` and pushed over WebSocket to the recorder.

A blocked call never reaches the downstream server. The agent receives an error that names the layer and the reason and tells it not to retry.

## 4. What is real and what is not

This matters for judging and for honesty, so it is stated precisely.

| Thing | Real? | Detail |
|---|---|---|
| The model in "Claude" runs | **Real** | Claude Opus 5.5 through the Anthropic API, with server-side fallback to Opus 4.8 on safety refusals |
| ArmorIQ plan signing | **Real** | `startPlan` returns a token with a plan hash from `iap.armoriq.ai` |
| ArmorIQ decisions | **Real** | every allow, block and hold in a protected run is `POST /iap/sdk/enforce` on ArmorIQ's backend, against the org policy created on platform.armoriq.ai |
| Argument binding | **Real, IntentGate's** | in-process; labelled as IntentGate's layer wherever it decides |
| The "hijacked agent" | **Scripted, labelled** | no model; it does exactly what the poisoned README says. It stands in for a weaker or jailbroken model. Its calls go through the same real engine |
| The workspace, the key, the attacker | **Sandbox** | a scaffolded folder, a fake key file, a collector on localhost:9999. Nothing real is read or sent |
| The ElevenLabs agent | **Real** | a conversational agent in the ElevenLabs workspace, connected to the hosted `/mcp` endpoint; its tool calls hit the real gateway |
| Spoken alerts | **Real** | ElevenLabs text-to-speech, generated per block and hold |
| Numbers on the landing page | **Measured** | latency table and stat callouts come from the spike notes and the live runs |

One finding shapes the demo: Claude Opus 5.5, Opus 4.8 and Haiku 5.5 all refuse the poisoned README on their own. We did not tune the attack to beat them. The scripted agent exists so the gateway can be shown doing its job on demand; the live page says plainly when the model declined on its own and nothing needed blocking.

## 5. Components

**Gateway package, `intentgate-mcp` on npm, TypeScript, Node 20+**

| Path | Role |
|---|---|
| `src/gateway.ts` | the MCP server face, the control tools, the enforcement pipeline |
| `src/downstream.ts` | the MCP client face: connects to and routes calls to real servers |
| `src/intent/armoriq.ts` | ArmorIQ engine in sdk mode; `offline.ts` and `passthrough.ts` for tests and the baseline |
| `src/binding.ts` | argument binding with path normalisation and globs |
| `src/recorder.ts`, `ui/` | the Flight Recorder: HTTP, WebSocket, React UI, approvals, audio clips |
| `src/voice.ts` | ElevenLabs spoken alerts |
| `src/http-server.ts` | Streamable HTTP MCP endpoint, mountable on any server |
| `src/agent.ts` | a real Claude agent that uses the gateway in-process |
| `src/scripted.ts` | the scripted hijacked agent |
| `src/playground.ts` | the hosted demo: run API, CORS, collector, `/mcp`, daily cap |
| `src/cli.ts` | `run`, `serve`, `init`, `uninstall`, `demo`, `collector`, `ui`, `doctor`, `agent`, `playground` |
| `test/` | 20 Vitest tests: binding, gateway pipeline, HTTP transport, end-to-end stdio |
| `Dockerfile`, `railway.json`, `.github/workflows/ci.yml` | deploy and CI on Linux and Windows, Node 20 and 22 |

**Site, `site/`, Next.js 16, Vercel**

A document-style landing page with a sidebar index and a Human/Agent toggle, numbered sections with figures and tables, a live pulse strip reading the playground API, and a `/playground` dashboard that drives the hosted runs and renders the recorder natively from gateway events. shadcn-style primitives, tweenly motion components, Geist and Geist Mono.

**Hosted playground, Railway**

One container, one port: the demo page, the recorder, the run API and the `/mcp` endpoint. Five run modes: Claude with and without the gateway, the scripted agent with and without, and a **voice run**: the server drives a real ElevenLabs conversation through the hosted gateway with a scripted social-engineering caller, and the visitor is the supervisor, approving or denying the plan changes from the page while the call is live. One run at a time, a fresh sandbox per run, an eight-second cooldown, a daily cap on model runs.

Two voice-specific mechanics: the gateway answers a held call within five seconds with "a supervisor has been notified" so the voice platform never times out, and still records the human's decision when it arrives; and tool names the voice platform prefixes (`IntentGate_shop__lookup_order`) are mapped back to the exposed tool, so a plan copied from the model's view of the tools binds correctly.

**On platform.armoriq.ai**

Agent `intentgate` registered by URL. MCP servers `workspace`, `web` and `shop` registered as local commands. One org-wide policy: `read_file`, `list_files`, `fetch_url`, `lookup_order` allow; `issue_refund` hold; `write_file`, `http_post`, `update_payout_account` block; default block. The policy page counts the decisions.

## 6. Measurements

| Operation | Measured | Notes |
|---|---|---|
| `startPlan`, first call in a process | 2.8 to 16 s | key validation plus plan capture; cold starts are the slow ones |
| `enforceSdk`, per call | 650 to 950 ms | decision on ArmorIQ's server, matched policy returned |
| argument binding | under 1 ms | in-process |
| `report`, per executed call | about 1 s | best effort |
| scripted attack, with gateway, end to end | about 16 s | four calls |
| scripted attack, without gateway | about 3 s | the key leaks |
| Claude run, with gateway | about 18 s | plan, two reads, model refuses the injection |
| ElevenLabs tool call, first in a conversation | can time out once | ElevenLabs' tool timeout versus the cold `startPlan`; the agent retries and succeeds |

Session modes: `sdk` is the default and the only one that works today. `local` fails closed because ArmorIQ does not publish its IAP public key (`/iap/public-key` returns `enabled: false`). `proxy` needs servers reachable by ArmorIQ's proxy.

## 7. Findings, twelve in total

The full list with reproduction steps is in [dx-notes-armoriq.md](dx-notes-armoriq.md). The four that changed the design:

1. **Tool-level plans have an argument-shaped hole.** `read_file(README.md)` authorises `read_file(.ssh/id_rsa)`. Argument binding closes it. Shipped as a layer, proposed as an SDK option.
2. **Two same-priority policies on different servers are intersected to an empty set.** Everything blocks. One org-wide policy is the fix, and `doctor` now warns about it.
3. **Local verification cannot work yet.** No published key, and the token's signature is DER-encoded ECDSA where the SDK expects Ed25519. Measured, documented, sdk mode used instead.
4. **Holds need an email identity.** The SDK's hold path creates a delegation request and rejects a non-email `userId` with a console warning only. The hold still returns; the platform-side delegation is never created.

Plus a registration path that demands a URL it never asks for, a proxy error with no cause, tool discovery that cannot reach local servers with the manual fallback hidden, and docs that are thinner than the SDK's own `.d.ts` files.

## 8. Security model and limits

- **What it defends against:** actions outside the declared plan, same-tool-different-arguments, and policy violations, regardless of which model runs or how it was prompted.
- **What it does not:** an injection that reaches the model before it declares its plan can shape the plan itself. Every tool is blocked until a plan exists, which closes the common path, not a malicious initial prompt. Loose plans give loose protection: `http_post { url: "*" }` allows any URL.
- **Secrets:** the ArmorIQ key lives in the environment; `init` writes it into the client's MCP config entry, which is how every MCP server receives credentials. The recorder binds to localhost by default. The hosted playground never exposes keys; its `/mcp` endpoint requires a token.
- **Public playground:** sandboxed workspace, fake key, local attacker, one run at a time, cooldown, daily cap on paid model runs.

## 9. Verification log, 15 October 2026, as a first-time visitor

A fresh temp folder, only the public npm package, the quickstart as written, a scratch copy of the Claude Desktop config so nothing real was touched.

| Step | Result |
|---|---|
| `npx intentgate-mcp agent --hijacked --offline` | two blocks, nothing reached the attacker, no account needed |
| `npx intentgate-mcp demo`, then `doctor --config` | plan signed by ArmorIQ; per tool: 4 allow, 3 block, 1 hold, exactly matching the org policy |
| `npx intentgate-mcp init --no-import --config …` against a scratch `APPDATA` | config rewritten to launch `cmd /c npx -y intentgate-mcp@latest run --config …`, original backed up |
| Claude Desktop simulated over stdio against that entry | 10 tools listed; `declare_plan` signed; README read allowed; key read blocked by binding; upload blocked by ArmorIQ |
| `npx intentgate-mcp uninstall` | original config restored byte for byte, backup removed |
| ElevenLabs text conversation through the hosted `/mcp` | plan signed; `lookup_order` allowed by ArmorIQ; payout change and refund routed to human holds with spoken alerts |
| Voice run from the playground with a live supervisor | caller asks for a refund; agent calls `amend_plan`; supervisor approves within the window; plan amended; `issue_refund` held by ArmorIQ's policy, approved by the supervisor, then allowed; 42 s end to end |
| Hosted playground, all modes via API | scripted without gateway: leaked; scripted with: 1 allowed, 2 blocked; Claude with: 2 allowed, 0 blocked, model refused on its own |
| Landing and playground pages on Vercel | 200, live pulse reading real data |
| CI | green on Ubuntu and Windows, Node 20 and 22 |

## 10. What is left

Packaging only: the demo video, the ArmorIQ dashboard screenshots for the submission form, the ArmorTools Pro account, and the submission itself. Roadmap items are in [takeaways.md](takeaways.md): upstream argument binding, a cookbook entry, platform-side holds through delegation, local mode when the key is published, a per-customer hosted playground.

## 11. One-line summary

IntentGate makes any MCP agent keep its word: declare a plan, ArmorIQ signs it, nothing outside the plan runs, and you can watch it happen.
