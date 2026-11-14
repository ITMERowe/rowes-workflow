# Exiles

**Stop paying Opus prices for grep.**

Two Claude Code plugins that make agent work cheaper and easier to watch. **auto-route** sends each job to the cheapest model that can do it. **Hideout** shows every agent working, live, as a pixel crab in a tavern.

<p align="center"><img src="docs/crew.svg" alt="The crab crew: Tactician, Pathfinder, Ritualist, Martial Artist, Gladiator, Stormweaver, Chronomancer and Exile, each acting out its job" width="880"></p>

| **20% cheaper** | **A third fewer tokens read** | **Delegation that actually happens** |
|:---:|:---:|:---:|
| $0.89 vs $1.11 for the same build | 2.0M vs 3.0M cache reads | 3 of 3 runs with the hook, 2 of 4 as a prompt rule |

> **Agents do not cost what they write. They cost what they re-read.** In a full build, 98% of the tokens processed were cached context read again on every call. auto-route keeps the bulk reading out of that context by sending it to Haiku, and it *enforces* that with a hook, because asking the model to delegate worked only half the time.

*One task (build a portfolio site from 7 GitHub repos), same model, one run per build. [Method, every run and the limits →](docs/BENCHMARK.md)*

## Install

In Claude Code, one line at a time:

```
/plugin marketplace add ITMERowe/exiles
/plugin install auto-route@exiles
/plugin install hideout@exiles
/reload-plugins
```

Each plugin works alone, so install just one if you like. From a terminal, run the same lines as `claude plugin ...`.

## What you get

| | **auto-route** | **Hideout** |
|---|---|---|
| What it does | Sends each job to the cheapest model that can do it | Shows every agent live, as a pixel crab in a tavern |
| You get | Haiku for search, Sonnet for edits, Opus for risky work | A band above the prompt, plus a crew panel (`/agents-info`) |

**How auto-route saves money**
- **Reading goes to Haiku.** A survey of many repositories runs in Haiku agents that return short, cited reports, so the main session never carries the bulk.
- **A hook enforces it.** The main session's own clone of a repository is refused until the reading agents have been spawned.
- **One set of rules from the plugin.** Ship a check that can fail, pick the lightest stack, count instead of estimating, keep AI notes out of the repo. Nothing depends on your own `CLAUDE.md`.

**What the test built.** The same brief produced a 13-page static portfolio where every engineering decision cites a file and a line, against a single page rendered by JavaScript. Quality scored 32 out of 35 against 25, by the author's rubric: see the [benchmark](docs/BENCHMARK.md).

## auto-route

Every session gets a routing table, and every prompt gets a hidden note naming the agent and skills that fit.

| Ask | Goes to |
|---|---|
| "where is the login handler?" | `searcher` · Haiku |
| "summarize this post" | `reader` · Haiku |
| "rename these 40 files" | `editor` · Sonnet |
| "review the payment migration" | `reviewer` · Opus |
| "find the root cause of the flaky build" | `heavy` · Opus |

- **Cheap questions.** Plain questions run on Haiku and technical ones on Sonnet, only while that actually saves money.
- **Opus on call.** `/advisor opus` makes Claude ask Opus at the hard moments, not run on it all day.
- **Same rules everywhere.** It injects short ADHD-friendly answer rules and workflow rules (skills and voice, repo hygiene) each session, and copies an `Explore` agent into `~/.claude` if missing. Nothing depends on your own `CLAUDE.md`.

[Change the routing →](plugins/auto-route/README.md)

## Hideout

- **The band** above the prompt: plan progress and the usage left in your 5-hour and 7-day windows.
- **The tavern** on top of the crew panel: a pixel tavern where crabs walk out the door when their agent starts a job, and back when it's done.
- **The crew panel** lists every agent with its model, progress and context. Click a row for its tool calls.
- **Crab colours** show the model: Haiku grey, Sonnet blue, Opus yellow, Fable orange.

[More about Hideout →](plugins/hideout/README.md)

<details>
<summary><b>The full workflow</b>: the installer, with the companion plugins</summary>

```bash
git clone https://github.com/ITMERowe/exiles && cd exiles && sh install.sh
```

On Windows, run `./install.ps1` instead, then run `/reload-plugins`. The plugins inject their own rules, so there is nothing to paste into `CLAUDE.md`.

It also installs ponytail (smallest-change code), caveman (terse replies), superpowers (process skills) and savvy-flow (a planner). To skip one, remove its line from [`plugins.txt`](plugins.txt) first.

Don't run Hideout alongside the original `savvy-progress`, or you'll get two panels.

</details>

<details>
<summary><b>Developing</b></summary>

From `plugins/auto-route` or `plugins/hideout`, after each change:

```bash
claude plugin validate .
claude plugin test .
```

</details>

## Credits

- **Hideout** began as a fork of [johnnyvizz](https://github.com/JohnnyVizz)'s [savvy-progress](https://github.com/JohnnyVizz/claude-kit/tree/main/plugins/savvy-progress) (MIT).
- **auto-route**'s `heavy` and `fable` tiers follow the workers in [savvy-flow](https://github.com/JohnnyVizz/claude-kit).
- The crab costumes are original pixel art based on *Path of Exile* and *Path of Exile 2* ascendancies. They are fan art, not affiliated with Grinding Gear Games.

MIT licensed, see [`LICENSE`](LICENSE).
