# Copies the routing agents to ~/.claude/agents and prints the CLAUDE.md snippet.
# It never edits settings.json or CLAUDE.md: paste the snippet yourself.
$ErrorActionPreference = 'Stop'
$dest = Join-Path $HOME '.claude\agents'
New-Item -ItemType Directory -Force $dest | Out-Null
foreach ($f in Get-ChildItem (Join-Path $PSScriptRoot 'agents') -Filter *.md) {
  $target = Join-Path $dest $f.Name
  if (Test-Path $target) { Copy-Item $target "$target.bak" -Force; Write-Host "Backed up $target to $target.bak" }
  Copy-Item $f.FullName $target -Force
  Write-Host "Installed $target"
}
Write-Host ''
Write-Host 'Paste this into ~/.claude/CLAUDE.md:'
Write-Host '------------------------------------------------------------'
Get-Content (Join-Path $PSScriptRoot 'CLAUDE.md.snippet') -Raw | Write-Host
Write-Host '------------------------------------------------------------'
