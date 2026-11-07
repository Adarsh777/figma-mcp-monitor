$ErrorActionPreference='Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
node .\src.mjs --dashboard-only
