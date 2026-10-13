---
title: CLI reference
description: Every intentgate command.
order: 5
---

# CLI reference

Run any command with `npx intentgate-mcp <command>`. Add `--help` to see its options.

| Command | What it does |
|---|---|
| `init` | Imports the MCP servers from Claude Desktop (or `--client cursor`), routes them through IntentGate, and backs up the original config. Options: `--config`, `--api-key`, `--offline`, `--no-import`, `--local` |
| `uninstall` | Restores the backed-up client config |
| `run` | Runs the gateway over stdio. This is what MCP clients launch. Options: `--config`, `--offline` |
| `serve` | Runs the gateway over Streamable HTTP at `/mcp`, for ElevenLabs agents and remote clients. Options: `--port`, `--token`, `--config`, `--offline` |
| `demo [dir]` | Creates the attack demo: a poisoned workspace, a fake key, and the `workspace`, `web` and `shop` servers |
| `collector` | Runs the demo's fake attacker endpoint on `localhost:9999` |
| `ui` | Opens the Flight Recorder on its own to replay saved sessions. Options: `--file`, `--port` |
| `doctor` | Checks Node, API keys, config, each downstream server and the recorder port |

## Logs

In stdio mode, stdout belongs to the MCP protocol, so IntentGate logs to **stderr**. Claude Desktop shows these in its MCP log files.

## Several clients at once

The first IntentGate process to start owns the Flight Recorder on port 4747. Later processes (another client, or `serve` next to `run`) detect this and stream their sessions to it, so you always have one recorder with every agent in it.
