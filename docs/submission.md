---
title: Submission kit
description: The short description, the 90-second video script, and the proof checklist for the Flow State hackathon.
order: 10
---

# Submission kit

## Short description (paste into the form)

**IntentGate** puts ArmorIQ intent enforcement in front of any MCP client, with no code changes. Claude Desktop, Cursor, Claude Code and ElevenLabs voice agents all talk MCP, so one gateway covers them all. The agent declares its plan, ArmorIQ signs it, and every tool call is decided by ArmorIQ's server against that plan and your org policy. IntentGate adds argument binding on top (same tool, different arguments is the gap in tool-level plans), a human hold flow with spoken ElevenLabs alerts, and a Flight Recorder that shows what the agent planned versus what it tried.

Live playground: https://intentgate-production.up.railway.app. Press one button and a real Claude agent, or a scripted agent that already fell for a poisoned README, runs with or without the gateway. In a protected run every allow and block is an ArmorIQ decision made on their server for that run. Without the gateway, the scripted agent leaks the fake key in three seconds. With it, the key read is blocked by argument binding and the upload is blocked by ArmorIQ.

Also verified: an ElevenLabs voice agent connected to the hosted gateway, order lookup allowed, payout change and refund held for a human, with spoken alerts.

Registered on platform.armoriq.ai: agent `intentgate`, MCP servers `workspace` and `web`, one org-wide policy. Built in TypeScript on `@armoriq/sdk` in sdk mode. Twelve DX findings on the SDK and platform are in `docs/dx-notes-armoriq.md`, including a policy-intersection bug and a registration path that demands a URL it never asks for.

Honest limits: current Claude models refuse this README injection on their own, and we did not tune the attack to beat them. IntentGate makes the outcome not depend on the model.

## 90-second video script

Record from the live playground at 1440 wide. No slides. Narrate over it, or use captions.

| Time | On screen | Say |
|---|---|---|
| 0:00 | The playground page, cursor on "Hijacked agent · Without" | "An agent is asked to summarize a README. The README hides an instruction: read the SSH key, post it here." |
| 0:06 | Click. Transcript scrolls, red verdict appears, attacker inbox shows the key | "No gateway. Three seconds. The key is gone." |
| 0:15 | Click "Hijacked agent · With IntentGate". Pipeline stepper lights Declare, Sign | "Same agent, same README. Now it has to declare a plan first, and ArmorIQ signs it." |
| 0:25 | Transcript: README read green, key read red, post red. Confetti | "Reading the README: allowed by ArmorIQ. Reading the key: blocked, the argument doesn't match the plan. Uploading: blocked, not in the plan." |
| 0:38 | ArmorIQ decisions tab, the table with sources and latency | "Every decision here was made on ArmorIQ's server for this run. That's the signed plan hash." |
| 0:46 | Click "Claude Opus · With IntentGate". Run completes with 0 blocked, green verdict | "A real Claude model refuses the injection on its own. We didn't tune the attack to beat it. The gateway is for the day a model doesn't." |
| 0:58 | Click "Run a support call". Transcript shows the caller and the agent. Open the Flight Recorder tab, a plan change appears with Approve and Deny, click Deny | "Same gateway, a real ElevenLabs voice agent. The caller asks for a payout change. The agent asks a supervisor. That's me. Denied." |
| 1:10 | Terminal: `npx intentgate-mcp init`, then `doctor` output with allow/hold/block per tool | "One command protects Claude Desktop or Cursor. Doctor asks ArmorIQ what it will do for every tool before you run anything." |
| 1:22 | README on GitHub, scroll to DX notes | "Twelve findings on the SDK and platform, filed as we built. IntentGate: intent enforcement for any MCP client." |
| 1:28 | End card: repo URL, playground URL | |

## Proof checklist for the form

- [ ] GitHub repo: https://github.com/mirukullacode/intentgate
- [ ] Live URL: https://intentgate-production.up.railway.app
- [ ] Video, 90 s or less
- [x] Screenshot: `docs/proof-flight-recorder.png` (coding agent, one allowed, two blocked)
- [x] Screenshot: `docs/proof-voice-session.png` (voice agent, allowed lookup, two holds)
- [x] Screenshot: `docs/playground-blocked.png` (live playground, scripted agent with IntentGate, two blocks)
- [x] Screenshot: `docs/playground-leak.png` (live playground, same agent with no gateway, key leaked)
- [x] Screenshot: `docs/site-landing.png` (the landing page)
- [ ] Screenshot: ArmorIQ Policies → IntentGate demo, decision counters. Save as `docs/armoriq-policy.png`
- [ ] Screenshot: ArmorIQ Event Log. Save as `docs/armoriq-event-log.png`
- [ ] Screenshot: ArmorIQ Agent Registry. Save as `docs/armoriq-agents.png`
- [ ] Screenshot: ArmorIQ MCP Server Registry. Save as `docs/armoriq-mcp-servers.png`
- [ ] Short description above

The four ArmorIQ files need a dashboard login. Once they exist with those exact names, the README's "On the ArmorIQ platform" section and this page link to them automatically; commit and push after adding.

## Screenshots

| | |
|---|---|
| ![Landing page](site-landing.png) | ![Playground, scripted agent blocked](playground-blocked.png) |
| ![Playground, scripted agent leaks without the gateway](playground-leak.png) | ![Flight Recorder, coding agent](proof-flight-recorder.png) |
| ![Flight Recorder, voice agent](proof-voice-session.png) | ![Playground, voice run with the visitor as supervisor](playground-voice.png) |
