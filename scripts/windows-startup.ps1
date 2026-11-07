param(
  [switch]$Remove
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$startup = [Environment]::GetFolderPath('Startup')
$linkPath = Join-Path $startup 'Figma MCP Monitor Dashboard.lnk'
if ($Remove) {
  if (Test-Path $linkPath) { Remove-Item $linkPath -Force; Write-Host 'Removed dashboard startup shortcut.' }
  else { Write-Host 'Dashboard startup shortcut not installed.' }
  exit 0
}
$nodeCommand = Get-Command node.exe -ErrorAction Stop
$nodePath = $nodeCommand.Source
$scriptPath = Join-Path $repo 'src.mjs'
if (-not (Test-Path $scriptPath)) { throw "Missing tracker entry point: $scriptPath" }
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($linkPath)
$shortcut.TargetPath = $nodePath
$shortcut.Arguments = '"' + $scriptPath + '" --dashboard-only'
$shortcut.WorkingDirectory = $repo
$shortcut.WindowStyle = 7
$shortcut.Description = 'Start local Figma MCP Monitor dashboard when signing into Windows'
$shortcut.Save()
Write-Host "Installed user startup shortcut: $linkPath"
Write-Host "Dashboard: http://127.0.0.1:4179 (starts on next Windows sign-in)"
Write-Host "Note: Only dashboard starts automatically. Claude Code still launches the MCP proxy."
