# Changelog

## 0.1.0 (October 2026)

First release, built during the ArmorIQ × ElevenLabs Flow State hackathon.

- MCP gateway over stdio (`run`) and Streamable HTTP (`serve`)
- ArmorIQ engine: signed plans via `ArmorIQSession.startPlan`, local enforcement via `enforceLocal`, outcome reporting
- Argument binding with path normalization and globs
- `declare_plan` (once per conversation) and `amend_plan` (human approval)
- Policy holds routed to human approval
- Flight Recorder UI with live timeline, approvals and replay
- ElevenLabs spoken alerts for blocks and approval requests
- CLI: `init`, `uninstall`, `run`, `serve`, `demo`, `collector`, `ui`, `doctor`
- Offline engine for local testing
