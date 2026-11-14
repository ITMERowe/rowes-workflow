# Exiles

**Stop paying Opus prices for grep.** Two Claude Code plugins: one sends every job to the right model, the other lets you watch your crew work.

<p align="center"><img src="docs/crew.svg" alt="The crab crew: Tactician, Pathfinder, Ritualist, Martial Artist, Gladiator, Stormweaver, Chronomancer and Exile, each acting out its job" width="880"></p>

| | **auto-route** | **Hideout** |
|---|---|---|
| What it does | Sends each job to the cheapest model that can do it | Shows every agent live, as a pixel crab in a tavern |
| You get | Haiku for search, Sonnet for edits, Opus for risky work | A band above the prompt, plus a crew panel (`/agents-info`) |

> **Agents do not cost what they write. They cost what they re-read.** In a full build, 98% of the tokens processed were cached context read or written again on every call, not new output. auto-route cuts that bill by sending the reading to Haiku, and it *enforces* it with a hook, because a prompt rule alone was followed in only 2 of 4 runs. Same job, same model: **$0.89 against $1.11**, a third fewer tokens read. [See the numbers](#status-v7-baseline).

## Status: v7 baseline

auto-route 0.5.9 and Hideout 3.0.6 are the **v7 baseline**. Behavior stays as it is until a second kind of project has been tested.

**What was measured.** One task, run once per version in Claude Code on Sonnet 5.5: build a developer portfolio from a public GitHub profile with 7 repositories.

| Same job, same model (Sonnet 5.5) | Plain Claude Code | auto-route v7 | Difference |
|---|---|---|---|
| Cost | $1.11 | **$0.89** | **20% less** |
| Tokens read from cache | 3.0M | **2.0M** | **a third fewer** |
| Site built | 1 page, content rendered by JavaScript | **13 static pages** | indexable, no JavaScript needed to read it |
| Decisions citing `file:line` | 0 | **all of them** | checkable |
| Quality (my rubric, out of 35) | 25 | **32** | +7 points |

Quality was scored on verifiable facts, coverage, SEO, checks, design, performance and docs. Seven versions of the setup were run; the six before v7 cost between $0.97 and $1.42, and one earlier run that put the explore agents on the wrong model cost $2.47 (fixed since).

**What produced it.**
- Reading many repos goes to Haiku agents. A gate refuses the main session's own clone or repo-file fetch on a multi-repo survey until an explore agent has been spawned. As a prompt rule this was followed in 2 of 4 runs; with the gate, 3 of 3.
- Those agents read in few calls and return short, terse reports with `file:line` evidence.
- The workflow rules ship with auto-route: ship a check that can fail, pick the lightest stack, no dependency chasing, count instead of estimating.

**Read this before trusting the numbers.**
- Each version ran once on one web task. Runs of nearly the same setup varied by about 30%, so treat the gap as a signal, not a guarantee.
- The quality scores are the author's judgment, not an independent review.
- About two thirds of the cost is the starting context (your installed plugins, skills and agents), which routing cannot shrink. Removing what you do not use saves more.
- Not tested: CLI, mobile or backend projects, an Opus or Fable main session, macOS and Linux.

## Install

In Claude Code, one line at a time:

```
/plugin marketplace add ITMERowe/exiles
/plugin install auto-route@exiles
/plugin install hideout@exiles
/reload-plugins
```

Each plugin works alone, so install just one if you like. From a terminal, run the same lines as `claude plugin ...`.

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
