#!/usr/bin/env sh
# Installs the plugins in plugins.txt.
# It never edits CLAUDE.md: the plugins inject their own rules.
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
echo 'Done. Run /reload-plugins in Claude Code.'
