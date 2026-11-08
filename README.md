# Rowe's Workflow

Rowe's whole Claude Code workflow in one repository: one mod (plugin), three routing agents, and graphify for the project map.

| Part | What it does |
| --- | --- |
| `plugins/savvy-progress` | The band above the prompt, the agents panel (`/agents-info`) with its project map, and model routing for background agents. |
| `agents/` | `searcher`, `editor` and `reviewer` subagents, each pinned to a model tier. |
| `CLAUDE.md.snippet` | The "Routing" and "Progress" rules that tell Claude when to use each agent, tool and graphify. |
| `install.ps1` | Copies `agents/*.md` to `~/.claude/agents` and prints the snippet for you to paste. |

## The band above the prompt

One card in the panel's look, each bar the savvy pixel bar filling its row:

| Row | Source | Shows |
| --- | --- | --- |
| FLOW | savvy-progress | The flow title, tasks accepted out of planned, the percent, and a `×N` button that opens `/agents-info`. |
| USAGE | ribbon | Plan usage left for the 7-day and 5-hour windows, side by side, each with its reset time. Red under 20% left. |

The band stands in for ribbon's and ponytail's own rows, so nothing shows twice.

## The agents panel

`/agents-info` toggles the panel; `/agents-info open` opens it without toggling.

1. **Row 1:** cost, tokens and time for the session's subagents.
2. **Row 2, left:** the main session (its current task-list step and last action), running, finished and planned subagents, the task list, and background tasks (small crabs, one colour each).
3. **Row 2, right:** skills and plugins. Active ones (used in the last 5 minutes) first, then ones used earlier, then enabled plugins not used yet. Each has its own crab colour, apart from subagents and background tasks.
4. **Row 3, the Map:** graphify's map of the project. Each card is a community of code (its files and symbols, a bar of files edited this session), linked where the code calls across. A crab sits on the card each agent, subagent and background task is working in; commands, web and searches sit on "Terminal & web". The **Build project map** / **Rebuild map** button runs `graphify update .`.

On a narrow pane row 2 stacks into one column. Tools: `mcp__savvy-progress__progress` (the main session reports a flow) and `mcp__savvy-progress__step` (a worker reports its steps). `routeModel`: a background subagent with no pinned model runs on Sonnet (Haiku for `Explore`); agents in its `PINNED` set (`searcher`, `editor`, `reviewer`) and `savvy-*` workers keep their own model.

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
- The `ponytail` plugin (marketplace `DietrichGebert/ponytail`).
- The `ribbon` plugin (marketplace `robonuggets/ribbon`) for the USAGE row.
- graphify for the Map: `pip install graphifyy`, then `graphify update .` in the project root (or the panel's Build button). It writes `graphify-out/`, which this repo ignores.

## Install

Make sure no other copy of savvy-progress is loaded (for example `savvy-progress@claude-kit`, or a folder named in `CLAUDE_CODE_PLUGIN_DIRS`). Two copies draw two panels and report twice.

1. At the prompt of a terminal session, install the plugin. Answer `y` to add the marketplace, then pick a scope.

   ```
   /plugin install savvy-progress --marketplace <owner>/rowes-workflow
   ```

   From a shell instead:

   ```bash
   claude plugin install savvy-progress --marketplace <owner>/rowes-workflow
   ```

2. Clone this repository and run the installer from its folder:

   ```powershell
   ./install.ps1
   ```

3. Paste the snippet it prints into `~/.claude/CLAUDE.md`.
4. Run `/reload-plugins` or start a new session.

## License

MIT, see `LICENSE`. `plugins/savvy-progress` is a fork of johnnyvizz's MIT-licensed savvy-progress from [claude-kit](https://github.com/JohnnyVizz/claude-kit) and keeps its author and license.
