---
title: Takeaways
description: What we learned, what we would do with another month, and where this goes next.
order: 11
---

# Takeaways

## Insight: three things we did not know on day one

1. **The model is not the safety layer, and it should not have to be.** Claude Opus 5.5, Opus 4.8 and Haiku 5.5 all read our poisoned README, recognised the hidden instruction and refused it. We did not tune the attack to beat them. The scripted agent shows what happens when a model does not refuse: the key is gone in three seconds without the gateway, and blocked twice with it. The point of intent enforcement is that the outcome stops depending on which model you woke up with.

2. **Tool-level plans have an argument-shaped hole.** `read_file(README.md)` and `read_file(.ssh/id_rsa)` are the same tool, so a plan that allows the first allows the second. Argument binding, with path normalisation and globs, is a small layer that closes most of it. It should live in the platform, and our implementation is offered as the reference.

3. **The platform is further along than its docs, and the SDK source is the real manual.** Twelve findings in a week, from a policy-intersection bug to a registration path that demands a URL it never asks for. Every one came from reading `.d.ts` files and hitting the live API, not from the docs site. That is a documentation gap worth closing, and it is the kind of gap a Developer Products team exists to close.

## Ambition: where this goes

- **The MCP adapter for ArmorIQ.** ArmorIQ's plugins cover five specific clients. IntentGate covers everything that speaks MCP, which includes the clients people actually use, and voice. Shipped as `npx intentgate-mcp init`, it turns every MCP user into a potential ArmorIQ user with zero integration work.
- **Intent for voice.** Phone agents are the softest target for social engineering and the least covered. One signed plan per call, holds to a supervisor with a spoken alert, is a product on its own.
- **Receipts.** Every session already has a plan hash, a token ID and a decision log. A customer-facing receipt page, "here is what the agent was allowed to do and what it did", is a week of work on top of what exists.

## Next steps, in order

1. Upstream argument binding as an opt-in `argumentBinding: 'strict'` session option in the SDK, with our tests.
2. A "protect any MCP server" cookbook entry on docs.armoriq.ai, with IntentGate as the reference implementation.
3. Use ArmorIQ's own delegation flow for holds once `userId` accepts non-email identities, so approvals happen on the platform, not only in the recorder.
4. Local verification mode the day the IAP public key is published; the code path already exists and fails closed today.
5. A hosted playground per customer: the same one-click demo, against their policy, on their tools. That is the sales demo.

## What we would do differently

Start with `doctor`. The per-tool allow, hold, block report would have saved the first day of "why is everything blocked". It is now the first thing a new user runs.
