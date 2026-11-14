# Cutting the cost of agentic coding by delegating reads: a benchmark report on auto-route

| | |
|---|---|
| **Tested baseline** | auto-route 0.5.9 · Hideout 3.0.6 |
| **Main model** | Claude Sonnet 5.5 (Claude Code desktop) |
| **Date** | 2026-11-14 |
| **Status** | One task, one run per build (n = 8). Exploratory, not a controlled trial. |

## 1. Abstract

An agent session is billed mostly for re-reading its own context on every model call. We tested whether sending bulk reading to a cheaper model (Haiku), and *enforcing* that with a hook instead of asking for it in the prompt, lowers the cost of a real build without lowering the quality of the result. On one task (build a developer portfolio from a public GitHub profile with seven repositories) the best build cost **$0.89 against $1.11** for plain Claude Code (−20%), read **a third fewer tokens** (2.0M against 3.0M) and scored **32 against 25 of 35** on a seven-criterion rubric. Cost tracked cache-read tokens closely (r = 0.94, n = 8) and main-session calls even more closely (r = 0.97, n = 6). Delegation alone did not make a build cheap; fewer calls did. A prompt-level delegation rule was followed in 2 of 4 runs, the enforcing hook in 3 of 3. The sample is small and the quality scores are single-rater, so the result is a signal, not a proof.

## 2. Questions and hypotheses

| | Hypothesis | Measure |
|---|---|---|
| **H1** | Session cost is driven by *calls × context size*, not by output. | Correlation of cost with cache-read tokens and main-session calls. |
| **H2** | Delegating bulk reading to Haiku lowers cost without lowering result quality. | Cost, calls and rubric score of delegating against non-delegating builds. |
| **H3** | A delegation instruction in the prompt is unreliable; a `tool.call` hook is reliable. | Share of survey tasks in which reading was delegated, by mechanism. |

## 3. Method

### 3.1 Task
One brief, identical for every run: analyse a public GitHub profile and its seven repositories, select and describe projects without inventing facts, build a static portfolio (home, filterable project list, project detail pages, expertise, about, contact), run the available checks, document it and report what was actually verified. Reading seven repositories is the expensive part, which is what delegation targets, and the output can be audited against the repositories afterwards.

### 3.2 Conditions
Each run used a fresh Claude Code session on Sonnet 5.5. Plain Claude Code is the control (no plugins' routing or rules). Builds differ only in the auto-route version installed and the defects fixed between runs (section 5).

### 3.3 Efficiency measures
Cost, input and cache tokens and the model split come from the session's `/usage` panel. Main-session call counts, tool use, subagent calls and final context size come from the session transcript. Lines added come from the panel.

### 3.4 Quality rubric
Seven criteria, scored 1–5 with equal weight (maximum 35). Anchors below; 2 and 4 are in-between.

| Code | Criterion | 1 | 3 | 5 |
|---|---|---|---|---|
| **F** | Verifiable facts | Claims wrong or unverifiable | Claims correct, cited to files only | Spot-checked claims all correct; every engineering decision cites `file:line` |
| **C** | Coverage of the brief | Required pages or sections missing | All pages; projects described thinly | All pages and filter; each project has objectives, implementation, decisions, limits |
| **S** | SEO and static delivery | One JavaScript-rendered page | Static pages, meta tags partial or guessed deploy details | Per-page static HTML with title, description, canonical, Open Graph; deploy URL and base path configurable, not guessed |
| **K** | Automated checks | None | One type check | Lint, types, tests and build, or a type check plus a check on the built output that can fail |
| **D** | Design (subjective) | Generic template, flat hierarchy | Clear hierarchy, little character | Distinct type and layout, restrained palette, evidence presented well |
| **P** | Performance | Heavy runtime on every page | 30–200 KB of JavaScript | ≤ 30 KB of JavaScript and ≤ 400 KB total output |
| **R** | Docs and honesty | No docs | README with run steps | README with structure and decisions; handoff lists what was not verified; sensitive data handled |

### 3.5 Verification
For each scored run the builds were run (`build`, `check`, tests where present) and a handful of claims per run were checked against clones of the repositories: line counts, commit counts, test-file counts and cited `file:line` references. Design was judged from the rendered home and project pages at desktop and phone width.

## 4. Results

### 4.1 Efficiency

| Run | Setup | Cost | Main calls | Cache read | Cache write | Final context | Haiku share | Lines added |
|---|---|---|---|---|---|---|---|---|
| Plain | none | $1.11 | n/a | 3.0M | 96k | 142k | 0% | +1048 |
| 1 | early auto-route | $1.42 | n/a | 4.0M | 157k | 157k | 0% | +869 |
| 2 | 0.5.2 | $1.26 | 32 | 3.8M | 102k | 148k | 8% | +930 |
| 3 | 0.5.3 | $0.97 | 23 | 2.7M | 95k | 141k | 0% | +657 |
| 4 | 0.5.5 | $1.31 | 31 | 3.9M | 112k | 157k | 6% | +1188 |
| 5 | 0.5.6 | $1.08 | 26 | 2.9M | 92k | 139k | 6% | +431 |
| 6 | 0.5.7 | $1.33 | 36 | 4.6M | 108k | 154k | 0% | +879 |
| **7** | **0.5.9** | **$0.89** | **19** | **2.0M** | **87k** | **132k** | 2% | +659 |

An earlier run of 0.5.4 cost $2.47 (section 5, D1). Run 5 built six projects: the agent asked about a repository that publishes real bank details and the owner said to skip it.

### 4.2 Quality

<table>
<thead>
<tr><th align="left">Run</th><th>F</th><th>C</th><th>S</th><th>K</th><th>D</th><th>P</th><th>R</th><th>Total</th></tr>
</thead>
<tbody>
<tr><td align="left">Plain</td><td align="center">3</td><td align="center">4</td><td align="center">2</td><td align="center">5</td><td align="center">3</td><td align="center">5</td><td align="center">3</td><td align="center"><b>25</b></td></tr>
<tr><td align="left">1</td><td align="center">4</td><td align="center">4</td><td align="center">4</td><td align="center">3</td><td align="center">4</td><td align="center">5</td><td align="center">4</td><td align="center"><b>28</b></td></tr>
<tr><td align="left">2</td><td align="center">5</td><td align="center">5</td><td align="center">4</td><td align="center">3</td><td align="center">4</td><td align="center">4</td><td align="center">5</td><td align="center"><b>30</b></td></tr>
<tr><td align="left">3</td><td align="center">4</td><td align="center">4</td><td align="center">4</td><td align="center">4</td><td align="center">4</td><td align="center">5</td><td align="center">4</td><td align="center"><b>29</b></td></tr>
<tr><td align="left">4</td><td align="center">5</td><td align="center">5</td><td align="center">2</td><td align="center">5</td><td align="center">5</td><td align="center">3</td><td align="center">5</td><td align="center"><b>30</b></td></tr>
<tr><td align="left">5</td><td align="center">5</td><td align="center">5</td><td align="center">4</td><td align="center">3</td><td align="center">4</td><td align="center">5</td><td align="center">5</td><td align="center"><b>31</b></td></tr>
<tr><td align="left">6</td><td colspan="8" align="center"><em>not scored (files not kept)</em></td></tr>
<tr><td align="left"><b>7</b></td><td align="center"><b>4</b></td><td align="center"><b>5</b></td><td align="center"><b>5</b></td><td align="center"><b>4</b></td><td align="center"><b>4</b></td><td align="center"><b>5</b></td><td align="center"><b>5</b></td><td align="center"><b>32</b></td></tr>
</tbody>
</table>

<sub>F facts · C coverage · S SEO and static delivery · K checks · D design · P performance · R docs and honesty. Each 1–5; criteria in section 3.4.</sub>

Spot checks: run 7's counts (9,145 source lines, 106 commits, 655 lines of `i18n.ts`) and cited lines (`ARCHITECTURE.md:66, 84, 85`) were correct; one imprecision (13 end-to-end "tests" counted files including two helpers, 11 suites). Run 3 miscounted the same suites as 10. Cited lines were spot-checked for runs 4, 5 and 7 and were correct in the sample; the references in run 2 were not checked.

### 4.3 Cost-effectiveness

Points per dollar (total ÷ cost): plain 22.5 · run 1 19.7 · run 2 23.8 · run 3 29.9 · run 4 22.9 · run 5 28.7 · **run 7 36.0**. Run 7 is first on cost, on score and on this ratio, so the ranking does not depend on how cost and quality are weighted.

### 4.4 H1: cost follows context × calls

Across the eight runs cost against cache-read tokens gives **r = 0.94 (R² = 0.89), slope $0.21 per million tokens, intercept $0.47**. Across the six runs with known call counts, cost against main calls gives **r = 0.97, about $0.03 per call**. In run 7, 98% of tokens processed were cached context (2.04M read, 87k written) against about 32k of output. Supported: the bill grows with how often the context is re-read.

### 4.5 H2: delegation and cost

Runs that delegated (2, 4, 5, 7) averaged **$1.14**; those that did not (1, 3, 6) averaged **$1.24** (n = 4 against 3), a gap well inside the build-to-build spread. Delegation moves reading out of the main context but adds cold starts and wake-ups; it paid off only together with few calls (run 7: 19 calls, three Haiku agents making 14 calls in total, against 32 calls in run 4). Quality did not fall: delegating runs scored 30–32, non-delegating 28–29 (the plain control, 25). Partly supported: delegation is necessary for the best result here, not sufficient.

### 4.6 H3: prompt rule against hook

| Mechanism | Runs | Delegated |
|---|---|---|
| Prompt note naming the survey step | 4 (runs 4, 5, 6 and one headless test) | **2 of 4** |
| `tool.call` gate refusing the main session's own clone until an explore agent exists | 3 (run 7 and two headless runs) | **3 of 3** |

The failures had a cause: a routing rule saying that jobs under about 20k tokens "stay here" gave the model an out. Supported, with a sample too small for a significance test.

## 5. Defects found along the way

| | Symptom | Cause | Fix |
|---|---|---|---|
| **D1** | Explore agents ran on Sonnet ($2.47) | The agent file's YAML description held `broad: "medium"`; on a Windows (CRLF) checkout the frontmatter failed to parse and the runtime dropped the model, effort and tool settings | Description reworded (0.5.9); an `agent.spawn` hook also sets the model from the table (0.5.5) |
| **D2** | 25–30k tokens of agent reports re-read on every later call | Briefs overrode the agent's 15-row cap | 40 terse lines per repository (0.5.6) |
| **D3** | Verifier agent added calls and saved nothing | Delegating a short check, then polling with `sleep` | Verifier only for output over about 3k tokens; no polling (0.5.6) |
| **D4** | Reading done inline despite the note | Soft rule plus a conflicting size rule | Enforcing gate (0.5.8) |
| **D5** | Gate bypass | `gh api repos/…/contents` and `WebFetch` were not covered | Both covered (0.5.8) |
| **D6** | Wasted calls on dependency upgrades and one-step browser actions | No rule against either | Rules to skip unrequested upgrades and to batch tool steps (0.5.7) |
| **D7** | A static site built as a React single-page app | Nothing steered the stack | "Lightest stack the task needs" rule (0.5.7) |

## 6. Threats to validity

- **Statistical.** One run per build. The six auto-route builds from run 2 to run 7 span $0.89–$1.33, a coefficient of variation of 16%. Run 7's −20% against the control is about 1.2 such deviations: suggestive, not significant.
- **Rater.** Quality was scored by one unblinded rater (the assistant that analysed the runs, reviewed by the author), who knew which run used which build. Design (D) is subjective. An independent re-score would be the first improvement.
- **Construct.** The rubric rewards what the brief asked for (evidence, checks, static delivery); a different brief would weight differently. Points per dollar mixes a judged score with a measured cost.
- **Internal.** Builds were not isolated: fixes were made between runs, the owner answered one question during run 5, and run 6 was not preserved. Prices were not re-fitted per run, so no dollar split of cost is claimed, only token counts.
- **External.** One web task, one machine (its plugin and skill set sets an 80k-token starting context, about two thirds of every bill), one main model. CLI, mobile and backend projects, Opus or Fable as the main model, macOS and Linux were not tested.

## 7. Conclusion

On this task, enforcing delegation of bulk reading together with a call-frugal workflow produced the cheapest and highest-scoring build, and the mechanism fits the data: cost follows re-read context. The effect size is plausible but unproven at n = 1 per build. The defects in section 5 matter as much as the headline: three of them (D1, D4, D5) were silent failures that a prompt-only approach would not have revealed.

## 8. Reproducing

1. Install auto-route 0.5.9 and Hideout 3.0.6 (see the [README](../README.md)); use an empty working folder.
2. Run the portfolio brief from section 3.1 in a fresh session on Sonnet 5.5, once with the plugins disabled and once enabled.
3. Record `/usage` (cost, cache read and write, model split) and read the session transcript for call counts.
4. Build the result, run its checks, spot-check a handful of claims against the repositories and score it with the rubric in section 3.4, ideally with a second rater.

Repeat several times per condition and report the spread. Numbers from other machines, tasks and raters are the most useful addition.
