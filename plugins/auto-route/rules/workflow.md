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
