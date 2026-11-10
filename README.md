# Rowe's Workflow

**Send each job to the right Claude model, and watch your whole crew work in one panel.**

Two Claude Code plugins. Use one, or both:

- **auto-route** sends cheap work to Haiku, hard work to Opus, and the rest to Sonnet. It does this for every prompt, with no prompting from you.
- **band** shows what the main session and each subagent is doing, which model it runs on, and what it costs. Each one is drawn as a pixel crab.

<p align="center"><img src="docs/crew.svg" alt="The crab crew: Tactician, Pathfinder, Ritualist, Martial Artist, Gladiator, Stormweaver, Chronomancer and Exile, each acting out its job" width="880"></p>

Install in Claude Code with three commands:

```
/plugin marketplace add ITMERowe/rowes-workflow
/plugin install auto-route@rowes-workflow
/plugin install band@rowes-workflow
```

Run them one at a time, then `/reload-plugins`. To install from your terminal or with the full installer, see [Install](#install).

---

## Why

- **Stop paying Opus prices for grep.** Finding a file, reading a blog post, renaming a function: Haiku and Sonnet do these well, for a fraction of the cost. auto-route keeps the expensive models for the work that needs them.
- **Your main session's context stays clean.** Reading and searching happen inside subagents, so the main session gets back a short answer, not a pile of file contents.
- **You can see where the work and money go.** The panel shows every agent, every tool call, and the cost and tokens behind each one. Hover over a figure for its breakdown.

## auto-route: the routing model

A standalone plugin: it needs no other plugin. Install it and Claude Code gets:

1. **Seven agents, each on the right model.** Each agent below pins its own model and effort:

   | Work | Agent | Model |
   |---|---|---|
   | Find code: "where is X", "what calls Y" | `auto-route:searcher` | Haiku |
   | Sweep many files, conclusion only | `auto-route:explore` | Haiku |
   | Read a guide, post, doc page or link | `auto-route:reader` | Haiku |
   | Bounded edit: rename, known-cause bug, tests | `auto-route:editor` | Sonnet |
   | Auth, payments, migrations, deletion, concurrency | `auto-route:reviewer` | Opus |
   | Messy code, root-cause debugging | `auto-route:heavy` | Opus, extra-high effort |
   | The bug nothing else could fix, on request | `auto-route:fable` | Fable |

2. **The routing rules, in every session.** The table and its rules go into the main session's system prompt, so CLAUDE.md doesn't need to hold them. Subagents don't receive it, so they never hand work on further.
3. **Simple questions on a cheaper model.** A plain question runs on Haiku, and a technical one on Sonnet, while the session is small enough for the switch to pay off.
4. **A routing note on each prompt.** Ask *"summarize this post"* and Claude gets a hidden note to send it to `reader` on Haiku. Ask *"why does the build keep failing"* and the note names `heavy`. The note also names up to three skills that fit the ask.

Want Opus on hand without handing the whole task to it? Run `/advisor opus`. The main session then asks Opus at decision points and does the work itself.

The table and keywords are in one file you can edit: see [auto-route's README](plugins/auto-route/README.md).

## band: the crew panel

**The band above the prompt.** One card shows your plan's progress (tasks done of planned) and your usage left in the 7-day and 5-hour windows, with their reset times. It turns red under 20%.

**The agents panel** (`/agents-info`):

- **Session totals:** cost, tokens and time for the whole session. Hover over cost or tokens to see where they came from.
- **Every worker:** the main session, subagents, the task list and background jobs. Click a row to list the tool calls it made.
- **Skills and plugins:** the ones in use right now, and the rest of your kit.

**The crab crew.** Each worker is a pixel crab in a class costume, and it acts out its job while it runs:

| Class | Worn by | While working |
| --- | --- | --- |
| Tactician | The main session | Reads a campaign map, the mark moving to the next objective |
| Pathfinder | Search (`searcher`, `explore`) | Walks and looks one way, then the other |
| Martial Artist | Edits (`editor`) | Strikes with a quarterstaff |
| Stormweaver | Review (`reviewer`) | Calls down lightning |
| Gladiator | Anything else on Sonnet | Swings a sword |
| Ritualist | Anything else on Haiku | Casts runes |
| Chronomancer | Anything else on Fable | Floats, turning a clock |
| Exile | Tasks, skills, background jobs | Rags flap |

The shell colour shows the model: Haiku grey, Sonnet blue, Opus yellow, Fable orange. Any costume takes any shell, so your own routing still reads at a glance.

## Install

You need Claude Code with plugin support. There are three ways to install. Pick one.

### In Claude Code

Type these at the Claude Code prompt (terminal, desktop app or IDE):

```
/plugin marketplace add ITMERowe/rowes-workflow
```

```
/plugin install auto-route@rowes-workflow
```

```
/plugin install band@rowes-workflow
```

```
/reload-plugins
```

Leave out either install line to skip that plugin. You can also run `/plugin` alone, open **Marketplaces**, and pick from the list.

Or ask Claude: *"Install auto-route and band from the ITMERowe/rowes-workflow plugin marketplace."*

### From your terminal

```bash
claude plugin marketplace add ITMERowe/rowes-workflow
```

```bash
claude plugin install auto-route@rowes-workflow
```

```bash
claude plugin install band@rowes-workflow
```

Then start Claude Code, or run `/reload-plugins` in a session that is already open.

### The whole workflow, with the installer

This also adds the companion plugins listed under [What the installer adds](#what-the-installer-adds). You need `claude` on your PATH.

1. Clone the repository and run the installer:

   ```bash
   git clone https://github.com/ITMERowe/rowes-workflow
   ```

   macOS or Linux:

   ```bash
   sh install.sh
   ```

   Windows (PowerShell):

   ```powershell
   ./install.ps1
   ```

2. Paste the snippet the installer prints into `~/.claude/CLAUDE.md`.
3. Run `/reload-plugins`.

The installer adds every plugin in [`plugins.txt`](plugins.txt). A plugin that fails to install is reported, and the installer carries on with the rest. To skip a plugin, delete its line first.

#### What the installer adds

| Plugin | From | Why |
| --- | --- | --- |
| `auto-route` | this repository | The routing model and its agents. |
| `band` | this repository | The band and the crew panel. |
| `ribbon` | `robonuggets/ribbon` | Plan usage for the band (band needs it). |
| `ponytail` | `DietrichGebert/ponytail` | Smallest-change coding style (band needs it). |
| `caveman` | `JuliusBrussee/caveman` | Terse replies. |
| `i-have-adhd` | `ayghri/i-have-adhd` | Answers that start with the next action. |
| `superpowers` | `obra/superpowers-marketplace` | Process skills: planning, debugging, review. |
| `savvy-flow` | `JohnnyVizz/claude-kit` | The `/savvy-flow` planner and its workers. |

Don't load band alongside the original `savvy-progress`: both draw a panel, so you get two.

## Developing

From `plugins/auto-route` or `plugins/band`, after each change:

```bash
claude plugin validate .
```

```bash
claude plugin test .
```

## Credits

- **band** began as a fork of [johnnyvizz](https://github.com/JohnnyVizz)'s [savvy-progress](https://github.com/JohnnyVizz/claude-kit/tree/main/plugins/savvy-progress) (MIT), renamed and reworked into its own plugin.
- **auto-route**'s `heavy` and `fable` tiers follow the savvy-heavy and savvy-fable workers in [savvy-flow](https://github.com/JohnnyVizz/claude-kit).
- The crab costumes are original pixel art based on *Path of Exile* and *Path of Exile 2* ascendancies. They are fan art, not affiliated with Grinding Gear Games.

## License

MIT, see [`LICENSE`](LICENSE).
