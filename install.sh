#!/usr/bin/env sh
# Installs the plugins in plugins.txt, copies the routing agents to ~/.claude/agents
# and prints the CLAUDE.md snippet. It never edits CLAUDE.md: paste the snippet yourself.
# --agents-only skips the plugins.
set -eu
here=$(cd "$(dirname "$0")" && pwd)

if [ "${1:-}" != "--agents-only" ]; then
  command -v claude >/dev/null 2>&1 || { echo "claude is not on PATH: install Claude Code first, or rerun with --agents-only" >&2; exit 1; }
  grep -v '^#' "$here/plugins.txt" | while read -r id repo; do
    [ -n "$id" ] || continue
    # Adding a marketplace that is already there fails harmlessly.
    claude plugin marketplace add "$repo" </dev/null >/dev/null 2>&1 || true
    if claude plugin install "$id" </dev/null; then echo "Installed $id"; else echo "Could not install $id" >&2; fi
  done
fi

dest="$HOME/.claude/agents"
mkdir -p "$dest"
for f in "$here"/agents/*.md; do
  target="$dest/$(basename "$f")"
  if [ -f "$target" ]; then cp "$target" "$target.bak"; echo "Backed up $target to $target.bak"; fi
  cp "$f" "$target"
  echo "Installed $target"
done
echo
echo 'Paste this into ~/.claude/CLAUDE.md, then run /reload-plugins:'
echo '------------------------------------------------------------'
cat "$here/CLAUDE.md.snippet"
echo '------------------------------------------------------------'
