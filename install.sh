#!/usr/bin/env sh
# Copies the routing agents to ~/.claude/agents and prints the CLAUDE.md snippet.
# It never edits settings.json or CLAUDE.md: paste the snippet yourself.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
dest="$HOME/.claude/agents"
mkdir -p "$dest"
for f in "$here"/agents/*.md; do
  target="$dest/$(basename "$f")"
  if [ -f "$target" ]; then cp "$target" "$target.bak"; echo "Backed up $target to $target.bak"; fi
  cp "$f" "$target"
  echo "Installed $target"
done
echo
echo 'Paste this into ~/.claude/CLAUDE.md:'
echo '------------------------------------------------------------'
cat "$here/CLAUDE.md.snippet"
echo '------------------------------------------------------------'
