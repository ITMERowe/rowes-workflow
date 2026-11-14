# Benchmark: what auto-route measured, and how far to trust it

This is the long form of the numbers in the [README](../README.md). It covers the method, every run, what each run taught, and the limits.

## The task

One brief, the same every time: **build a developer portfolio website from a public GitHub profile with 7 repositories.** The brief asks the agent to inspect the repositories, pick and describe the projects without inventing facts, build a static site with project pages and a filter, run the available checks, write documentation and report what it actually verified.

It is a good stress test because the expensive part is reading many repositories, which is exactly what delegation to a cheaper model is for, and the result can be checked against the repositories afterwards.

Every run used Claude Code on **Sonnet 5.5** as the main model. Cost, tokens and model split come from the session's `/usage` panel; call counts and tool use come from the session transcript.

## All runs

| Run | Setup | Cost | Main calls | Cache read | Haiku share | Quality (of 35) |
|---|---|---|---|---|---|---|
| Plain Claude Code | no plugins | $1.11 | n/a | 3.0M | 0% | 25 |
| 1 | early auto-route | $1.42 | n/a | 4.0M | 0% | 28 |
| 2 | auto-route 0.5.2 | $1.26 | 32 | 3.8M | 8% | 30 |
| 3 | auto-route 0.5.3 | $0.97 | 23 | 2.7M | 0% | 29 |
| 4 | auto-route 0.5.5 | $1.31 | 31 | 3.9M | 6% | 30 |
| 5 | auto-route 0.5.6 | $1.08 | 26 | 2.9M | 6% | 31 |
| 6 | auto-route 0.5.7 | $1.33 | 36 | 4.6M | 0% | not scored |
| **7** | **auto-route 0.5.9** | **$0.89** | **19** | **2.0M** | 2% | **32** |

Notes:
- An extra run of 0.5.4 cost $2.47: all five explore agents ran on Sonnet because of a bug described below.
- Run 5 built 6 projects instead of 7: the agent asked about a repository that publishes real bank details, and the owner said to skip it.
- Run 6's files were not kept, so its quality is not scored.

## Why the cost behaves this way

In run 7, **98% of the tokens processed were cached context** (2.04M read and 87k written, against about 32k of output). Every model call re-reads the whole conversation so far, so the bill grows with *calls × context size*, not with how much code gets written.

That gives two levers, and auto-route pulls both:

1. **Keep bulk reading out of the main context.** Reading seven repositories inline puts tens of thousands of tokens into a context that is then re-read on every later call. Haiku agents read them in their own contexts and return short reports.
2. **Make fewer calls.** Batch independent steps, never poll with `sleep`, run short checks inline instead of delegating them, skip dependency upgrades nobody asked for.

About two thirds of a run's cost is the starting context (installed plugins, skills and agents), which routing cannot shrink. Removing what you do not use saves more than any routing rule.

## What each run taught

- **Run 2: delegation works, but it has a price.** Background agents each woke the main session when they finished, and the agent spent five calls chasing a dependency upgrade. Agent reports were detailed, which is where the quality came from.
- **Run 3: advice is not enforcement.** The note said to delegate the reading and the model did it inline instead. Cheapest of the early runs, but shallower evidence.
- **The $2.47 run: the model setting never applied.** The explore agent's YAML frontmatter contained `broad: "medium"`, a colon inside an unquoted value. On a Windows (CRLF) checkout the parser failed and the runtime silently dropped every other frontmatter field: the cheap model, the effort level and the tool restriction. Fixed in 0.5.9; a small `agent.spawn` hook also sets the model from the routing table as a safety net.
- **Run 4: reports were too long.** Three recon reports of roughly 25k tokens sat in the main context for the rest of the run. Agent reports are now capped at 40 terse lines.
- **Run 6: the same prompt rule, ignored again.** With the instruction in the prompt, delegation happened in 2 of 4 runs (runs 4 and 5 yes; run 6 and one headless test no). The cause was a conflicting "small jobs stay inline" rule that gave the model an out.
- **Run 7: enforcement.** A `tool.call` hook refuses the main session's own `git clone` or repo-file fetch on a multi-repository survey until an explore agent has been spawned. It spares subagents and single-repository asks, and gives way after two refusals so it can never trap the model. With the gate, delegation happened in 3 of 3 runs (run 7 and two headless runs).

## How quality was scored

Seven criteria, 1 to 5 each, by the author: verifiable facts, coverage of the brief, SEO and static delivery, automated checks, design, performance, documentation and honesty. Facts were spot-checked against the repositories (line counts, commit counts and cited `file:line` references all matched for the claims checked), but the scores themselves are a judgment, not an independent review.

## Limits

- **One run per build, one web task.** Runs of nearly the same setup varied by about 30%, so a gap of 20% is a signal, not a guarantee.
- **Author-scored quality.** Treat the 32 against 25 as the author's reading of the evidence.
- **Not tested:** CLI, mobile or backend projects, an Opus or Fable main session, macOS and Linux.
- **Your setup matters.** The results came from one machine's plugin and skill set. A leaner or heavier starting context moves every number.

If you run the same kind of comparison, send the numbers: the claim is only as good as the number of tasks behind it.
