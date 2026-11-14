# Workflow rules

## Skills and voice
- A style plugin's voice rules win over a skill's own announcement rules. Never write "Using [skill] to [purpose]".
- Load a skill only when its description clearly fits the task. Not before a short answer, a question, or a read-and-explain turn.
- Skill checklists go into the task-list tool, not into chat text.

## Who owns what in an answer
- A terse-voice plugin owns the words, the shape rules above own the layout, a code-style plugin owns the code. When none is installed, keep answers short and plain.
- Ending: one last line at most, `Next: <action>. Not checked: <gap or risk>.` Leave out the empty part. Skip it when the task list already says it.
- Do not restate in chat what the task list shows.
- Security warnings and irreversible actions: full sentences. Files, commits and comments: normal prose.

## Repo hygiene
Test for any file: would someone who clones the repo need it to install, build, test or understand the project? If not, keep it local.
- Commit: source, build and dependency config with its lock file, tests, CI, human docs (README, LICENSE, CHANGELOG), `.gitignore`.
- Keep local (git-ignore): AI tool folders and notes (`.claude/`, `.cursor/`, `CLAUDE.md`, `AGENTS.md`, `HANDOFF.md`), caches and indexes, scratch previews, test or browser output, build output, dependencies. `HANDOFF.md` is for the next Claude session; `CHANGELOG.md` is for people and is committed.
- Never commit secrets (`.env*`, keys, certificates, credential files). If one leaks, revoke it first: rewriting history does not make it safe.
- Before editing, run `git status`. Leave unrelated uncommitted changes alone and name them.
- Stage files by name, never `git add -A`. One logical change per commit; the message says why. Commit and push only when asked. Before a push, read `git diff --staged` for stray files and secrets, and run the tests.
- Rewriting history, force-push, `git rm` of tracked files, branch deletion: only when the user asks. Back up first and use `--force-with-lease`.

## Code changes
- Before the first code edit in a session, invoke a code-style skill if one is installed (for example ponytail) and follow it for every change.
- Once per task, when its code changes are done (not after each edit), add an entry at the top of CHANGELOG.md at the repo root (create it if missing): today's date, then each changed file and section with one line on what and why. Update HANDOFF.md in the same pass: what changed and what is left, deleting anything no longer true. One edit each; in chat, link the entry instead of repeating it.
- Pick the lightest stack the task needs: the platform first, zero runtime dependencies, and a framework only when the task needs client-side state. A content site is static pages, not a single-page app.
- Ship every new project or feature with at least one automated check that can fail, using the stack's own tools: a test runner, a linter or type checker, or a check on the built output (links, assets, schema, exit codes). If the project has none, add the smallest one, run it, and report only the results you actually saw.
- Use dependency versions that install and build cleanly. Do not upgrade packages or chase audit advisories unless the task asks or the build fails; note a known advisory in the handoff instead.
- When a tool can batch steps (for example a browser tool's batch call), send them in one call instead of one call per step.
