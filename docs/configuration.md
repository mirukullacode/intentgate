---
title: Configuration
description: Every option in intentgate.config.json.
order: 4
---

# Configuration

IntentGate reads `intentgate.config.json` from the current folder, from `--config <file>`, or from `INTENTGATE_CONFIG`. `npx intentgate init` writes one to `~/.intentgate/intentgate.config.json`.

`${VAR}` anywhere in the file is replaced with the environment variable `VAR`.

```json
{
  "servers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" }
    },
    "crm": { "url": "https://crm.example.com/mcp", "headers": { "Authorization": "Bearer ${CRM_TOKEN}" } }
  },
  "engine": "armoriq",
  "binding": "strict",
  "armoriq": { "userId": "support-team", "agentId": "voice-desk", "validitySeconds": 900 },
  "approvals": { "timeoutSeconds": 120 },
  "recorder": { "enabled": true, "port": 4747 },
  "http": { "port": 8787 },
  "voice": { "enabled": true, "voiceId": "JBFqnCBsd6RMkjVDRZzb", "modelId": "eleven_flash_v2_5" }
}
```

| Key | Default | What it does |
|---|---|---|
| `servers` | required | MCP servers to protect. Each is either `{ command, args, env, cwd }` (stdio) or `{ url, headers }` (Streamable HTTP). The key becomes the tool prefix: `github__create_issue`. Letters, digits and dashes only |
| `engine` | `armoriq` | `armoriq` signs plans with ArmorIQ (needs `ARMORIQ_API_KEY`). `offline` enforces without signing, for local testing |
| `binding` | `strict` | `strict` checks declared arguments. `tool-only` relies on ArmorIQ's tool-level check alone |
| `armoriq.userId` / `agentId` | `intentgate-user` / `intentgate` | Identity attached to plans in ArmorIQ's audit trail |
| `armoriq.validitySeconds` | `900` | Lifetime of each intent token |
| `approvals.timeoutSeconds` | `120` | How long a held call or plan change waits for a human before it's denied |
| `recorder.enabled` / `port` | `true` / `4747` | The Flight Recorder (binds to 127.0.0.1 only) |
| `http.port` | `8787` | Port for `intentgate serve` |
| `http.authToken` | none | Token required on every HTTP request. Prefer `--token` or `INTENTGATE_HTTP_TOKEN` |
| `voice.*` | on | ElevenLabs voice and model for spoken alerts. Needs `ELEVENLABS_API_KEY` |

## Environment variables

| Variable | Used for |
|---|---|
| `ARMORIQ_API_KEY` | Signing plans and enforcing policies with ArmorIQ |
| `ELEVENLABS_API_KEY` | Spoken alerts in the Flight Recorder |
| `INTENTGATE_HTTP_TOKEN` | Auth token for `intentgate serve` |
| `INTENTGATE_CONFIG` | Default config path |
| `INTENTGATE_HOME` | Where session logs are written (default `~/.intentgate`) |
