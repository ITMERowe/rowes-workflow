# Rowe's Workflow

Rowe's whole Claude Code workflow in one repository: two mods (plugins) and three routing agents.

| Part | What it does |
| --- | --- |
| `plugins/cockpit` | One dark band above the prompt that merges four rows into one look. |
| `plugins/savvy-progress` | The agents panel (`/agents-info`), its quest map, the progress band data, and model routing for background agents. |
| `agents/` | `searcher`, `editor` and `reviewer` subagents, each pinned to a model tier. |
| `CLAUDE.md.snippet` | The "Routing" and "Progress" rules that tell Claude when to use each agent and tool. |
| `install.ps1` | Copies `agents/*.md` to `~/.claude/agents` and prints the snippet for you to paste. |

## cockpit: the band rows

| Row | Source | Shows |
| --- | --- | --- |
| FLOW | savvy-progress | The flow title, phase, accepted tasks out of planned, and a `×N agents` button that opens `/agents-info`. |
| TASKS | the app's task list (`update_plan` / `wrap_up`) | One summary line; Show/Hide lists each step with ✓ done, ◐ in progress, ○ pending. |
| SESSION | ponytail | Session cost, plus Review and Audit buttons. |
| USAGE | ribbon | Plan usage (7-day and 5-hour left) and cache WARM/COLD with the next message's cost. |

cockpit draws these rows in place of the ribbon and ponytail bands, so each row appears once. A row whose plugin is not installed is left out.

## savvy-progress: the agents panel

- `/agents-info` toggles the panel; `/agents-info open` opens it without toggling. It lists running, finished and planned subagents with model, effort, task progress, context, estimated cost and time.
- The Map tab is a quest map: each file touched is an island, imports are roads between islands, working crabs walk, and the map has a level (LV) and XP.
- Tools: `mcp__savvy-progress__progress` (the main session reports a flow) and `mcp__savvy-progress__step` (a worker reports its steps).
- `routeModel`: a background subagent with no pinned model runs on Sonnet (Haiku for `Explore`). Agents in its `PINNED` set (`searcher`, `editor`, `reviewer`) and `savvy-*` workers keep their own model.

## Routing

| Task | Agent | Model |
| --- | --- | --- |
| Search or locate code | `searcher` | Haiku, low effort |
| Routine edits | `editor` | Sonnet, medium effort |
| Review of auth, payments, data migrations | `reviewer` | Opus, high effort |
| Everything else | main session | the session's model |

### Why the agents are not plugin agents

The agents install as plain files in `~/.claude/agents`, not as agents inside a plugin. A plugin's agents get a `rowes-workflow:` prefix (for example `rowes-workflow:searcher`). That prefix breaks the routing rules in `CLAUDE.md`, which name `searcher`, `editor` and `reviewer`, and it breaks savvy-progress's `PINNED` set, which would then route the prefixed agents to Sonnet.

## Crab costume legend

Each subagent in the panel is a crab dressed for its task and model:

| Costume | Meaning |
| --- | --- |
| Pirate | Search |
| Engineer | Edit |
| Detective | Review |
| Chef | Anything else on Sonnet |
| Racer | Anything else on Haiku |
| Astronaut | Anything else on Fable |

## Requirements

- Claude Code with mods (plugins with a hooks module).
- The `ponytail` plugin (marketplace `DietrichGebert/ponytail`) for the SESSION row.
- The `ribbon` plugin (marketplace `robonuggets/ribbon`) for the USAGE row.

## Install

Make sure no other copy of savvy-progress is loaded (for example `savvy-progress@claude-kit`, or a folder named in `CLAUDE_CODE_PLUGIN_DIRS`). Two copies draw two panels and report twice.

1. At the prompt of a terminal session, install the two plugins. Answer `y` to add the marketplace, then pick a scope.

   ```
   /plugin install savvy-progress --marketplace <owner>/rowes-workflow
   ```

   ```
   /plugin install cockpit --marketplace <owner>/rowes-workflow
   ```

   From a shell instead:

   ```bash
   claude plugin install savvy-progress --marketplace <owner>/rowes-workflow
   ```

   ```bash
   claude plugin install cockpit --marketplace <owner>/rowes-workflow
   ```

2. Clone this repository and run the installer from its folder:

   ```powershell
   ./install.ps1
   ```

3. Paste the snippet it prints into `~/.claude/CLAUDE.md`.
4. Run `/reload-plugins` or start a new session.

## License

MIT, see `LICENSE`. `plugins/savvy-progress` is a fork of johnnyvizz's MIT-licensed savvy-progress from [claude-kit](https://github.com/JohnnyVizz/claude-kit) and keeps its author and license.
