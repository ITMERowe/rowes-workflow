# Hideout

Your crew's hideout in Claude Code. A plugin with two parts: a band above the prompt, and a live panel for the main session and each of its subagents. More game features are on the way.

- **The band:** one card above the prompt. It shows the plan's title, tasks done out of planned and the percent, plus the usage left in your 7-day and 5-hour windows with their reset times. It reads the usage itself and replaces ribbon's and ponytail's own rows when they are installed, so nothing shows twice. A button with the agent count opens the panel.
- **The crew panel** (`/agents-info` toggles it; `/agents-info open` opens it without toggling):
  - Session totals in the terminal: cost, tokens and time.
  - The Hideout, on desktop: a pixel tavern at night at the top of the panel. Each crab has its seat, and walks out of the door while an agent in its costume is on a job; the Tactician leaves while the main session works. Each crab's shell shows the model of its costume's latest run.
  - Every worker: the main session, running, finished and planned subagents, the task list and background tasks, each with its model, effort, progress, context and cost. Click a row's `▸ N` to list its tool calls.
  - The skills and plugins in use.
- **The crab crew:** each crab wears a class costume and acts it out in pixel animation while it works:

  | Class | Action |
  | --- | --- |
  | Tactician | Reads a map |
  | Pathfinder | Walks and looks around |
  | Ritualist | Casts runes |
  | Gladiator | Swings a sword |
  | Martial Artist | Strikes with a quarterstaff |
  | Stormweaver | Calls lightning |
  | Chronomancer | Floats, turning a clock |
  | Exile | Rags flap |

  The shell colour shows the model. `prefers-reduced-motion` stops the animation.

## Tools it adds

- `mcp__hideout__progress`: the main session reports the plan, its phase and the accepted tasks. A call from a subagent is ignored, so a worker cannot rename, finish or reset the plan.
- `mcp__hideout__step`: a worker reports its own steps (`done`, `total`, `note`). A worker that doesn't report shows its context fill in grey instead. Planned workers (`savvy-*` agent types) get one line at the end of their brief asking for these reports.

The cost is an estimate from token counts and a built-in price table (`PRICES` in `hooks/register.tsx`), not a bill. Cache writes are priced at the 1-hour rate, so a session that writes 5-minute cache entries shows a higher cost than it really paid.

## Settings

- `autoOpen`: `workers` (default) or `any`.
  - `workers`: the panel opens by itself when a plan is reported or a planned worker starts.
  - `any`: it also opens, once per session, when any other subagent starts.

  `/agents-info` toggles the panel either way.

Set them in `/config`. For a plugin loaded by hand, set them in `~/.claude/settings.json`:

```json
{ "pluginConfigs": { "hideout": { "options": { "autoOpen": "any" } } } }
```

## Install

In Claude Code (terminal, desktop app or IDE):

```
/plugin marketplace add ITMERowe/exiles
```

```
/plugin install hideout@exiles
```

From your terminal:

```bash
claude plugin marketplace add ITMERowe/exiles
```

```bash
claude plugin install hideout@exiles
```

Then run `/reload-plugins`.

Hideout needs ponytail, and Claude Code installs it along with it. The usage row follows the idea of ribbon (RoboNuggets, MIT) but shares no code with it. The full setup is in the [repository README](../../README.md).

## Developing

Run these from this folder after each change:

```bash
claude plugin validate .
```

```bash
claude plugin test .
```

## Credits

Hideout began as a fork of [savvy-progress](https://github.com/JohnnyVizz/claude-kit/tree/main/plugins/savvy-progress) by [johnnyvizz](https://github.com/JohnnyVizz) (MIT). It was renamed and reworked from there:

- The usage row and the merged band.
- The two-row panel with tool-call lists.
- The crab crew.

It still shows the [savvy-flow](https://github.com/JohnnyVizz/claude-kit/tree/main/plugins/savvy-flow) planner's workers.

The crab costumes are original pixel art based on *Path of Exile* and *Path of Exile 2* ascendancies. They are fan art, not affiliated with Grinding Gear Games.
