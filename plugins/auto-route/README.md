# auto-route

A model-routing plugin for Claude Code. It works on its own: no other plugin is needed.

- **The routing model.** The main session's system prompt gets an agent table and rules: which work goes to which subagent and model. Subagents don't get it, so they never delegate further.
- **A note on each prompt.** Each prompt you type gets a hidden note naming the table row it matches and up to three skills that fit. Slash commands are left alone.
- **The agents.** Seven agents ship in `agents/`, so installing the plugin installs them.

| Work | Agent | Model |
|---|---|---|
| Bug that resists ordinary debugging, only when you ask for Fable | `auto-route:fable` | fable |
| Auth, permissions, payments, migrations, deletion, concurrency, security | `auto-route:reviewer` | opus |
| Messy code, root-cause debugging, multi-file change with invariants | `auto-route:heavy` | opus, extra-high effort |
| Read a guide, post, doc page or link | `auto-route:reader` | haiku |
| Locate code: "where is X", "what calls Y" | `auto-route:searcher` | haiku |
| Broad sweep across many files, conclusion only | `auto-route:explore` | haiku |
| Bounded edit: rename, known-cause bug, boilerplate, tests | `auto-route:editor` | sonnet |
| Anything else | main session | session model |

## Install

```bash
claude plugin marketplace add ITMERowe/rowes-workflow
claude plugin install auto-route@rowes-workflow
```

Then run `/reload-plugins`.

Optional: run `/advisor opus` to give the main session an Opus advisor. The rules tell Claude to consult it on hard work, before it hands that work to an Opus subagent.

## Change the routing

The table, the per-prompt keywords and the skill list are in `hooks/register.ts`:

- `ROUTES`: the agent for each kind of work. The first row whose keyword test matches a prompt is the one its note names.
- `SKILLS`: the skill keywords.

The notes come from a keyword list, so some prompts will match the wrong row or none. Claude treats a note as a hint, and the table decides.

## Credits

The routing tiers come from [savvy-flow](https://github.com/JohnnyVizz/claude-kit) by JohnnyVizz: `heavy` and `fable` follow its savvy-heavy and savvy-fable workers. If [savvy-progress](https://github.com/ITMERowe/rowes-workflow/tree/main/plugins/savvy-progress) is installed, its agents panel shows these agents with their models. Neither plugin is needed.
