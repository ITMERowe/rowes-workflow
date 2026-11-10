# Installs the plugins in plugins.txt and prints the CLAUDE.md snippet.
# It never edits CLAUDE.md: paste the snippet yourself.

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Error 'claude is not on PATH: install Claude Code first'
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

Write-Host ''
Write-Host 'Paste this into ~/.claude/CLAUDE.md, then run /reload-plugins:'
Write-Host '------------------------------------------------------------'
Get-Content (Join-Path $PSScriptRoot 'CLAUDE.md.snippet') -Raw | Write-Host
Write-Host '------------------------------------------------------------'
