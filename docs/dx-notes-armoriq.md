---
title: DX notes on ArmorIQ
description: What I learned building on the ArmorIQ SDK, and what I'd improve.
order: 8
---

# DX notes on ArmorIQ

I built IntentGate on `@armoriq/sdk` 0.6.10 during the Flow State hackathon. These are notes from that week: what worked well, and where I got stuck. Each one says how I found it, so the ArmorIQ team can check my reasoning.

## What's great

- **`ArmorIQSession` is an excellent primitive.** `startPlan` → `enforceLocal` / `check` → `report` maps perfectly onto an MCP gateway. Each decision is one function call.
- **The `<mcp>__<action>` tool-name convention** (`defaultToolNameParser`) happens to be exactly how MCP aggregators namespace tools, so IntentGate needed no translation layer.
- **Local enforcement is fast and fails closed.** `enforceLocal` verifies the EdDSA JWT against the trusted IAP key with no network call, and blocks on any doubt.
- **The source is beautifully documented.** The JSDoc in `session.d.ts` (reanchor modes, hold handling, observability) answered every question the website docs didn't.

## Friction, with suggestions

### 1. Local enforcement ignores arguments, and the docs don't say so
*Found by reading `_enforceLocalImpl` in `session.js`.* A plan with `read_file(README.md)` authorizes `read_file(.ssh/id_rsa)`, because membership is checked on tool name only. Plan `params` travel in the token but aren't compared locally.
**Suggestion:** state this clearly in the docs, and consider an opt-in `argumentBinding: 'strict'` session option. IntentGate implements one (`src/binding.ts`, with path normalization and globs) that could be upstreamed. `refine()` looks related, but it's server-side and I couldn't find docs for it.

### 2. The SDK's best documentation isn't on the docs site
*Found by comparing docs.armoriq.ai/sdk with the `.d.ts` files.* The site lists concepts (intent, plan, token, policy) without defining them, while the source explains them in depth.
**Suggestion:** generate an API reference from the TSDoc (TypeDoc), and add a one-page "concepts" glossary with a diagram of plan → token → enforce → report.

### 3. `check()` in local mode turns `hold` into `block`
*Found in `session.js`: the hold branch of `check()`.* That's sensible for headless agents, but a gateway with its own approval UI wants the hold. I called `enforceLocal()` directly to keep it. The block message suggests `ARMORIQ_MODE=proxy`, but `SessionOptions` takes `mode`, and I couldn't find `ARMORIQ_MODE` documented.
**Suggestion:** an option like `holdBehavior: 'block' | 'return'`, and a matching name in the message.

### 4. No guide for the "MCP gateway" pattern
Many teams will want ArmorIQ in front of MCP clients they don't control (Claude Desktop, Cursor, voice agents). The plugins (ArmorClaude, ArmorCodex) cover specific clients, but a generic recipe would open up every MCP client at once.
**Suggestion:** a cookbook entry "Protect any MCP server". Happy to contribute IntentGate as the reference implementation.

### 5. Plan steps as MCP tool calls need a shape adapter
`startPlan` takes `{ name, args }` tool calls, while `capturePlan` docs show `{ action, mcp, params }` steps. Both work, but it took a while to see that `startPlan` builds the second from the first.
**Suggestion:** one canonical example per entry point in the quickstart.

### 6. Package README on PyPI is partial
*Found when reading armoriq-sdk on PyPI.* The page cuts off before sections on verification and policies.
**Suggestion:** a link at the top to the full docs, or a complete README.

### 7. Local mode fails closed because the IAP public key is not published
*Found with a live key on 2026-10-10.* `GET /iap/public-key` returns `{"alg":"EdDSA","enabled":false,"publicKey":null}`, so `enforceLocal` returns `token-signature-invalid` for every call, including in-plan ones. The token's `signature` field also starts with `3045…`, a DER-encoded ECDSA signature, while the SDK's local verifier expects Ed25519.
**Suggestion:** publish the key (or document that local mode is not available yet) and have `enforceLocal` say *why* it failed closed, e.g. "no trusted IAP key configured", instead of the same reason as a forged token.

### 8. Proxy mode hides the cause when the MCP is not registered
*Found with `session.enforce()` before any MCP was registered.* The proxy answers `Internal Proxy Error · An unexpected error occurred`, and the SDK surfaces that string as the block reason. The real cause was "MCP `filesystem` is not registered in this org".
**Suggestion:** a 4xx with the MCP name, and a hint to register it.

### 9. Manual agent registration demands a URL it never asks for
*Found in Inventory → Add AI agent → Custom (manual).* The Connect step says "this agent has no URL" and offers no field, but Register fails with `url must be a URL address. url should not be empty`. Unticking the acknowledgement only disables Continue. Connect by URL works, and local MCP servers register fine through "Local command".
**Suggestion:** make the URL optional on the manual path, or drop the path until it is.

### 10. Same-priority policies on different targets are intersected
*Found with two active policies, both priority 50: one targeting MCP `workspace` (allow `read_file`, `list_files`) and one targeting MCP `web` (allow `fetch_url`).* `enforceSdk` returned `tool_not_in_policy_intersection` with `effectiveAllowedTools: []` for `read_file`, because the engine intersected the allowed sets of both policies even though they govern different servers. One org-wide policy listing all five tools fixed it.
**Suggestion:** scope the intersection to policies whose target matches the call's MCP, or warn in the editor when same-priority policies on different targets would produce an empty set.

### 11. Tool discovery cannot reach "Local command" servers, and the editor's fallback is hidden
*Found in the policy editor.* A server registered as a local command returns "This target returned no tools". Probing cannot work from the cloud. The manual "add tools" path exists but is only reachable after a failed probe, and the YAML tab accepts `rules: [{tool, action}]`, which the docs do not show.
**Suggestion:** show "add tools manually" up front for local-command servers, and document the YAML rule shape.

### 12. `hold` decisions require `userId` to be an email, and say so only in a console log
*Found with `intentgate doctor` once a policy rule used `action: hold`.* The SDK's hold path calls `createDelegationRequest`, which rejects a non-email `userId` with "requesterEmail must be a valid email address". The decision still comes back as `hold`, so nothing breaks, but the delegation that would let a human approve it on the platform is silently never created.
**Suggestion:** validate `userId` at `startSession` when holds are possible, or accept non-email identities for delegation requests.

### What worked well on the platform
- Connect by URL validated the agent in under a second and registered it in one pass.
- The policy review dialog's summary ("allows 2, holds 0, blocks 1, everything else blocked") is exactly the right level.
- The policy page's 7-day decision counters updated within seconds of a test run. That is the proof surface a hackathon judge wants.

---

*Written by Manjunath Irukulla while building IntentGate. Happy to pair on any of these.*
