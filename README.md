# Rowe's Workflow

Rowe's whole Claude Code workflow in one repository: one mod (plugin) and three routing agents.

| Part | What it does |
| --- | --- |
| `plugins/savvy-progress` | The band above the prompt, the agents panel (`/agents-info`), and model routing for background agents. |
| `agents/` | `searcher`, `editor` and `reviewer` subagents, each pinned to a model tier. |
| `CLAUDE.md.snippet` | The "Routing" and "Progress" rules that tell Claude when to use each agent and tool. |
| `install.ps1`, `install.sh` | Copy `agents/*.md` to `~/.claude/agents` and print the snippet for you to paste (Windows, macOS/Linux). |

## Quick install

```
/plugin install savvy-progress --marketplace ITMERowe/rowes-workflow
```

```bash
git clone https://github.com/ITMERowe/rowes-workflow && cd rowes-workflow && sh install.sh
```

On Windows run `./install.ps1` instead of `sh install.sh`. Paste the printed snippet into `~/.claude/CLAUDE.md`, then run `/reload-plugins`. Details are under [Install](#install).

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
2. **Row 2, left:** the main session (its current task-list step and last action), running, finished and planned subagents, the task list, and background tasks (small crabs, one colour each). A task-list step handed to a subagent whose description is the step's exact text shows once, as that agent's row.
3. **Row 2, right:** skills and plugins. Ones used since the main session's last turn ended get a full card; the rest (used earlier, or enabled and not used yet) sit in a chip grid. Each has its own crab colour, apart from subagents and background tasks.

Each card scrolls on its own under the wheel. On a narrow pane row 2 stacks into one column. Tools: `mcp__savvy-progress__progress` (the main session reports a flow) and `mcp__savvy-progress__step` (a worker reports its steps). `routeModel`: a background subagent with no pinned model runs on Sonnet (Haiku for `Explore`); agents in its `PINNED` set (`searcher`, `editor`, `reviewer`) and `savvy-*` workers keep their own model.

## Routing

| Task | Agent | Model |
| --- | --- | --- |
| Search or locate code | `searcher` | Haiku, low effort |
| Broad sweep across many files, conclusion only | `Explore` (built in) | Haiku |
| Routine edits | `editor` | Sonnet, medium effort |
| Review of auth, permissions, payments, migrations, deletion, concurrency | `reviewer` | Opus, high effort |
| Messy code, root-cause debugging, multi-file change | `savvy-heavy` (savvy-flow) | Opus |
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
- Optional: the `savvy-flow` plugin (marketplace `JohnnyVizz/claude-kit`) for the `savvy-*` workers the routing rules name.

## Install

Make sure no other copy of savvy-progress is loaded (for example `savvy-progress@claude-kit`, or a folder named in `CLAUDE_CODE_PLUGIN_DIRS`). Two copies draw two panels and report twice.

1. At the prompt of a terminal session, install the plugin. Answer `y` to add the marketplace, then pick a scope.

   ```
   /plugin install savvy-progress --marketplace ITMERowe/rowes-workflow
   ```

   From a shell instead:

   ```bash
   claude plugin install savvy-progress --marketplace ITMERowe/rowes-workflow
   ```

2. Clone this repository and run the installer from its folder. It backs up any agent file it replaces as `<name>.md.bak`.

   ```bash
   git clone https://github.com/ITMERowe/rowes-workflow
   ```

   Windows (PowerShell):

   ```powershell
   ./install.ps1
   ```

   macOS or Linux:

   ```bash
   sh install.sh
   ```

3. Paste the snippet it prints into `~/.claude/CLAUDE.md`.
4. Run `/reload-plugins` or start a new session.

## Developing

From `plugins/savvy-progress`, after each change:

```bash
claude plugin validate .
```

```bash
claude plugin test .
```

## License

MIT, see `LICENSE`. `plugins/savvy-progress` is a fork of johnnyvizz's MIT-licensed savvy-progress from [claude-kit](https://github.com/JohnnyVizz/claude-kit) and keeps its author and license.
