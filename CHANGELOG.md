# Changelog

Code changes, newest first: each file and section, what changed and why.

## 2026-11-14 (uncommitted)
### auto-route 0.5.6: smaller recon reports, verifier only for long output
- `plugins/auto-route/agents/explore.md`: reports are one terse `path:line — fact` per line, at most 40 lines unless the brief sets another cap (was 15 rows, which briefs overrode with 70). `hooks/register.ts` (survey note): briefs carry the same 40-line cap. Why: V4 ran on Haiku correctly ($1.31, Sonnet 94% / Haiku 6%) but the three recon reports came back as about 122k characters (roughly 25-30k tokens) and sat in the main context for the other ~25 calls, about $0.2 of cache writes and reads.
- Same file (survey note, verifier row): the main session runs lint, type, test and build itself in one batched command and uses `auto-route:verifier` only for a long suite (over ~3k tokens of output); never poll with sleep. Why: V4 delegated a short check to the verifier (13 Haiku calls), polled with `sleep 60`, then reran lint itself, so delegation added calls and saved nothing.
- `plugins/auto-route/agents/explore.md`, `verifier.md`: reports are written as terse fragments (filler dropped; paths, numbers, quotes and negations exact). Why: subagents do not receive the caveman and ADHD session rules, and their reports stay in the main context for every later call.
- `.claude-plugin/plugin.json` 0.5.6.
- `plugins/auto-route/rules/workflow.md` (new), `hooks/adhd.mjs`: the session now injects workflow rules (skills vs voice, who owns what in an answer, repo hygiene) from the plugin. `hooks/seed.mjs` no longer copies `seed/CLAUDE.md` (file removed); it only seeds the Explore agent. `README.md` (both): updated. Why: rules that lived in a copied or hand-edited `~/.claude/CLAUDE.md` skipped any user who already had one, so results depended on the device. Hideout `HOUSE_RULES` also carries the progress-tool and background-jobs rules. `CLAUDE.md.snippet` removed; `install.sh`, `install.ps1` and the root `README.md` no longer ask users to paste rules.

### auto-route 0.5.5: Haiku rows actually run on Haiku
- `plugins/auto-route/hooks/register.ts` (new `agent.spawn` hook): a spawn of a Haiku or Sonnet row (`auto-route:explore`, `reader`, `searcher`, `verifier`, `editor`) with no model named, and not a fork, gets the table's model. Why: the V4 run launched 5 background `auto-route:explore` agents on Sonnet (usage: Sonnet 100%, explore 48% of the limit, $2.47). A plugin agent's own `model:` is not applied to a background run, and hideout's `routeModel` deliberately skips `auto-route:*` on the assumption that it is. V2 only got Haiku because the main session passed `model: haiku` by hand.
- Same file: `RULES_LITE` says to pass the row's model as the Agent `model`; the survey note allows at most 3 subagents (group small repos). Why: backstop for the hook, and 5 cold starts cost more than 3.
- `plugins/auto-route/hooks/route.test.ts`, `.claude-plugin/plugin.json` (0.5.5): spawn test (explore and verifier get haiku, editor sonnet, heavy untouched, an explicit model or a fork left alone).

### hideout 3.0.3: stack choice rule
- `plugins/hideout/hooks/register.tsx` (`HOUSE_RULES`): pick the lightest stack the task needs (platform first, zero runtime dependencies, a framework only for client-side state; a content site is static pages). `routeModel` comment now says auto-route sets its own agents' model. `.claude-plugin/plugin.json` 3.0.3. Why: V4 built a React single-page app (170 KB JS, one HTML page, +1188 lines) for a static portfolio where V3 shipped Astro with 0 KB JS in +657 lines; ponytail loaded and did not steer the stack.

### hideout 3.0.2: two more house rules
- `plugins/hideout/hooks/register.tsx` (`HOUSE_RULES`): no dependency upgrades or audit chasing unless the task asks or the build fails; batch tool steps (browser_batch) in one call. `.claude-plugin/plugin.json` 3.0.2. Why: V2 spent 5 calls upgrading Astro and running npm audit, and 6 calls on one-step browser actions; at about 85k context each call re-reads about $0.02.

### auto-route 0.5.4: delegate by size, evidence-backed claims, no skill hints on long briefs
- `plugins/auto-route/hooks/register.ts` (`RULES`, `RULES_LITE`, `routeNote`): the delegate threshold is about 20k tokens of reading or output, not "~3 tool calls"; the explore note now tells the main session to read small repos itself with bounded commands, send only large ones to subagents, and attach a file:line or command count to every published claim (count, never estimate). Why: runs V1-V3 of the portfolio test: delegating (V2, $1.26, 32 calls) cost more than reading inline (V3, $0.97, 23 calls) because recon was only ~14k tokens and a looped Bash command counted as one call; V2 won on quality only through file:line evidence and commit counts, which need no subagent.
- Same file (`routeNote`, explore row): the note now carries a per-repo recon checklist (purpose, stack versions, structure with wc -l, tests, CI, docs, commit count and date range, decisions with file:line, limits, assets), delegates unless it is a single repo under ~50 source files, and asks for a recheck of about five published numbers before finishing. Why: V3 dropped from V2's quality because its recon had no checklist (no commit counts, no per-decision file refs, no limits) and no claim recheck; V2's briefs had all three. V2's extra cost was 4 main-session wake-ups on agent completion and a 5-call Astro upgrade and audit detour, not the Haiku reading.
- Same file (`routeNote`, explore row): tells the main session to keep working (scaffold, install, layout) while subagents run and not end the turn to wait. Why: V2 ended its turn after spawning agents and woke 3 more times on their completions, about 4 calls at 85k context.
- Same file (`SURVEY`, `routeNote`): the recon checklist, size rule and recheck now apply only to a survey of repos or a profile (github link, inspect/analyze/survey repos); other explore asks such as "trace the flow" get the plain ~20k-token rule. The "keep working while agents run" examples are no longer web terms. Why: the checklist (commit counts, assets, stack versions) is wasted work on a targeted question about one codebase, and the rules must hold for any project type.
- `plugins/auto-route/agents/explore.md`: new "Read efficiently" rules: one batched Bash for mechanical facts, `grep -n` so each fact has its line, read ranges not whole files, never read images, binaries, lockfiles or build output, aim for 8 calls. Why: the V2 recon agents used 6, 12 and 9 calls and one Read pulled a 262k-character PNG into a Haiku context.
- Same file (`routeNote`): no skill hint when the prompt is over 600 characters. Why: the portfolio brief matched `systematic-debugging` and `impeccable` on the words "errors" and "design".
- `plugins/auto-route/agents/verifier.md`: finds the project's own build and test setup (package.json, Makefile, Cargo, pyproject, go.mod, .csproj, gradle or Maven, CI steps) instead of assuming Node. Why: exiles is a general workflow, not a web one.
- `plugins/auto-route/hooks/route.test.ts`, `.claude-plugin/plugin.json` (0.5.4): test follows the new wording and checks the long prompt gets no skill hint.

### auto-route 0.5.3: more routing rows, new verifier agent
- `plugins/auto-route/agents/verifier.md` (new, haiku, Read/Grep/Glob/Bash): runs build, lint, typecheck and tests and reports pass or fail with the error lines. Why: test and build output is long and stays in the main context for every later call; Haiku can read it instead.
- `plugins/auto-route/hooks/register.ts` (ROUTES): new `verifier` row; wider keywords for `reviewer` (oauth, jwt, encrypt, xss, csrf, rbac, deleting users/data), `heavy` (memory leak, performance regression), `searcher` (find all, grep for, which files, how many files), `explore` (read through, get familiar with, trace the flow, compare repos), `editor` (update docs, fix lint, scaffold, add a field/route/page). `RULES_LITE` names the verifier; the explore note tells the main session to hand checks to it. Why: the real test showed cost is cache reads (about 118k context x 32 calls), so work that can leave the main context on Haiku should.
- `plugins/auto-route/hooks/route.test.ts`, `README.md`, `.claude-plugin/plugin.json` (0.5.3): tests for the new picks, table row, version.


### auto-route 0.5.2: route repo-recon build tasks to explore
- `plugins/auto-route/hooks/register.ts` (ROUTES `explore` row): also matches a `github.com/<user>` link and "inspect/analyze/survey/examine/investigate ... repo/repositories/profile/codebase". Why: the real-test prompt ("Analyze my public GitHub profile and repositories ... Build a website") matched no row, so the full rules never loaded and nothing was delegated.
- Same file (`routeNote`): the `explore` note adds a fan-out line: one subagent per repo, in one message, facts as path plus quoted line, no opinions; the main session writes and checks each claim against its quote. Why: Haiku extracts well but should not judge or invent.
- Same file (`RULES_LITE`): reading more than ~3 files, repos or pages goes to subagents in parallel. Why: the standing text only said small jobs stay inline.
- `plugins/auto-route/agents/explore.md`: may `git clone --depth 1` a remote repo into a new temp folder. Why: read-only Bash alone could not reach a remote repo.
- `plugins/auto-route/hooks/route.test.ts`: new test with the portfolio prompt shape; added `rename these repositories` stays on `editor`.

### hideout 3.0.1: house rules log once per task
- `plugins/hideout/hooks/register.tsx` (`HOUSE_RULES`): CHANGELOG.md and HANDOFF.md are updated once when the task's code changes are done, one edit each, not after every change. Why: the real test (Exiles run, $1.42 vs $1.11) wrote both files into a new project, and "after changing code" invites a rewrite per edit, which costs turns and cache writes.

## 2026-11-13 (uncommitted)

### hideout: band count and width
- `plugins/hideout/hooks/register.tsx` (AbovePrompt): the "N agents" count now counts running and planned agents only, not finished ones. Why: finished agents stayed in the count.
- Same file: band width is `cols * 7.5` minus a reserve sized from the count label and dismiss button, not a fixed 8 px per column minus 128. Why: the old guess clipped the label ("3 agent") and did not follow width changes.

### bench: heavy suite and clean-profile mode
- `bench/tasks.mjs`, `bench/run.mjs`: `SUITE=heavy` runs five read-heavy prompts (`survey-lib`, `survey-router`, `audit-deprecate`, `trace-flow`, `jsdoc`) whose answers are checked against the fixture; the default suite is unchanged. Why: the standard tasks are one-grep jobs, so delegation can never pay there.
- `bench/tasks.mjs`, `bench/run.mjs`, `bench/portfolio-fixture/`: `SUITE=portfolio` runs two website jobs on a snapshot of the ITMERowe public GitHub profile (profile.json, 7 repo READMEs, a deliberately poor index.html): `portfolio-prep` (read the profile, write portfolio.json and portfolio.html) and `site-improve` (responsive, accessible, semantic rewrite). Graded by checks on the output files; each run gets a fresh copy of the folder (`t.dir`). Suites are now `standard`, `heavy`, `portfolio`.
- `bench/arms.mjs`: `BENCH_PROFILE=<empty folder>` sets `CLAUDE_CONFIG_DIR` for every call (no `CLAUDE.md`, no other plugins); arm plugins load via `--plugin-dir`. `run.mjs`/`session.mjs` use the new `armArgs`/`armEnv`. Why: the usual profile's `CLAUDE.md` already makes answers terse, so the baseline was not bare.
- `bench-portable.zip` (repo root, local): the bench scripts for running the baseline on a second machine.

### bench: fixes after the first long-session run
- `bench/session.mjs`: the edits check treated `git grep` finding nothing (exit 1) as a failure, so every session read "EDITS WRONG"; it now checks the exit status.
- `bench/run.mjs`: `TASK=<id>` runs one task only (cheap per-plugin probes).

### bench: long-session test
- `bench/session.mjs` (local): one 10-turn session per run, turns chained with `--resume`, arms `none,all,lean`; prints median cumulative cost after each turn so a crossover (plugin overhead paid back over time) shows, plus subagents spawned and whether the two edits landed. Why: single-shot runs pay the fixed plugin cost every time, so they cannot show a long-run win.
- `bench/arms.mjs` (new): arm settings moved out of `run.mjs` so both scripts share them; `tasks.mjs` now exports `loadUtils`.

### bench: resumable runs
- `bench/run.mjs`: stops at once on a "hit your limit" error instead of recording failures, and `RESUME=<results file>` copies the good rows into a new file and runs only the missing cells. Why: the first full run hit the 5-hour limit after 18 runs and recorded 30 zero-cost failures.

### bench: manual test scored from /usage
- `bench/manual/PROTOCOL.md`, `results.csv`, `compare.mjs` (local): `/usage` cannot be scripted, so runs are done by hand in fresh sessions (same fixture and tasks as `bench/run.mjs`), the Breakdown rows are pasted into the CSV, and `compare.mjs` prints median cost per task, the cost ratio, and the per-model table. The CSV ships empty: no sample numbers.

### auto-route README: test it yourself
- `plugins/auto-route/README.md`: new "Test it yourself" section: compare two fresh sessions with `/usage`, with the plugin disabled and enabled, on a multi-step job. Why: `/usage` is what people will use, and a one-line job shows no saving.

### auto-route: ADHD rules defer to caveman
- `plugins/auto-route/rules/adhd.md`, new `rules/adhd-words.md`: split the shape rules (action first, numbered steps, one next action) from the word-level rules (no openers, 5-line length, terse words). Why: the readers of caveman, ponytail and i-have-adhd showed all three save by shortening output, and stacking three style rule sets pays the input cost three times for one effect.
- `plugins/auto-route/hooks/adhd.mjs`: injects `adhd-words.md` only when no `caveman@*` plugin is enabled in `~/.claude/settings.json`. Checked: with caveman on, the injected text is 1,794 chars and has no Words section.
- `bench/` (local): arms are now plugin sets (`none`, `ponytail`, `caveman`, `route`, `all`, `lean`) built at run time; added `write-fn` (graded by running the function) and `explain` (long answer) tasks; `report.mjs` adds output tokens and a bootstrap 95% interval on the geometric-mean cost ratio. Old results still read (`off` is the baseline when `none` is absent). `run.mjs` also keeps each run's per-model usage (`byModel`) and `report.mjs` prints an arm-by-model table (input, output, cache read, cache write, cost) like `/usage`, so Haiku offloading is visible; runs from before this change have no `byModel`.

### auto-route: lean variant (untested against the benchmark)
- `plugins/auto-route/hooks/register.ts` (`RULES`): shorter wording, same table and rules and same "saves context or money, or needs a stronger model" test (an added "never delegate to a costlier model" was reverted: it would block `heavy` and `reviewer` from Sonnet sessions).
- `plugins/auto-route/hooks/register.ts` (`SKILLS`, `routeNote`, `register`): dropped the generic `ponytail:ponytail` hint (ponytail loads itself at session start); a plain question gets no skill hint; each skill is hinted once per session. Why: first Opus benchmark showed +12% cost and 0 subagents, so the plugin only added overhead.
- `plugins/auto-route/hooks/register.ts` (`RULES_LITE`, `routeNote`, `prompt.compose`): the system prompt now holds a short standing rule (about 90 tokens); the full routing table rides once with the first prompt note that names a row. Why: tiny tasks that never delegate paid ~600 tokens for a table they never used. Risk: a task the keyword table misses gets only the short rule.
- `plugins/auto-route/hooks/route.test.ts`: test for the once-only full table; ponytail test now covers no code-work hint and the once-per-session rule.
- `plugins/auto-route/rules/adhd.md`: same rules, about 15% fewer tokens; added a Length rule (5 lines default, only what was asked) so short answers no longer depend on the caveman plugin.
- `bench/arm-on.json`: hideout now off in the "on" arm, so only auto-route differs from "off" (hideout adds its own system-prompt rules and inflated the first results). `bench/run.mjs` keeps the answer text of failed runs.
- `bench/` (local, not for commit): A/B runner on a pinned Express 4.19.2 fixture with arms off, on and lean; added `multi-read` task and `arm-lean.json`.

### Band no longer clipped
- `plugins/hideout/hooks/register.tsx` (band, desktop branch): reserved width beside the drawing went from 96 to 128 px, so the "N agents" button fits inside the window instead of being cut off ("0 agent"). Width was only estimated at 8 px per column.

### Serena removed
- `.gitignore`: dropped the `.serena/` line; the local `.serena/` folder (empty memories, cache) was deleted. Serena is no longer used here.

### Root README reworked
- `README.md`: a two-column summary table under the crew image; one install block (four lines) instead of four; the routing table now comes before its bullets, and the bullets are shorter. Content and links unchanged.

### READMEs describe the session-start hooks
- `plugins/auto-route/README.md`: new "What it does at session start" section (seed copy and ADHD rules).
- `README.md`: one bullet under auto-route for the same.

### Rename Rowe's Workflow to Exiles
- `.claude-plugin/marketplace.json`: marketplace name `rowes-workflow` to `exiles`, description reworded. The plugins keep their names (`auto-route`, `hideout`), so installs become `auto-route@exiles` and `hideout@exiles`.
- `README.md`, `plugins/*/README.md`, `plugins.txt`, `plugins/hideout/.claude-plugin/plugin.json`, `CLAUDE.md.snippet`, `plugins/auto-route/seed/CLAUDE.md`, `HANDOFF.md`, live `~/.claude/CLAUDE.md`: every `rowes-workflow` is now `exiles` (marketplace id, repo URL, homepage), the title is "Exiles", and "Rowe's companion plugins" is "the companion plugins". Older entries below keep the old name on purpose.
- Not renamed: the GitHub repo, the git remote, the local folder, the `ITMERowe` account, and the LICENSE holder.

### auto-route replaces the i-have-adhd plugin
- `plugins/auto-route/rules/adhd.md` (new): our own short ADHD-shaped answer rules, written fresh, no text copied.
- `plugins/auto-route/rules/adhd.md`, new "Words" section and two exceptions: terse wording taken from the caveman idea (short sentences, fragments, no filler, never drop negations, payload exact, full sentences for security and irreversible actions, normal prose in files and commits), written fresh. Why: the user wants the ADHD rules to carry caveman's brevity.
- `plugins/auto-route/hooks/adhd.mjs` (new) and `hooks/seed.json`: a second SessionStart command that prints the rules as `additionalContext`.
- `plugins.txt`, `README.md`: i-have-adhd no longer installed. Turn the real plugin off in `/plugin` to avoid two copies of the rules.

### Hideout no longer needs ribbon
- `plugins/hideout/hooks/register.tsx`: the plan windows (7D/5H) now live in hideout's own `windows` atom, filled from `$.session.usage()` at session start and from `session.measure` when `rateLimits` change (`cleanWindows`, `WINDOW_ORDER`). The band reads them always, no longer only when ribbon's band ran. Still hides ribbon's and ponytail's rows when they are installed. Why: ribbon only relayed engine data, so the dependency bought nothing the band needs.
- `plugins/hideout/.claude-plugin/plugin.json`, `plugins.txt`, `README.md`, `plugins/hideout/README.md`: ribbon removed as a dependency and install line; README notes the idea comes from ribbon (MIT) with no shared code.
- Not ported: ribbon's cache WARM/COLD readout.

### Band reminder names hideout, not ribbon
- `plugins/auto-route/seed/CLAUDE.md`, `CLAUDE.md.snippet` and the live `~/.claude/CLAUDE.md`: the "must be on" line now checks `hideout@rowes-workflow`, since hideout draws the band and the USAGE row. Dropped the cache WARM/COLD claim, which hideout's band does not show.

### auto-route seeds ~/.claude on a fresh install
- `plugins/auto-route/hooks/seed.mjs` (new): on session start copies `seed/CLAUDE.md` and `seed/agents/Explore.md` to `~/.claude`, only when missing, so a clean install restores them without overwriting later edits.
- `plugins/auto-route/hooks/seed.json` (new) and `.claude-plugin/plugin.json`: standard SessionStart command hook, registered through the manifest `hooks` field so `hooks.json` (mod modules) is untouched.

### Idle animation in the hideout
- `plugins/hideout/hooks/register.tsx`, `crabBody`, `crab()`/`drawCrab`: back claw, front claw and eyes carry classes `ab`/`af`/`ey`, and two optional params (`parts`, `mug`) let `hideoutSvg` animate them; the defaults draw byte for byte what they did before, so the band and panel crabs are unchanged.
- `register.tsx`, `TAVERN_CSS` and new `IDLE` table: shared steps() keyframes and one routine per seat (sip, look round, shrug, nod, stretch, foot tap, short steps off the stool or along the bar, wipe the counter). Cycle 6 to 14 s, start offset from the seat index, so the crabs are out of sync. Reduced motion turns them off.
- `register.tsx`, `hideoutSvg`: seated crabs get the idle wrapper and rules; a walking or out crab gets none. Idle phase comes from the seat only when nobody walks (the cached drawing needs no `at`), and from `at` while a walk rebuilds it each second.
- `plugins/hideout/hooks/tavern-scene.ts`: the near die, a spill and a tankard on the tables are separate groups so idles can move them; the candle tip flickers.
- `hooks/tavern.test.ts`: new idle test (8 distinct routines, walker has none, reduced motion); size test also covers 7 seated plus 1 walking. 56 tests pass. Worst case at W 900 is 111495 chars.

### Iso tavern in the plugin
- `plugins/hideout/hooks/tavern-scene.ts` (new): the approved iso scene as a pure function of W (`tavernScene`, `SEAT_AT`, `roomShift`). The room shell follows W; props sit at fixed room coordinates; seeded patches keep output stable. Must be committed with `register.tsx`, which imports it.
- `register.tsx`, imports and `hideoutSvg`: draws the iso scene; each seated crab is placed by footprint order, walkers go after every floor object, glass, vignette and tags sit in pane coordinates. Mug-on-empty-seat dropped.
- `register.tsx`, walks: `walkKeyframes` takes a seat that carries its path (seat, aisle, doorstep, door, one step outside), measures legs in screen px, fades from the doorway point; no depth scale.
- `register.tsx`, `drawCrab`: draws each class group through `pixels()` as merged fill runs, so a crab is about a fifth of its old size (medium 6782 to 1332 chars), which keeps the worst case under the svg cap.
- `register.tsx`, removed: the old 3/4 tavern (`tavernLayout`, `tavernProps/Back/Over`, `stool`, `table`, `walkPath`, `depthScale`, `DOOR`, `AISLE_Y` and related constants).
- `hooks/tavern.test.ts`: walk keyframes test rewritten for the new path; new tests for seats inside the frame at W 240/320/480/900 and for size (all 8 seated and all 8 walking, under 120000 chars). 55 tests pass.

## 2026-11-12 (uncommitted)

### Iso tavern mockup (not in the plugin)
- `tavern-iso-gen.mjs` (new, untracked): rebuilt the lost generator; it writes `tavern-iso-preview.html`. Textures are SVG pattern tiles laid over shaded faces (planks, stone, weave, dither), with seeded irregular patches on top, so the svg stays at 127034 chars, under the 131072 cap.
- Same file, scene: faux-3D props (lit top and two side faces, contact shadows, dithered occlusion), stepped pixel light pools (hearth, sconces, candles, moonbeam), more props, the Exile bartender behind the counter, all 8 crabs on their own seats.
- Same file, top of the strip: left is the night yard seen through the door, right is a loft with a straight stair, gallery railing and a closed guest door, replacing the empty dark band. The door moved to v 150..176 so the yard has room above the wall.
- Same file, stair: back at u 204..261 on the right wall at the user's request, clear of the hearth; the open stringer is cut to the step profile so it no longer reads as a ramp, and the foot runs out of the strip bottom. Two asserts (`STAIR BLOCKED`, `STAIR AT HEARTH`) guard its footprint. The plate shelf, dartboard and one wall post moved to make room; svg is 127789 chars.
- `.claude/launch.json` (new, untracked): static server on port 8765 to view the mockup in the preview pane.
- `register.tsx` is untouched; the look is not approved yet.

### English only
- `plugins/hideout/hooks/register.tsx`, strings: dropped the Russian and Hebrew tables and language detection (`detectLang`, `lang`); `STRINGS` is the English set, so there is one language to keep in step.
- `register.tsx`, drawing (band rows, `barGroup`, panel rows, tavern, TSX layout): removed every right-to-left branch and the `mx`, `startText`, `endText`, `crabWidth` helpers they needed; the English output takes the old left-to-right branch.
- `plugins/hideout/.claude-plugin/plugin.json`: removed the `language` option.
- `plugins/hideout/README.md`, Settings: removed the `language` bullet; the example now sets `autoOpen`.
- `hooks/band.test.tsx`, `hooks/tavern.test.ts`: dropped the `LANG` env mock, which only fed language detection.

### House rules
- `plugins/hideout/hooks/register.tsx`, `HOUSE_RULES`: the code-change rules (ponytail, this changelog, HANDOFF.md) in one constant, so the test checks the exact text.
- `plugins/hideout/hooks/register.tsx`, `prompt.compose` hook: adds the rules as a cached `session` section to the main session only; cached so it costs tokens once per cache window, and subagents report back instead of writing these files.
- `plugins/hideout/hooks/rules.test.ts` (new): the main session gets the section once, a subagent none.

### Fable audit fixes
- `register.tsx`, `crewOf`: runs merge into one chain of spells, so a crab already out does not re-walk when an overlapping run ends.
- `register.tsx`, `place`: a walk out starts from where a crab walking back in is, so a new job no longer snaps it to its seat.
- `register.tsx`, `mainSpan`: returns the previous spell too, so the king turns round the same way.
- `register.tsx`, `addWork`: each author keeps its newest 100 calls (600 in all), so a busy subagent no longer pushes out the main session's calls and moves the king's start.
- `register.tsx`, card heights: a card shrinks below its 60/40 share when the other needs the room, and the pane is exactly the window when content fits; per-card chrome fixes the Skills card ending 20 px short.
- `register.tsx`, speed: Finished capped at 30 rows plus "+N more", `crab()` memoized, spacers and call lines drop the full stylesheet, the desktop draw skips terminal-only usage reads.
- `register.tsx`, cleanup: removed `Crew.walk`, `WorkItem.path` and comments left from per-card scrolling; idle and hop periods now divide one second so redraws keep them in phase.
- `types/index.d.ts`: dropped `WorkItem.path` and `offsets`; fold keys doc says run, plan.
- Tests: `tavern.test.ts`, `fold.test.ts`, `register.test.ts` cover the walk bugs, the work cap and the Finished cap; dead asserts dropped.

### Layout and walks
- `register.tsx`, pane: cards grow to fit content with a minimum share of the window; the pane keeps an explicit height in rows (without it the desktop drew a blank pane). Per-card scrolling and the `ui.scroll` hook removed: the desktop sends the wheel only when the pane itself scrolls, with no pointer.
- `register.tsx`, walks: a crab always finishes walking out before walking back; the tavern reads the real clock each draw, because a stale once-a-second time sent crabs back (the rubberband).
- `register.tsx`, `callSvg`: tool calls under a row are one-line drawings cut to fit, so wrapped commands no longer grow the card.

## 2026-11-12, commit 3682d0b
- `register.tsx`: tavern head row removed and corners rounded to match the cards; walking crabs glide with CSS keyframes; tool-call toggle moved clear of the status mark.
