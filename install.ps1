# Installs the plugins in plugins.txt, copies the routing agents to ~/.claude/agents
# and prints the CLAUDE.md snippet. It never edits CLAUDE.md: paste the snippet yourself.
# -AgentsOnly skips the plugins.
param([switch]$AgentsOnly)

if (-not $AgentsOnly) {
  if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Error 'claude is not on PATH: install Claude Code first, or rerun with -AgentsOnly'
    exit 1
  }
  foreach ($line in Get-Content (Join-Path $PSScriptRoot 'plugins.txt')) {
    if ($line -match '^\s*(#|$)') { continue }
    $id, $repo = -split $line
    # Adding a marketplace that is already there fails harmlessly.
    claude plugin marketplace add $repo *> $null
    claude plugin install $id
    if ($LASTEXITCODE -eq 0) { Write-Host "Installed $id" } else { Write-Warning "Could not install $id" }
  }
}

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
Write-Host 'Paste this into ~/.claude/CLAUDE.md, then run /reload-plugins:'
Write-Host '------------------------------------------------------------'
Get-Content (Join-Path $PSScriptRoot 'CLAUDE.md.snippet') -Raw | Write-Host
Write-Host '------------------------------------------------------------'
