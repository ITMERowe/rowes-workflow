# Hideout tavern card: plan

Status: built. Later changes: no fold, no COST/TOKENS/TIME header (the tavern replaced it), the scene draws its own frame, crabs tinted by model, the Tactician leaves while the main session works.

## What

A "Hideout" card at the top of the Agents panel, directly below the COST / TOKENS / TIME tiles and above the Agents and Skills cards. It spans the full width, even in two-column mode, and holds a 2.5D pixel-art tavern drawn as one SVG. The tiles stay: they hold the hover breakdowns of cost and tokens, and the tavern sits right under them. The 8 crew crabs hang out in it as flat 2D sprites. The scene follows live work: a crab walks out of the tavern while its kind of agent is on a job, and walks back in when the job ends.

## Camera and grid

- 3/4 interior. The back wall is a band of about 38% of the scene height; the floor below it is seen from about 45 degrees.
- One camera tilt for the whole scene. Every prop follows it.
- Scene height is about 150 px, and the width is the card's.
- Everything is built on a 16 px tile grid. The floor is planks in rows, with seams every 16 px; each row toward the back is slightly darker.
- Pixel-art crispness: integer coordinates, `shape-rendering="crispEdges"`, and crab scales picked from fixed steps of 0.75, 0.875 and 1.0.

## Props

Flat rect silhouettes, 2 to 3 tones each, with contact shadows:

- **Back wall:** stone base, wood panels, a window with a moon, a notice board, shelves with bottles.
- **Bar counter:** on one side, with kegs behind it. The bar is the door side: the walk path ends there.
- **Hearth:** in the middle of the back wall. Its fire is the one light source.
- **Furniture:** two round tables with stools, a barrel, and a crate with the campaign map for `king`.
- **Lanterns:** two, hanging from the top edge.
- **RTL:** in Hebrew the whole scene mirrors.

## Light

- One source: the hearth. A radial gradient glows on the floor and the wall, with a 1 to 2 step dithered edge, made with the existing `noise()` helper.
- The corners stay dark.
- Crabs near the fire get a warm 1 px rim on the side that faces it.
- The fire flickers through a two-frame CSS swap. Reduced motion stops it, and the glow stays steady.
- The scene is a night interior in both light and dark mode. The card frame follows the theme.

Palette ramps (suggested, not sourced):

| Material | Ramp |
|---|---|
| Wood | #3b2416 #5e3a22 #8a5a30 #b5793f #e0a85c |
| Stone | #2a2b33 #4a4d5a #6e7284 #9a9eaf |
| Warm light | #ffd27a at low alpha over the wood ramp |

## Crew

- **Seats:** 8 fixed seats, one per costume: `king`, `explore`, `light`, `medium`, `careful`, `heavy`, `fable`, `other`.
  - `king` stands at the map crate.
  - The others sit on stools, lean on the bar, or sit by the hearth.
- **Depth:**
  - Draw order is sorted by foot `y`.
  - Each crab gets a contact shadow, a dark flat oval 2 px tall, drawn before the sprite.
  - Scale follows depth, using the three fixed steps.
- **Away:**
  - A running agent's costume, taken from the existing `costumeOf(a)`, leaves its seat empty, with an untouched mug on the table.
  - Two agents with the same costume show a "×2 out" tag on the bar.
- **`king`:** the main session. It never leaves: it studies the map while the main session works, and idles otherwise.
- **Walking:**
  - For about 4 s after an agent starts or ends, its crab is placed by time, walking between its seat and the door at the bar end. It uses the existing `.run` legs.
  - The position comes from `nowAt`, not from a one-shot CSS animation, because the 1 s redraw would restart it.
- **Idle:**
  - A new `.idle` class gives a slow 2 s bob, plus a blink now and then.
  - Reduced motion stops it.

## Card and code

- **Card:**
  - The head reads "Hideout · 5 home · 3 out" and folds like the other heads.
  - The card has a fixed height; the Agents card's flex fill takes the rest of the window.
  - The scroll map (`cardRects`) shifts the Agents and Skills cards down by the tavern's height. The tile tooltips (`tileBox`) do not move.
  - Under about 40 body rows the card starts folded.
- **Code:**
  - `hideoutSvg(W, crew, nowAt)` in `plugins/hideout/hooks/register.tsx` reuses `crab()`, `costumeOf()`, `noise()`, `mx()` and the TOKENS CSS.
  - The scene is cached by key (width, who is out, the walk frame), so idle redraws cost nothing.
- **Text:**
  - STRINGS get `hideout`, `home` and `out` in en, ru and he.
  - The alt text names who is home and who is out.
- **Test:** a running agent's costume is absent from the scene, and the head counts it as out.

## Not in scope

- No scene in the terminal panel.
- Background shells don't send a crab out.
- No new costumes.

## Risks

- A dithered floor, the light falloff and 8 crabs make a few thousand rects. The cache makes this a one-off cost while idle; walk frames rebuild it once a second for about 4 s.
- In a short window, the scene squeezes the Agents card.

## References

- Slynyrd, Pixelblog 35, Top Down Interiors (16 px grid, 3/4 interiors, layered furniture): https://www.slynyrd.com/blog/2021/11/30/pixelblog-35-top-down-interiors
- Slynyrd, Pixelblog 6, Light and Shadow (one light source, shadow sharpness): https://www.slynyrd.com/blog/2018/6/15/pixelblog-6-light-and-shadow
- Slynyrd, Pixelblog 3, Graphical Projection (why 3/4): https://www.slynyrd.com/blog/2018/3/14/pixelblog-3-graphical-projections-1

Effort: about 3 hours, including a screenshot check.
