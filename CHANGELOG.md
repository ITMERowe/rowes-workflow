# Changelog

Code changes, newest first: each file and section, what changed and why.

## 2026-11-13 (uncommitted)

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
