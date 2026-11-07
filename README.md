# Figma MCP Monitor — v0.3 (proposed)

Local **Claude Code → Figma Desktop MCP** logging proxy and independently running dashboard.

> **Not an official Figma quota counter.** Only requests routed through `figma-monitor` are logged. Calls made through the regular Figma plugin are not observed. Remaining Figma quota is unknown.

## What's new in v0.3
- MCP proxy runs **headless** by default: no port 4179 conflict with dashboard.
- Standalone dashboard can run even while Claude Code is closed.
- Dashboard displays the latest proxy heartbeat (connected / offline) rather than assuming that a running dashboard means Figma is connected.
- Optional Windows per-user Startup shortcut to launch dashboard on sign-in (does not modify Windows services or require administrator privileges).
- Persistent `data/calls.jsonl` history is shared by both processes.
- Existing upstream Figma Desktop MCP connection and Claude registration remain unchanged.

## Installation / upgrade on Windows

**Don't merge the PR until you've reviewed it.** Test the feature branch separately:

```powershell
git fetch origin
git switch feature/v0.3-background-dashboard
npm install
npm run smoke
```

Backup `data/calls.jsonl` before changing branches. Local data remains ignored by Git.

### Run the dashboard separately

```powershell
npm run dashboard
```

Open <http://127.0.0.1:4179>. This shows saved usage, even if Claude Code is closed. The proxy connection indicator shows **offline** when no recent heartbeat exists.

Open Claude Code normally and run `claude mcp list`. Existing `figma-monitor` registration should still work; you do **not** need to remove or reinstall it. Run a monitored Figma call and verify the dashboard updates.

> Restart Claude Code after switching branches to ensure it launches the new proxy source.

### Automatically start dashboard when you sign into Windows (optional)

From PowerShell in the repo root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows-startup.ps1
```

This installs a shortcut in your **current user's Windows Startup folder** to launch the dashboard after sign-in. It does **not** run Figma or Claude automatically. You can also launch the dashboard manually using `npm run dashboard`.

To remove the startup shortcut:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows-startup.ps1 -Remove
```

If another dashboard is already running on port 4179, stop it before starting a second one. Do **not** run `npm run dashboard` and the Startup dashboard simultaneously.

### Legacy / testing mode
If you want the pre-v0.3 behavior of Claude launching the dashboard inside the proxy process, run `node src.mjs --with-dashboard`; this is intended for troubleshooting, not the standard setup.

## Commands
- `npm start`: run MCP proxy in headless mode (normally Claude Code launches it)
- `npm run demo`: demo MCP tool in headless mode
- `npm run smoke`: automated demo MCP smoke test
- `npm run dashboard`: standalone dashboard on port 4179
- `npm run dashboard:windows`: PowerShell dashboard helper
- `npm run startup:install`: add current-user Windows Startup shortcut
- `npm run startup:remove`: remove shortcut

## Configuration
- `FIGMA_MCP_URL`: upstream desktop MCP URL, default `http://127.0.0.1:3845/mcp`
- `MONITOR_PORT`: dashboard port, default 4179
- `MONITOR_LIMIT`: illustrative daily allowance, default 200 (not verified)
- `MONITOR_TIMEZONE`: local timezone by default
- `MONITOR_LOG_PATH`: usage logs, default `data/calls.jsonl`
- `MONITOR_RUNTIME_PATH`: proxy heartbeat JSON, default `data/proxy-state.json`
- `MONITOR_CLIENT`: default `Claude Code`

## Security / limits
The dashboard binds to `127.0.0.1`; it has no remote listener or authentication. Usage metadata and runtime health files are stored only in the excluded `data/` directory; do not commit them or any credentials. No guarantee is made about global Figma quota usage.

## Development
Keep `main` stable. Review v0.3 via pull request; merge after Windows validation.
