# Handoff

Where the work stands, for the next session. Last updated 2026-11-12.

## Repo

`ITMERowe/rowes-workflow` contains two Claude Code plugins, published from `.claude-plugin/marketplace.json`:

| Plugin | Folder | What it does |
|---|---|---|
| auto-route 0.5.0 | `plugins/auto-route` | Puts the routing table in the system prompt, attaches a per-prompt agent and skill note, and moves simple questions to Haiku or Sonnet. It ships 7 agents (`auto-route:*`). |
| hideout 3.0.0 | `plugins/hideout` | Adds the band above the prompt, the crew panel (`/agents-info`) with the tavern, and the crab crew. |

`hideout@rowes-workflow` installs from this folder, so `/reload-plugins` picks up local edits.

## Recent state of Hideout

- **Rename:** band became Hideout. The tools are `mcp__hideout__progress` and `mcp__hideout__step`, the pane id is `hideout-agents`, and state lives under `hideout`.
- **Layout:** the desktop panel fills the window height. The cards stretch with flexGrow inside a box sized in rows, with no px guesses. The Collapse button was removed.
- **Audit (commit 9008098) fixed:**
  - stuck running rows
  - skills counted twice
  - header totals dropping
  - blank scroll and keyboard scroll
  - band CSS collisions
  - RTL
  - untrusted tool input
  - the per-render cost, plus one type scale, one colour and grey token set, and alt text
- **The tavern card (commit ce51d87):** a 2.5D pixel tavern at the top of the desktop panel, which replaces the COST / TOKENS / TIME tiles.
  - The 8 crabs sit at fixed seats, tinted by the model of each costume's latest run.
  - A crab walks out the door while its agent runs. The Tactician walks out while the main session makes tool calls.
  - The scene draws its own wood frame, and the card can't be folded.
  - The code is `hideoutSvg`, `crewOf`, `mainSpan`, `tavernLayout`, `tavernBack` and `tavernProps` in `plugins/hideout/hooks/register.tsx`. The test is in `hooks/tavern.test.ts`.
  - The plan is in `docs/hideout-tavern-plan.md`.
- **Tests:** 47 pass (`claude plugin test .` in `plugins/hideout`).

## Open

1. **Check the tavern in the real desktop panel.** Look at:
   - whether the frame corners match the other cards;
   - whether the scene and the cards are the same width;
   - whether the wheel scroll still lands on the right card now the header is gone;
   - whether the fire and the idle bob animate.
2. **Tint mismatch:** planned rows (`plannedSvg`, `TIER_MODEL`) colour light and medium as Opus, but their tavern crabs default to Haiku and Sonnet. Pick one.
3. **Tooltips:** the cost and tokens tooltips were removed with the header. Totals now show only in the terminal panel.
4. **Stuck background rows:** a background shell that a subagent left behind can sit in "Running" forever. The stuck-row fix covers agents, not background shells.
5. **Not seen in the app:** the two-column layout (a wide panel) and Hebrew.
6. **No type-check:** none has run, because `tsc` is missing and so is `.claude-plugin/types/tsconfig.json`.

## Rules for this repo

- No emoji in docs. Path of Exile is mentioned only in credits.
- Stage files by name. Never commit `crabs-preview.html`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Desktop look needs the user's screenshot before a push; the tests can't draw the pane.
