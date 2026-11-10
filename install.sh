#!/usr/bin/env sh
# Installs the plugins in plugins.txt and prints the CLAUDE.md snippet.
# It never edits CLAUDE.md: paste the snippet yourself.
set -eu
here=$(cd "$(dirname "$0")" && pwd)

command -v claude >/dev/null 2>&1 || { echo "claude is not on PATH: install Claude Code first" >&2; exit 1; }
grep -v '^#' "$here/plugins.txt" | while read -r id repo; do
  [ -n "$id" ] || continue
  # Adding a marketplace that is already there fails harmlessly.
  claude plugin marketplace add "$repo" </dev/null >/dev/null 2>&1 || true
  if claude plugin install "$id" </dev/null; then echo "Installed $id"; else echo "Could not install $id" >&2; fi
done

echo
echo 'Paste this into ~/.claude/CLAUDE.md, then run /reload-plugins:'
echo '------------------------------------------------------------'
cat "$here/CLAUDE.md.snippet"
echo '------------------------------------------------------------'
