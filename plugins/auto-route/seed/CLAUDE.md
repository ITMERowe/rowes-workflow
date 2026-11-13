## Routing
The auto-route plugin holds the routing model and its agents (`auto-route:*`): it adds the agent table and rules to the main session's system prompt, and an `auto-route:` note to each prompt naming the row and skills that fit. Edit the table in `plugins/auto-route/hooks/register.ts`. If auto-route is off, route by the agent descriptions.

## Progress
- For any multi-step task, report through the hideout `progress` tool (title, phase, tasks, done) when it is available. Update it as each step finishes and set `finished` at the end.
- The user watches the agents panel (`/agents-info`, opens itself each session): it lists agents, background tasks, and a Map of files touched with what they import.
- Put work in the open: run long jobs as background tasks or subagents so they show in the panel. Background subagents with no pinned model auto-route to Sonnet (Haiku for Explore); pass `model` explicitly to override.
- The `hideout` plugin must be on: its band above the prompt shows plan usage (7-day and 5-hour left). If `"hideout@exiles"` is `false` in `~/.claude/settings.json` or the band is missing, tell the user at session start; do not edit settings yourself.
- The crab costume shows the task and model: pirate = search, engineer = edit, detective = review, else chef = Sonnet, racer = Haiku, astronaut = Fable.

## Skills vs. caveman voice
- caveman voice wins over superpowers' using-superpowers rules. Never write "Using [skill] to [purpose]" or any other skill announcement.
- Load a skill only when its description clearly fits the task. Do not load skills before a short answer, a question, or a read-and-explain turn.
- Skill checklists go into the task-list tool, not into chat text.

## Style plugins: who owns what
- caveman owns the words: short, no filler, no greetings, no recap. Default reply 5 lines max. Longer only when the user asks to explain.
- i-have-adhd owns the shape: first line is the action or answer, numbered steps only for real multi-step work, no tangents, concrete time estimate only for multi-step work.
- ponytail owns the code: smallest complete change, reuse before writing, one small test for new logic.
- Ending: one last line at most, `Next: <action>. Not checked: <gap or risk>.` Leave out the part that is empty. Skip it when the task box already says it. This replaces adhd's "next action" and ponytail's "skipped" lines.
- Do not restate state in chat when the task box shows it.
- Security warnings and irreversible actions: full sentences, whatever the rules above say.
- Files, commits and comments follow ponytail and normal prose, not caveman voice.

## Repo hygiene
Test for any file: would someone who clones the repo need it to install, build, test or understand the project? If not, keep it local.
- Commit: source, build and dependency config with lock file, tests, CI, human docs (README, LICENSE, CHANGELOG), `.gitignore`.
- `HANDOFF.md` is for the next Claude session, not for other developers. Keep it local and git-ignored. `CHANGELOG.md` is for people and is committed.
- Keep local (git-ignore): AI tool folders (`.claude/`, `.cursor/`, ...), AI notes and instruction files (`CLAUDE.md`, `AGENTS.md`, `HANDOFF.md`), generated caches and indexes, scratch previews and generator scripts, test or browser output, build output and dependencies.
- Never commit secrets: `.env*`, keys, certificates, credential files. If one leaks, revoke it first. Rewriting history does not make it safe.
- Before editing, run `git status`. Leave unrelated uncommitted changes alone and name them.
- Stage files by name, never `git add -A`. One logical change per commit; the message says why. Commit and push only when asked.
- Before a push, read `git diff --staged` for stray files and secrets, and run the tests.
- Rewriting history, force-push, `git rm` of tracked files, branch deletion: only when the user asks. Back up first and use `--force-with-lease`.
- Team exception: if the repo shares `CLAUDE.md` on purpose, committing it is fine. Keep it free of personal paths and secrets.

# graphify
- **graphify** (`~/.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.
