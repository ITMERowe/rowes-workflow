# Rowe's Workflow

Rowe's whole Claude Code workflow in one repository: two mods (plugins) and five routing agents.

| Part | What it does |
| --- | --- |
| `plugins/savvy-progress` | The band above the prompt, the agents panel (`/agents-info`), and model routing for background agents. |
| `plugins/auto-route` | The routing model: puts the agent table and rules in the main session's system prompt, and adds a note to each prompt naming the row (searcher, Explore, reader, editor, reviewer, savvy-heavy, savvy-fable) and the skills that fit. |
| `agents/` | `searcher`, `Explore`, `reader`, `editor` and `reviewer` subagents, each pinned to a model tier. `Explore` replaces the built-in one, which now runs on the session model. |
| `CLAUDE.md.snippet` | The "Progress" rules, and a one-line "Routing" pointer to auto-route. |
| `install.ps1`, `install.sh` | Install the plugins in `plugins.txt`, copy `agents/*.md` to `~/.claude/agents`, and print the snippet for you to paste (Windows, macOS/Linux). |

## Quick install

```bash
git clone https://github.com/ITMERowe/rowes-workflow && cd rowes-workflow && sh install.sh
```

On Windows run `./install.ps1` instead of `sh install.sh`. The installer adds every plugin in [`plugins.txt`](plugins.txt) with its marketplace, copies the agents, and prints the snippet. Paste the snippet into `~/.claude/CLAUDE.md`, then run `/reload-plugins`. Details are under [Install](#install).

## The band above the prompt

One card in the panel's look, each bar the savvy pixel bar filling its row:

| Row | Source | Shows |
| --- | --- | --- |
| FLOW | savvy-progress | The flow title, tasks accepted out of planned, the percent, and a `×N` button that opens `/agents-info`. |
| USAGE | ribbon | Plan usage left for the 7-day and 5-hour windows, side by side, each with its reset time. Red under 20% left. |

The band stands in for ribbon's and ponytail's own rows, so nothing shows twice.

## The agents panel

`/agents-info` toggles the panel; `/agents-info open` opens it without toggling.

1. **Row 1:** cost, tokens and time for the whole session: the main session plus its subagents.
2. **Row 2, left:** the main session (its current task-list step and last action), running, finished and planned subagents, the task list, and background tasks (small crabs, one colour each). A task-list step handed to a subagent whose description is the step's exact text shows once, as that agent's row.
3. **Row 2, right:** skills and plugins. Ones used since the main session's last turn ended get a full card; the rest (used earlier, or enabled and not used yet) sit in a chip grid. Each has its own crab colour, apart from subagents and background tasks.

Each card scrolls on its own under the wheel. On a narrow pane row 2 stacks into one column. Tools: `mcp__savvy-progress__progress` (the main session reports a flow) and `mcp__savvy-progress__step` (a worker reports its steps). `routeModel`: a background subagent with no pinned model runs on Sonnet (Haiku for `Explore`); agents in its `PINNED` set (`searcher`, `reader`, `editor`, `reviewer`) and `savvy-*` workers keep their own model.

## Routing

| Task | Agent | Model |
| --- | --- | --- |
| Search or locate code | `searcher` | Haiku, low effort |
| Broad sweep across many files, conclusion only | `Explore` | Haiku, low effort |
| Read a guide, post, doc page or link | `reader` | Haiku, low effort |
| Routine edits | `editor` | Sonnet, medium effort |
| Review of auth, permissions, payments, migrations, deletion, concurrency | `reviewer` | Opus, high effort |
| Messy code, root-cause debugging, multi-file change | `savvy-heavy` (savvy-flow) | Opus |
| Everything else | main session | the session's model, with Opus as advisor |

The main session keeps Opus within reach without a handoff: `"advisorModel": "opus"` in `~/.claude/settings.json` (or `/advisor opus`) lets it consult Opus at decision points. The [advisor](https://code.claude.com/docs/en/advisor) needs the Anthropic API and a main model Claude Code recognizes.

auto-route's notes are hints from a keyword table: the routing table and the skill descriptions still decide.

### Why the agents are not plugin agents

The agents install as plain files in `~/.claude/agents`, not as agents inside a plugin. A plugin's agents get a `rowes-workflow:` prefix (for example `rowes-workflow:searcher`). That prefix breaks the routing rules in `CLAUDE.md`, which name `searcher`, `editor` and `reviewer`, and it breaks savvy-progress's `PINNED` set, which would then route the prefixed agents to Sonnet.

## Crab costume legend

Each crab in the panel wears a Path of Exile or Path of Exile 2 ascendancy for its job, drawn as original pixel art, and acts it out while it works:

| Ascendancy | Worn by | While working |
| --- | --- | --- |
| Tactician | The main session | Reads a campaign map, the mark moving to the next objective |
| Pathfinder | Search (`searcher`, `Explore`) | Walks and looks one way, then the other |
| Martial Artist | Edit (`editor`, savvy-careful) | Strikes with a quarterstaff |
| Stormweaver | Review (`reviewer`, savvy-heavy) | Calls down lightning |
| Gladiator | Anything else on Sonnet | Swings a sword |
| Ritualist | Anything else on Haiku | Casts runes |
| Chronomancer | Anything else on Fable | Floats, turning a clock |
| Exile | Tasks, skills, background jobs, and agents no class fits | Rags flap |

The shell is tinted by the model, like an item's rarity: Haiku Normal (grey), Sonnet Magic (blue), Opus Rare (yellow), Fable Unique (orange).

## Requirements

Claude Code with mods (plugins with a hooks module), and `claude` on your PATH. The installer adds these plugins, listed in [`plugins.txt`](plugins.txt):

| Plugin | Marketplace | Why |
| --- | --- | --- |
| `ribbon` | `robonuggets/ribbon` | The USAGE row of the band. |
| `ponytail` | `DietrichGebert/ponytail` | Smallest-change coding style; savvy-progress depends on it. |
| `caveman` | `JuliusBrussee/caveman` | Terse replies. |
| `i-have-adhd` | `ayghri/i-have-adhd` | Action-first reply shape. |
| `superpowers` | `obra/superpowers-marketplace` | Process skills (planning, debugging, review). |
| `savvy-flow` | `JohnnyVizz/claude-kit` | The `savvy-*` workers the routing rules name. |
| `savvy-progress` | this repository | The band and the agents panel. |

To add or drop one, edit `plugins.txt` before running the installer.

## Install

Make sure no other copy of savvy-progress is loaded (for example `savvy-progress@claude-kit`, or a folder named in `CLAUDE_CODE_PLUGIN_DIRS`). Two copies draw two panels and report twice.

1. Clone this repository and run the installer from its folder. It adds each marketplace and installs each plugin in `plugins.txt`; one that fails is reported and the rest go on. It backs up any agent file it replaces as `<name>.md.bak`. To copy only the agents, pass `--agents-only` (`-AgentsOnly` on Windows).

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

2. Paste the snippet it prints into `~/.claude/CLAUDE.md`.
3. Run `/reload-plugins` or start a new session.

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
