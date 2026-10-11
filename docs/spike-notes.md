---
title: Day-one spike against the real ArmorIQ API
description: What the SDK and platform actually do with a live key, measured on 2026-10-10.
order: 9
---

# Day-one spike (2026-10-10)

Run with `npx tsx scripts/spike-armoriq.ts <local|sdk|proxy>` and `ARMORIQ_API_KEY` in `.env`.

## What works

- **Plan signing is real.** `session.startPlan()` captures the plan and mints an intent token with a `tokenId`, `planId`, a 64-hex `planHash`, two `stepProofs` and a JWT. First call ~8 s (key validation + IAP), later calls ~2.8 s.
- **Server-side enforcement (`mode: 'sdk'`, `session.enforceSdk()`) returns real policy decisions** from `POST /iap/sdk/enforce` in ~650 ms. With no policy in the org every in-plan tool returns `no_matching_policy: "No policy governs 'read_file'; block by org noMatchAction"`. Off-plan tools are blocked locally with `tool-not-in-plan` before any network call.
- **`session.report()`** succeeds (~1 s) and `flushObservability()` succeeds, so decisions are being sent to the backend.
- The `armoriq` CLI works with only `~/.armoriq/credentials.json` containing `{ "apiKey": "ak_..." }`; no OAuth login needed for `policy show`, `policy set`, `policy propose`.

## What does not work yet

- **`mode: 'local'` fails closed on every call** with `token-signature-invalid`. `GET /iap/public-key` returns `{"alg":"EdDSA","enabled":false,"publicKey":null,"jwk":null}`, so the SDK has no trusted key and refuses to verify. Also, the token's `signature` field starts with `3045...`, which is a DER-encoded ECDSA signature, not Ed25519. Until the backend publishes the key, local verification cannot work. (DX note candidate.)
- **`mode: 'proxy'` and `session.enforce()`** post `enforce_only` to `proxy.armoriq.ai/invoke` and get `Internal Proxy Error` because the MCP `filesystem` is not registered in the org. The SDK surfaces this as "An unexpected error occurred" with no hint. (DX note candidate.)
- The org (`Manjunath Irukulla's Workspace`) has **no agents, no MCP servers, no tool map and no policy** (`client.bootstrap()` and `policy show` both empty).

## Decision

Use **`mode: 'sdk'` with `enforceSdk()`** for the hackathon build. It is the only mode that returns ArmorIQ decisions today, and every decision is made server-side, so it is visible to the platform by construction. Keep argument binding as IntentGate's own second layer and label it as such.

## Platform onboarding still required (dashboard, manual)

1. **Agents → Add Agent**: name `intentgate`, framework MCP, environment Development.
2. **MCP Servers → Add MCP Server**: name `filesystem` (must equal the `<mcp>__` prefix IntentGate uses), URL of a tunnel to `intentgate serve`, protocol `2025-03-26`, capabilities: Tools. Repeat for `fetch`.
3. **Policies → Policy Builder**: connect agent `intentgate` → MCP `filesystem`, Allowed Tools `read_file`, `list_directory`; agent → MCP `fetch`, Allowed Tools `fetch` only (not `http_post`). Status Active.
4. Re-run the spike: `read_file(README.md)` must come back `allowed: true`; `fetch__http_post` must stay blocked.
