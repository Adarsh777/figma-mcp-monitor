# Figma MCP Monitor — v0.2

Local **Claude Code → Figma Desktop MCP** logging proxy and dashboard.

> **Not an official Figma quota counter.** Only requests explicitly routed through `figma-monitor` are logged. Calls through the regular `plugin:figma:figma` connection are not observed. The exact remaining quota is unknown.

## Features
- Automatic dashboard refresh every three seconds
- Tool call history, success/error status, and durations
- Usage chart and tool-level breakdown
- Conservative quota classification: documented exempt / unknown / demo excluded
- Proxy and upstream health information
- Local usage logs, excluded from Git

## Requirements
Node.js 20+; Claude Code on Windows; Figma Desktop MCP enabled (default upstream `http://127.0.0.1:3845/mcp`).

## Installation
```powershell
npm install
npm run smoke
$trackerPath = (Resolve-Path .\src.mjs).Path
claude mcp add --scope user figma-monitor -- node "$trackerPath"
claude mcp list
```

Restart Claude Code, make a Figma MCP call through `figma-monitor`, and open http://127.0.0.1:4179.

## Commands
- `npm start`: run tracker proxy (normally Claude Code launches it)
- `npm run demo`: dummy MCP tool test mode
- `npm run smoke`: local automated MCP smoke test
- `npm run dashboard`: view existing logs without connecting to Figma

Do not run more than one dashboard process on port 4179.

## Configuration
- `FIGMA_MCP_URL`: upstream desktop MCP URL
- `MONITOR_PORT`: default `4179`
- `MONITOR_LIMIT`: configured reference daily limit, default `200` (not verified)
- `MONITOR_TIMEZONE`: default system timezone
- `MONITOR_LOG_PATH`: default `data/calls.jsonl`
- `MONITOR_CLIENT`: default `Claude Code`

## Security and accuracy
Runs on `127.0.0.1`; no remote access or built-in login. Metadata is stored locally. Do not commit usage logs, credentials, environment files, or `node_modules`. A successful proxy call does **not** prove a quota unit was consumed. Other clients' usage and reset rules cannot be inferred.

## Development workflow
Keep `main` stable. Develop future features on branches, open a PR for review, then merge after validation. The current package is `0.2.0`.
