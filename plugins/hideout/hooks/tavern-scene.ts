// The Hideout's room: an isometric pixel tavern at night, drawn once per pane width.
// World (u, v, z): u runs down the right wall, v down the left wall, z up; P maps it to the screen at a fixed
// origin, and the caller shifts the whole room by `dx` so the back corner sits near 42% of the pane.
// Crabs are not drawn here: each seat is an object in the depth order, and the caller adds its crab.

type Pt = [number, number]
type Fp = [number, number, number, number]
export type Spot = { x: number; y: number }

// H ground wall, GZ gallery floor, DL gallery depth, RZ loft wall top (loft storey = H), SV seam where the left loft ends
const OX = 202
const OY = 40
const H = 48
const GZ = 54
const DL = 36
const RZ = GZ + H
const SV = 122
// The stair along the right wall: landing S0..S1 at the gallery edge, N steps of RUN x RISE down to SE, past the strip bottom.
const S0 = 204
const S1 = 216
const N = 10
const RUN = 4.5
const RISE = GZ / (N + 1)
const SE = S1 + N * RUN
const STRIP_H = 144

const P = (u: number, v: number, z = 0): Pt => [OX + u - v, OY + (u + v) / 2 - z]
const f = (n: number): number => +n.toFixed(1)
const at = (x?: string): string => (x ? ' ' + x : '')
const op = (o: number | string): string => `opacity="${o}"`
// A polyline as M and relative steps between the rounded points: the same pixels, shorter markup.
const rel = (a: Pt[]): string => {
  let s = ''
  let X = 0
  let Y = 0
  a.forEach((p, i) => {
    const x = f(p[0])
    const y = f(p[1])
    s += i ? `${i > 1 ? ' ' : 'l'}${f(x - X)} ${f(y - Y)}` : `M${x} ${y}`
    X = x
    Y = y
  })
  return s.replace(/ -/g, '-')
}
const sub = (a: Pt[]): string => rel(a) + 'Z'
const poly = (a: Pt[], fill: string, x?: string): string => `<path d="${sub(a)}" fill="${fill}"${at(x)}/>`
const polys = (list: Pt[][], fill: string, x?: string): string => `<path d="${list.map(sub).join('')}" fill="${fill}"${at(x)}/>`
const rr = ([x = 0, y = 0, w = 0, h = 0]: number[]): string => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`
const px = (fill: string, list: number[][], x?: string): string => (list.length ? `<path d="${list.map(rr).join('')}" fill="${fill}"${at(x)}/>` : '')
const ln = (segs: Pt[][], c: string, w = 1, x?: string): string => `<path d="${segs.map(rel).join('')}" stroke="${c}"${w === 1 ? '' : ` stroke-width="${w}"`}${at(x)}/>`
const ell = (c: Pt, rx: number, ry: number, fill: string, x?: string): string => `<ellipse cx="${f(c[0])}" cy="${f(c[1])}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${at(x)}/>`
const hex = (h: string): number[] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const sh = (h: string, k: number): string => '#' + hex(h).map(c => Math.max(0, Math.min(255, Math.round(c * k))).toString(16).padStart(2, '0')).join('')
const flat = (u0: number, v0: number, u1: number, v1: number, z: number): Pt[] => [P(u0, v0, z), P(u1, v0, z), P(u1, v1, z), P(u0, v1, z)]
// Seeded, so a pane draws the same room on every redraw.
const lcg = (s: number) => (): number => (s = (s * 16807) % 2147483647) / 2147483647
let rnd = lcg(1234567)
const ri = (a: number, b: number): number => a + Math.floor(rnd() * (b - a + 1))
const scatter = <T,>(n: number, fn: (_: unknown, i: number) => T): T[] => Array.from({ length: n }, fn)
// Rects grouped by colour and opacity, painted in first-use order.
type Batch = { r: (c: string, x: number, y: number, w: number, h: number, o?: number) => Batch; s: () => string }
const batch = (): Batch => {
  const g = new Map<string, number[][]>()
  const b: Batch = {
    r(c, x, y, w, h, o = 1) {
      const k = `${c} ${o}`
      const l = g.get(k)
      if (l) l.push([x, y, w, h])
      else g.set(k, [[x, y, w, h]])
      return b
    },
    s: () =>
      [...g]
        .map(([k, l]) => {
          const [c = '', o = '1'] = k.split(' ')
          return px(c, l, o === '1' ? '' : op(o))
        })
        .join(''),
  }
  return b
}

// Textures: tiles of 1 px marks (o > 0 black, o < 0 white), laid over a shaded face.
const TEX: Record<string, [number, number, number[][]]> = {
  planks: [24, 12, [[0, 0, 24, 1, 0.38], [0, 6, 24, 1, 0.38], [0, 1, 24, 1, -0.08], [0, 7, 24, 1, -0.08], [8, 1, 1, 5, 0.3], [20, 7, 1, 5, 0.3], [3, 3, 5, 1, 0.13], [13, 4, 6, 1, 0.1], [10, 2, 3, 1, -0.09], [2, 9, 6, 1, 0.12], [14, 10, 7, 1, 0.1], [5, 8, 4, 1, -0.08], [17, 3, 1, 1, 0.3], [5, 10, 1, 1, 0.3]]],
  vplanks: [12, 24, [[0, 0, 1, 24, 0.38], [1, 0, 1, 24, -0.08], [6, 0, 1, 24, 0.38], [7, 0, 1, 24, -0.08], [1, 8, 5, 1, 0.3], [7, 18, 5, 1, 0.3], [3, 3, 1, 5, 0.12], [9, 6, 1, 6, 0.1], [4, 12, 1, 4, -0.09], [10, 14, 1, 1, 0.3]]],
  stone: [16, 12, [[0, 0, 16, 1, 0.45], [0, 6, 16, 1, 0.45], [0, 1, 1, 5, 0.45], [8, 1, 1, 5, 0.45], [4, 7, 1, 5, 0.45], [12, 7, 1, 5, 0.45], [1, 1, 4, 1, -0.12], [9, 1, 5, 1, -0.12], [5, 7, 4, 1, -0.12], [13, 7, 3, 1, -0.12], [1, 2, 1, 2, -0.07], [9, 2, 1, 2, -0.07], [5, 3, 2, 1, 0.14], [11, 4, 2, 1, 0.12], [7, 9, 2, 1, 0.14], [1, 10, 2, 1, 0.12], [6, 5, 1, 1, 0.25], [14, 10, 1, 1, 0.25]]],
  weave: [8, 8, [[0, 0, 2, 2, -0.16], [4, 4, 2, 2, -0.16], [4, 0, 2, 2, 0.2], [0, 4, 2, 2, 0.2], [3, 3, 1, 1, -0.2], [7, 7, 1, 1, -0.2], [2, 1, 1, 1, 0.14], [6, 5, 1, 1, 0.14], [1, 6, 1, 1, 0.14], [5, 2, 1, 1, 0.14]]],
  cloth: [4, 4, [[0, 0, 1, 1, -0.08], [2, 2, 1, 1, 0.09]]],
  dith: [2, 2, [[0, 0, 1, 1, 1], [1, 1, 1, 1, 1]]],
}
// F floor, R faces +u, L faces +v, V screen, Q roof underside sloping up toward the hall.
const PLANE: Record<string, string> = { F: 'matrix(1 .5 -1 .5 0 0)', R: 'matrix(-1 .5 0 1 0 0)', L: 'matrix(1 .5 0 1 0 0)', V: '', Q: 'matrix(1 .5 -1 -1.5 0 0)' }
// A screen point in that plane's pattern space, so patches line up with the tiles.
const PC: Record<string, (p: Pt) => Pt> = { F: ([x, y]) => [y + x / 2, y - x / 2], L: ([x, y]) => [x, y - x / 2], R: ([x, y]) => [-x, y + x / 2] }
const inP = (p: string, s: string): string => `<g transform="${PLANE[p]}">${s}</g>`
const used = new Set<string>()
const url = (id: string): string => (used.add(id), `url(#${id})`)
const tex = (a: Pt[], n: string, p: string, x?: string): string => poly(a, url(n + p), x)
const tileBody = (marks: number[][]): string => {
  const b = batch()
  for (const [x = 0, y = 0, w = 0, h = 0, o = 0] of marks) b.r(o < 0 ? '#fff' : '#000', x, y, w, h, Math.abs(o))
  return b.s()
}
// Irregular masonry: tint, crack, chip or moss the bricks under random world points of a stone face.
const bricks = (p: string, pts: number[][]): string => {
  const b = batch()
  const pc = PC[p] ?? (q => q)
  pts.forEach(([u = 0, v = 0, z = 0], i) => {
    const [qx, qy] = pc(P(u, v, z))
    const y0 = Math.floor(qy / 6) * 6
    const off = ((y0 % 12) + 12) % 12 ? 4 : 0
    const x0 = Math.floor((qx - off) / 8) * 8 + off
    const k = i % 6
    if (k < 2) b.r('#000', x0 + 1, y0 + 1, 7, 5, 0.17)
    else if (k < 4) b.r('#fff', x0 + 1, y0 + 1, 7, 5, 0.08)
    else if (k === 4) b.r('#000', x0 + 5, y0 + 1, 2, 1, 0.4).r('#000', x0 + 4, y0 + 2, 1, 2, 0.35).r('#000', x0 + 5, y0 + 4, 1, 2, 0.3)
    else b.r('#000', x0 + 1, y0 + 1, 2, 1, 0.45).r('#fff', x0 + 1, y0 + 2, 2, 1, 0.15)
    if (z < 7 && i % 3 === 0) b.r('#4f6a3a', x0 + 2, y0 + 5, 4, 1, 0.6).r('#4f6a3a', x0 + 3, y0 + 4, 2, 1, 0.4)
  })
  return inP(p, b.s())
}

// Floor objects, put in depth order once all are added; `seat` names the crab that sits there.
type Obj = { fp: Fp; key: number; svg: string; bb: number[]; seat?: string }
let objs: Obj[] = []
let visible: Pt = [0, 480]
const bbOf = (fp: Fp, h: number): number[] => {
  const c = [0, h].flatMap(z => [P(fp[0], fp[2], z), P(fp[1], fp[2], z), P(fp[1], fp[3], z), P(fp[0], fp[3], z)])
  return [Math.min(...c.map(p => p[0])), Math.min(...c.map(p => p[1])), Math.max(...c.map(p => p[0])), Math.max(...c.map(p => p[1]))]
}
const add = (fp: Fp, svg: string, h = 12, key?: number, seat?: string): void => {
  const bb = bbOf(fp, h)
  // Off the pane: not drawn.
  if ((bb[0] ?? 0) > visible[1] || (bb[2] ?? 0) < visible[0] || (bb[1] ?? 0) > STRIP_H || (bb[3] ?? 0) < 0) return
  objs.push({ fp, key: key ?? (fp[0] + fp[1] + fp[2] + fp[3]) / 2, svg, bb, seat })
}
const ao = (c: Pt, rx: number, ry: number, o = 0.35): string => ell(c, rx, ry, url('dithF'), op(o))
const shadow = (c: Pt, rx: number, ry: number, o = 0.3): string => ell(c, rx, ry, '#000', op(f(o * 0.55))) + ell(c, rx * 0.7, ry * 0.7, '#000', op(f(o * 0.6)))

// Boxes of one colour, faces merged per paint: lit top, +u face (lower right), +v face (lower left).
// `w` warms the +u face toward the hearth; the list must be back to front and not overlapping (or stair-like).
type BoxOpts = { t?: string; tt?: string; top?: string; k?: number; vert?: boolean; w?: number }
const boxes = (list: number[][], c: string, { t = 'planks', tt = 'planks', top = c, k = 1, vert = false, w = 0 }: BoxOpts = {}): string => {
  const fu: Pt[][] = []
  const fv: Pt[][] = []
  const tp: Pt[][] = []
  const e1: Pt[][] = []
  const e2: Pt[][] = []
  const e3: Pt[][] = []
  const wl: Pt[][] = []
  for (const [u0 = 0, v0 = 0, u1 = 0, v1 = 0, z0 = 0, z1 = 0] of list) {
    tp.push(flat(u0, v0, u1, v1, z1))
    fu.push([P(u1, v0, z1), P(u1, v1, z1), P(u1, v1, z0), P(u1, v0, z0)])
    fv.push([P(u0, v1, z1), P(u1, v1, z1), P(u1, v1, z0), P(u0, v1, z0)])
    e1.push([P(u0, v1, z1), P(u1, v1, z1)])
    e2.push([P(u1, v1, z1), P(u1, v0, z1)])
    wl.push([P(u1, v0, z1), P(u1, v0, z0)])
    e3.push([P(u1, v1, z1), P(u1, v1, z0)], [P(u0, v1, z0), P(u1, v1, z0)], [P(u1, v1, z0), P(u1, v0, z0)])
  }
  const tf = vert ? 'vplanks' : t
  return (
    polys(fu, sh(c, 0.74 * k)) + (tf ? polys(fu, url(tf + 'R')) : '') + (w ? polys(fu, '#ff8a2a', op(f(0.14 * w))) : '') +
    polys(fv, sh(c, 0.56 * k)) + (tf ? polys(fv, url(tf + 'L')) : '') +
    polys(tp, sh(top, 1.08 * k)) + (tt ? polys(tp, url(tt + 'F')) : '') +
    ln(e1, sh(top, 1.45 * k)) + ln(e2, sh(top, 1.25 * k)) + (w ? ln(wl, '#ffc070', 1, op(f(0.7 * w))) : '') + ln(e3, sh(c, 0.32))
  )
}
const box = (u0: number, v0: number, u1: number, v1: number, z0: number, z1: number, c: string, o?: BoxOpts): string => boxes([[u0, v0, u1, v1, z0, z1]], c, o)
// A drum (stool, table top, barrel): side with shade bands, hoops, textured top, rim light.
type DrumOpts = { t?: string; top?: string; hoops?: number[]; vert?: boolean; w?: number; base?: number }
const drum = (cu: number, cv: number, r: number, z0: number, z1: number, c: string, { t = 'planks', top = c, hoops = [], vert = false, w = 0, base = 0 }: DrumOpts = {}): string => {
  const [bx, by] = P(cu, cv, base)
  const rx = f(r * 1.414)
  const ry = f(r * 0.707)
  const yt = f(by - z1)
  const yb = f(by - z0)
  const L = f(bx - rx)
  const R = f(bx + rx)
  const side = `M${L} ${yt}V${yb}A${rx} ${ry} 0 0 0 ${R} ${yb}V${yt}Z`
  const arc = (y: number) => `M${L} ${f(y)}A${rx} ${ry} 0 0 0 ${R} ${f(y)}`
  let s =
    `<path d="${side}" fill="${sh(c, 0.66)}"/><path d="${side}" fill="${url(vert ? 'vplanksV' : 'planksV')}"/>` +
    `<path d="M${f(bx + rx * 0.35)} ${yt}V${f(yb + ry * 0.94)}A${rx} ${ry} 0 0 0 ${R} ${yb}V${yt}Z" fill="#000" opacity=".22"/>` +
    `<path d="M${L} ${yt}V${yb}A${rx} ${ry} 0 0 0 ${f(bx - rx * 0.62)} ${f(yb + ry * 0.78)}V${yt}Z" fill="#fff" opacity=".08"/>`
  if (hoops.length)
    s +=
      `<path d="${hoops.map(z => arc(by - z)).join('')}" fill="none" stroke="#2a2b30" stroke-width="1.4"/><path d="${hoops.map(z => arc(by - z - 1)).join('')}" fill="none" stroke="#8a8e9a" stroke-width=".6"/>` +
      px('#c9c9d0', hoops.map(z => [bx + rx * 0.55, by - z + ry * 0.5, 1, 1]))
  if (w) s += `<path d="M${R} ${yt}V${yb}" stroke="#ffc070" ${op(f(0.8 * w))}/>`
  s +=
    ell([bx, yt], rx, ry, sh(top, 1.12)) + ell([bx, yt], rx, ry, url(t + 'F')) + ell([bx - rx * 0.25, yt - ry * 0.2], rx * 0.55, ry * 0.5, '#fff', op(0.08)) +
    `<path d="M${L} ${yt}A${rx} ${ry} 0 0 0 ${R} ${yt}" fill="none" stroke="${sh(top, 1.5)}"/>`
  return s
}
// A face on a wall plane: the R side (u = 0) runs along v, the L side (v = 0) along u.
const fR = (v0: number, v1: number, z0: number, z1: number, u = 0): Pt[] => [P(u, v0, z1), P(u, v1, z1), P(u, v1, z0), P(u, v0, z0)]
const fL = (u0: number, u1: number, z0: number, z1: number, v = 0): Pt[] => [P(u0, v, z1), P(u1, v, z1), P(u1, v, z0), P(u0, v, z0)]
// Vertical strokes of screen height h up from each point (balusters); dx shifts them for a lit edge.
const vl = (pts: Pt[], h: number, c: string, w: number, dx = 0): string => `<path d="${pts.map(p => `M${f(p[0] + dx)} ${f(p[1])}v${-h}`).join('')}" stroke="${c}" stroke-width="${w}"/>`
// A balustrade along a wall top: balusters, rails, posts; at3(t, z) gives the world line's points.
const railing = (segs: Pt[], at3: (t: number, z: number) => Pt, z0: number): { s: string; posts: number[] } => {
  const bal: Pt[] = []
  const hand: Pt[][] = []
  const low: Pt[][] = []
  const posts: number[] = []
  for (const [a, b] of segs) {
    for (let t = a + 2; t < b; t += 4) bal.push(at3(t, z0 + 1))
    hand.push([at3(a, z0 + 17), at3(b, z0 + 17), at3(b, z0 + 15), at3(a, z0 + 15)])
    low.push([at3(a, z0 + 2.5), at3(b, z0 + 2.5), at3(b, z0 + 1), at3(a, z0 + 1)])
    for (let t = a; t < b - 12; t += 24) posts.push(t)
    posts.push(b)
  }
  return { s: polys(low, '#3a2213') + vl(bal, 14, '#2e1b0f', 1.2) + vl(bal, 14, '#7a4a26', 0.4, 0.7) + polys(hand, '#6a4226') + ln(hand.map(h => [h[0] ?? [0, 0], h[1] ?? [0, 0]]), '#d09a5a'), posts }
}

// The trodden track running straight out of the door (v 150..176); d0..d1 = distance outside the wall.
const track = (d0: number, d1: number): string => {
  const b = batch()
  for (let d = d0 + 3; d < d1 - 2; d += 7) {
    const [x, y] = P(-d, 164 - d + (d % 2 ? 2 : -2), 0)
    b.r('#2e3850', x - 3, y, 7, 1).r('#7a849c', x - 3, y - 2, 6, 2).r('#b0bad0', x - 2, y - 2, 3, 1)
  }
  return poly([P(-d0, 159 - d0), P(-d0, 169 - d0), P(-d1, 169 - d1), P(-d1, 159 - d1)], '#3e4862') + b.s()
}

// The crew's seats: floor point, height of the seat, whether the crab faces left there, and its way to the door.
// Each way runs to the front aisle (u + v near 198, in front of every prop), along it to the doorstep, through
// the door and a step beyond it. The bartender walks out round the counter's open end.
type SeatSpec = { u: number; v: number; z: number; flip: boolean; way: Pt[]; isBehind?: boolean }
const OUT: Pt[] = [[36, 163], [0, 163], [-6, 163]]
const SEAT_SPEC: Record<string, SeatSpec> = {
  king: { u: 110, v: 35, z: 6, flip: false, way: [[122, 48], [122, 76], [86, 112], [56, 142], ...OUT] },
  explore: { u: 44, v: 96, z: 7, flip: true, way: [[56, 104], [56, 142], ...OUT] },
  light: { u: 79, v: 105, z: 7, flip: false, way: [[86, 112], [56, 142], ...OUT] },
  medium: { u: 82, v: 40, z: 7, flip: true, way: [[82, 72], [60, 80], [56, 104], [56, 142], ...OUT] },
  careful: { u: 44, v: 136, z: 7, flip: true, way: OUT },
  heavy: { u: 50, v: 72, z: 7, flip: false, way: [[60, 80], [56, 104], [56, 142], ...OUT] },
  fable: { u: 111, v: 73, z: 7, flip: true, way: [[118, 80], [86, 112], [56, 142], ...OUT] },
  other: { u: 7, v: 100, z: 4, flip: false, way: [[7, 146], [0, 163], [-6, 163]], isBehind: true },
}
// A seat on screen (room coordinates): where the crab's feet are, its walk out as screen points, the index of
// the doorway on it (the crab fades from there), and whether it walks at its seat's depth (behind the counter)
// instead of in front of everything.
export type Seat = { at: Spot; flip: boolean; path: Spot[]; door: number; isBehind: boolean }
const spot = ([x, y]: Pt): Spot => ({ x: f(x), y: f(y) })
export const SEAT_AT: Record<string, Seat> = Object.fromEntries(
  Object.entries(SEAT_SPEC).map(([c, s]) => {
    const path = [P(s.u, s.v, s.z), ...s.way.map(([u, v]) => P(u, v, 0))].map(spot)
    return [c, { at: path[0] ?? { x: 0, y: 0 }, flip: s.flip, path, door: path.length - 2, isBehind: !!s.isBehind }]
  }),
)

// How far the room shifts right for a pane W wide: the back corner near 42% of the pane, and on a narrow pane
// no less than keeps the door in the frame (an even crop would cut it off) and no more than keeps the king's chair in.
export const roomShift = (W: number): number => (W >= 480 ? Math.round(W * 0.42) : Math.min(W - 95, Math.max(186, Math.round(202 - (480 - W) / 2)))) - OX

// The room for a pane W wide, in room coordinates (shift it by `dx`): `under` is everything behind the floor
// objects, `objs` the floor objects back to front (a seat's crab goes right after its seat), `light` the glow and
// shade over them; `glass` is in pane coordinates, the vignette over everything.
export type Scene = { dx: number; under: string; objs: { svg: string; seat?: string }[]; light: string; glass: string }
export const tavernScene = (W: number): Scene => {
  rnd = lcg(1234567)
  used.clear()
  objs = []
  const dx = roomShift(W)
  visible = [-dx, W - dx]
  // The room grows with the pane: walls and floor reach both edges, the yard fills the left, the roof the top right.
  const U = Math.max(300, W - dx - 180)
  const V = Math.max(220, Math.min(310, 206 + dx))
  const YL = Math.min(0, Math.floor(-dx / 4) * 4)
  const vTop = 10 + Math.max(0, Math.ceil((W - dx - 480) / 2))
  // W-dependent extras draw from their own sequence, so the fixed props are the same at every width.
  const more = lcg(7654321)
  const mi = (a: number, b: number): number => a + Math.floor(more() * (b - a + 1))

  // ================= yard beyond the far end of the left wall, straight out from the door
  let yard = px('#0e0c10', [[-dx, 0, W, STRIP_H]]) + px('#121830', [[YL, 0, 64 - YL, 100]]) + px('#1a2242', [[YL, 14, 64 - YL, 86]]) + px('#232e56', [[YL, 24, 64 - YL, 76]])
  {
    yard += ell([15, 11], 13, 13, '#bcd0ff', op(0.05)) + ell([15, 11], 8, 8, '#bcd0ff', op(0.07)) + ell([15, 11], 4.5, 4.5, '#f4f1d8') + px('#c9c4a4', [[13, 9, 2, 1], [16, 12, 1, 1]])
    const st = batch()
    scatter(16, (_, i) => st.r(i % 3 ? '#9fb0d8' : '#eef2ff', ri(1, 60), ri(1, 28), 1, 1))
    for (let i = 0; i < -YL / 4; i++) st.r(i % 3 ? '#9fb0d8' : '#eef2ff', mi(YL, -1), mi(1, 28), 1, 1)
    yard += st.s()
    const ridge = (y0: number, a: number, b: number, s: number, bottom = 100): Pt[] => {
      const p: Pt[] = [[YL, bottom]]
      for (let x = YL; x <= 64; x += 4) p.push([x, Math.round(y0 + a * Math.sin(x / b + s) + 1.5 * Math.sin(x / 5 + s))])
      p.push([64, bottom])
      return p
    }
    yard += poly(ridge(33, 3, 9, 1), '#18203a')
    const pine = (x: number, y: number, h: number): Pt[][] => [[[x, y - h], [x + h * 0.35, y - h * 0.45], [x - h * 0.35, y - h * 0.45]], [[x, y - h * 0.7], [x + h * 0.45, y], [x - h * 0.45, y]]]
    const pines: Pt[] = []
    for (let x = -9; x > YL - 6; x -= 12) pines.push([x, mi(9, 15)])
    yard += polys([...pines, [4, 14], [15, 11], [27, 13], [38, 9]].flatMap(([x, h]) => pine(x, 37, h)), '#101626') + px('#dfe6ff', [...pines.map(([x, h]) => [x - 1, 37 - Math.round(h * 0.75), 2, 1]), [3, 26, 2, 1], [14, 29, 2, 1], [26, 27, 2, 1]], op(0.6))
    // fog bands
    yard += px('#9fb0d8', [[YL, 37, 64 - YL, 2], [YL, 42, 64 - YL, 1]], op(0.1))
    yard += poly(ridge(45, 1.5, 13, 3, STRIP_H), '#4a5878') + poly(ridge(47, 1.5, 13, 3, STRIP_H), '#5c6c8e') + tex(ridge(48, 1.5, 13, 3, STRIP_H), 'dith', 'V', op(0.1))
    // the fence along the yard with a gap where the track runs through; on a wide pane it runs on down the yard
    const fz = (v: number, z: number) => P(-70, v, z)
    const fen = batch()
    const fv1 = Math.max(146, 132 - YL)
    for (let v = 99; v <= fv1 - 3; v += 11) {
      const [x, y] = fz(v, 0)
      fen.r('#1e140e', x - 1, y - 11, 2, 11).r('#e8eeff', x - 1, y - 12, 2, 1)
    }
    yard += ln([[fz(99, 4), fz(fv1, 4)], [fz(99, 8), fz(fv1, 8)]], '#2a1c12', 1.2) + fen.s() + ln([[fz(99, 8.8), fz(fv1, 8.8)]], '#d8e2ff', 0.6, op(0.7))
    // the track above the wall top, the same one the door opening shows below it; a lantern post beside it
    yard += track(48, 72)
    {
      const [x, y] = P(-56, 113, 0)
      yard += ell([x + 3, y], 9, 3, '#ffb04a', op(0.14)) + px('#1e140e', [[x - 1, y - 26, 2, 26], [x - 1, y - 26, 6, 1]]) + px('#2a2b30', [[x + 2, y - 25, 4, 6]]) + px('#ffcf6a', [[x + 3, y - 24, 2, 4]]) + px('#fff1b0', [[x + 3, y - 23, 1, 1]]) + px('#e8eeff', [[x - 1, y - 27, 6, 1]]) + ell([x + 4, y - 22], 7, 6, '#ffc060', op(0.12))
    }
    const sn = batch()
    scatter(22, (_, i) => sn.r('#fff', ri(0, 60), ri(0, 80), 1, 1, i % 2 ? 0.5 : 0.85))
    for (let i = 0; i < -YL / 3; i++) sn.r('#fff', mi(YL, -1), mi(0, 120), 1, 1, i % 2 ? 0.5 : 0.85)
    yard += sn.s()
  }

  // ================= floor
  const floorP = [P(0, 0, 0), P(U, 0, 0), P(U, V, 0), P(0, V, 0)]
  let floor = poly(floorP, '#5a3720') + tex(floorP, 'planks', 'F')
  {
    // irregular boards: tints, butt joints of varied length, nails, knots, scuffs, worn walkways (pattern space px = 141 + u, py = v - 61)
    const b = batch()
    for (let i = 0; i < 90; i++) {
      const py = 6 * ri(-10, 25)
      const w = ri(14, 56)
      const x = ri(141, 360 - w)
      // below the strip, or under the rug
      if (x + py > 290 || (x > 188 && x + w < 262 && py > -26 && py < 42)) continue
      if (i % 3 === 0) b.r('#000', x, py + 1, w, 5, 0.13)
      else if (i % 3 === 1) b.r('#fff', x, py + 1, w, 5, 0.05)
      b.r('#000', x, py + 1, 1, 5, 0.35).r('#e8d8b0', x - 2, py + 2, 1, 1, 0.45).r('#e8d8b0', x - 2, py + 5, 1, 1, 0.45)
      if (i % 5 === 0) b.r('#000', x + 7, py + 3, 2, 1, 0.35).r('#000', x + 6, py + 2, 4, 3, 0.1)
      if (i % 7 === 0) b.r('#000', x + 3, py + 4, ri(3, 7), 1, 0.2)
    }
    for (const [u, v, w, h] of [[6, 112, 34, 64], [24, 92, 40, 44], [44, 64, 44, 40], [12, 104, 22, 50]] as const) b.r('#fff', 141 + u, v - 61, w, h, 0.035)
    floor += inP('F', b.s())
    floor += polys([[P(0, 0, 0), P(U, 0, 0), P(U, 9, 0), P(0, 9, 0)], [P(0, 0, 0), P(9, 0, 0), P(9, V, 0), P(0, V, 0)]], url('dithF'), op(0.45))
    const s = batch()
    scatter(28, (_, i) => {
      const [x, y] = i < 14 ? P(ri(3, 40), ri(140, 182), 0) : P(ri(3, 18), ri(18, 52), 0)
      s.r(i % 2 ? '#d8b45a' : '#a8843a', x, y, ri(2, 3), 1)
    })
    floor += s.s()
  }

  // ================= left loft over the bar half of the left wall (v 0..SV), then the gable that closes it
  let leftLoft = ''
  {
    const bw = fR(40, SV, GZ, RZ, -DL)
    leftLoft += poly(bw, '#5a5044') + tex(bw, 'cloth', 'R') + polys([fR(40, SV, GZ, GZ + 3, -DL), fR(40, SV, RZ - 3, RZ, -DL), fR(88, 91, GZ, RZ, -DL), fR(112, 115, GZ, RZ, -DL)], '#24150c')
    const g = [P(-DL, 30, GZ), P(0, 30, GZ), P(0, SV, GZ), P(-DL, SV, GZ)]
    leftLoft += poly(g, '#3e2818') + tex(g, 'planks', 'F') + poly([P(-DL, 30, GZ), P(-DL + 7, 30, GZ), P(-DL + 7, SV, GZ), P(-DL, SV, GZ)], url('dithF'), op(0.4))
    // bunk with a quilt, a chest, a keg by the gable
    leftLoft += box(-22, 78, -6, 100, GZ, GZ + 7, '#5a3418', { k: 0.8 }) + poly(flat(-21, 84, -7, 99, GZ + 7.6), '#2f5a8a') + tex(flat(-21, 84, -7, 99, GZ + 7.6), 'weave', 'F') + poly(flat(-21, 79, -7, 84, GZ + 8.5), '#d8d0c0') + box(-23, 76, -20, 102, GZ, GZ + 16, '#4a2c17', { tt: '', k: 0.8 })
    leftLoft += box(-14, 104, -4, 114, GZ, GZ + 7, '#6a4226', { k: 0.8 }) + ln([[P(-14, 114, GZ + 4), P(-4, 114, GZ + 4)]], '#2a2b30') + drum(-10, 118, 4.5, 0, 11, '#7a4a24', { hoops: [3, 8], vert: true, base: GZ })
    const r = railing([[40, SV]], (t, z) => P(0, t, z), GZ)
    leftLoft += r.s + boxes(r.posts.map(t => [-1.5, t - 1.5, 1.5, t + 1.5, GZ, GZ + 19]), '#4a2c17', { t: '', tt: '' })
  }
  let gable = ''
  {
    // the end wall at v = SV seen from the yard: cool plaster, timber frame, warm window, snow on the ledges
    const gz = (u: number) => RZ + 2 * (u + DL)
    const gw = (u0: number, u1: number, z0: number, z1: number) => fL(u0, u1, z0, z1, SV)
    const face = [P(-DL, SV, 0), P(0, SV, 0), P(0, SV, gz(0)), P(-DL, SV, gz(-DL))]
    gable += poly(face, '#5a6074') + tex(face, 'cloth', 'L') + polys([gw(-DL, -DL + 3, 0, gz(-DL)), gw(-3, 0, 0, gz(0)), gw(-DL, 0, H, H + 3), gw(-DL, 0, RZ - 2, RZ + 1), [P(-DL + 3, SV, H + 3), P(-DL + 6, SV, H + 3), P(-3, SV, RZ - 2), P(-6, SV, RZ - 2)]], '#2a1a10')
    gable += poly(gw(-27, -11, 62, 80), '#2a1a10') + poly(gw(-25, -13, 64, 78), '#ffb04a') + poly(gw(-25, -13, 71, 78), '#ffd27a') + ln([[P(-19, SV, 64), P(-19, SV, 78)], [P(-25, SV, 71), P(-13, SV, 71)]], '#2a1a10', 1.2)
    gable += ln([[P(-28, SV, 61.5), P(-10, SV, 61.5)], [P(-DL, SV, H + 3.5), P(0, SV, H + 3.5)], [P(-DL, SV, RZ + 1.5), P(0, SV, RZ + 1.5)]], '#e8eeff', 1.2) + poly(face, '#9fb0d8', op(0.05))
  }

  // ================= ground walls (stone wainscot, rail, boards, beam)
  const wallBody = (isRight: boolean): string => {
    const a = (z: number) => P(0, 0, z)
    const b = (z: number) => (isRight ? P(U, 0, z) : P(0, V, z))
    const band = (z0: number, z1: number) => [a(z0), b(z0), b(z1), a(z1)]
    const k = isRight ? 1 : 0.72
    const p = isRight ? 'L' : 'R'
    return (
      poly(band(0, 17), sh('#6d6a72', k)) + tex(band(0, 17), 'stone', p) +
      poly(band(17, 19.5), sh('#4a2d18', k)) + tex(band(17, 19.5), 'planks', p) +
      poly(band(19.5, 43), sh('#6a4226', k)) + tex(band(19.5, 43), 'vplanks', p) +
      poly(band(43, H), sh('#3b2314', k)) + tex(band(43, H), 'planks', p) +
      ln([[a(19.5), b(19.5)], [a(43), b(43)]], sh('#a8703c', k * 0.9)) + ln([[a(17), b(17)]], '#000', 1, op(0.4))
    )
  }
  let walls = wallBody(true) + wallBody(false)
  // gallery fascias: the whole right wall, the left wall up to the seam; past the seam the left wall is cut, a snowy cap
  walls +=
    poly(fL(0, U, H, GZ), '#7a4a26') + tex(fL(0, U, H, GZ), 'planks', 'L') + poly(fR(0, SV, H, GZ), '#5a3418') + tex(fR(0, SV, H, GZ), 'planks', 'R') +
    ln([[P(0, 0, H), P(U, 0, H)], [P(0, 0, H), P(0, SV, H)]], '#1e110a') + ln([[P(0, 0, GZ), P(U, 0, GZ)]], '#e8b070') + ln([[P(0, 0, GZ), P(0, SV, GZ)]], '#b88050')
  walls += poly(flat(-6, SV, 0, V, H), '#8a8478') + tex(flat(-6, SV, 0, V, H), 'stone', 'F') + ln([[P(0, SV, H), P(0, V, H)]], '#d8d0c0')
  {
    const s = batch()
    for (let v = SV + 3, isMore = false; v < V; v += isMore ? mi(5, 10) : ri(5, 10)) {
      const [x, y] = P(-3, v, H)
      if (!isMore && v >= 220) isMore = true
      const n = isMore ? mi(1, 3) : ri(1, 3)
      s.r('#e8eeff', x - n, y - 1, isMore ? mi(2, 5) : ri(2, 5), 1)
    }
    walls += s.s()
  }
  // timber posts
  const postL = (t: number) => fL(t, t + 5, 0, H)
  const postR = (t: number) => fR(t, t + 5, 0, H)
  walls += polys([39, 98].map(postL), '#3a2213') + polys([36].map(postR), '#2e1b0f') + [39, 98].map(t => tex(postL(t), 'vplanks', 'L')).join('') + ln([[P(44, 0, 0), P(44, 0, H)], [P(103, 0, 0), P(103, 0, H)], [P(0, 41, 0), P(0, 41, H)]], '#000', 1, op(0.35))
  {
    // irregular masonry and boards (right wall px = 202 + u, py = -61 - z; left wall px = v - 202, py = 141 - z); none where the stair and hearth cover the wall
    walls += bricks('L', scatter(30, (_, i) => [i % 2 ? ri(2, 46) : i % 4 ? ri(46, 104) : ri(162, 192), 0, ri(1, 16)])) + bricks('R', scatter(18, (_, i) => [0, i % 3 ? ri(2, 24) : ri(136, 216), ri(1, 16)]))
    const b = batch()
    for (let i = 0; i < 14; i++) {
      const c = 6 * ri(41, 50) + 1
      b.r(i % 2 ? '#000' : '#fff', c, -104, 5, 23, i % 2 ? 0.12 : 0.05)
      if (i % 3 === 0) b.r('#000', c + 2, -96 + ri(0, 10), 1, 2, 0.35)
      b.r('#e8d8b0', c + 2, -82, 1, 1, 0.4).r('#e8d8b0', c + 2, -101, 1, 1, 0.4)
    }
    const c = batch()
    for (const v of [-196, -184, -172, -160, -16, -4]) c.r('#000', v, 98, 5, 23, 0.1).r('#e8d8b0', v + 2, 120, 1, 1, 0.4)
    walls += inP('L', b.s()) + inP('R', c.s())
  }
  // posts that rise to the strip top: the back corner, and the seam where the left loft meets the yard
  walls += box(-3, -3, 3, 3, 0, 96, '#3a2213', { vert: true, tt: '' }) + box(-3, SV - 3, 2, SV + 3, 0, 200, '#3a2213', { vert: true, tt: '' })

  // ================= wall furniture
  let wallProps = ''
  {
    // the door (left wall, v 150..176) standing open: snowy yard and the track seen through it, a lit doorstep
    wallProps += poly(fR(148, 178, 0, 41), '#24150c') + poly(fR(150, 176, 0, 38), '#5c6c8e') + tex(fR(150, 176, 0, 38), 'dith', 'R', op(0.1)) + poly(fR(150, 176, 28, 38), '#8a9ac0', op(0.2))
    wallProps += track(0, 38) + poly([P(0, 150, 0), P(0, 176, 0), P(-9, 171, 0), P(-9, 155, 0)], '#ffb04a', op(0.22))
    wallProps += poly(fR(149, 177, 0, 1.5), '#5b3a20') + poly(fR(150, 176, 1.5, 3.5), '#ffb04a', op(0.5))
    wallProps += poly(fR(148, 150.5, 0, 38), '#5b3a20') + poly(fR(175.5, 178, 0, 38), '#4a2c17') + poly(fR(148, 178, 38, 41), '#3a2213') + ln([[P(0, 148, 41), P(0, 178, 41)]], '#a8703c')
    const [h1x, h1y] = P(0, 176, 10)
    const [h2x, h2y] = P(0, 176, 28)
    wallProps += px('#2c2d34', [[h1x, h1y - 2, 2, 3], [h2x, h2y - 2, 2, 3]])
  }
  {
    // coat hooks with a cloak and a hat beside the door, v 180..188
    const [x, y] = P(0, 182, 33)
    const [x2, y2] = P(0, 187, 33)
    wallProps += ln([[P(0, 179, 33), P(0, 189, 33)]], '#3a2213', 1.5) + px('#2c2d34', [[x, y - 1, 1, 2], [x2, y2 - 1, 1, 2]])
    const cl: Pt[] = [[x - 2, y], [x + 2, y - 1], [x + 4, y + 16], [x - 4, y + 18]]
    wallProps += poly(cl, '#2f4a3a') + tex(cl, 'cloth', 'R') + px('#4a6a52', [[x - 2, y + 1, 1, 15]]) + px('#4a2c17', [[x2 - 3, y2 - 3, 6, 2], [x2 - 2, y2 - 5, 4, 2]]) + px('#7a4a26', [[x2 - 2, y2 - 5, 4, 1]])
  }
  {
    // the notice board (left wall), v 10..32
    wallProps += poly(fR(10, 32, 21, 42), '#3a2213') + poly(fR(12, 30, 23, 40), '#b08a56') + tex(fR(12, 30, 23, 40), 'cloth', 'R') + poly(fR(12, 30, 23, 40), '#000', op(0.1))
    for (const [v0, z0, c] of [[14, 32, '#e8dcc0'], [20, 26, '#f0e6cc'], [24, 33, '#d8c9a6'], [14, 24, '#cdbb92']] as const) {
      const [nx, ny] = P(0, v0 + 2.5, z0 + 6)
      wallProps += poly(fR(v0, v0 + 5, z0, z0 + 6), c) + px('#c0392b', [[nx - 0.5, ny, 1.5, 1.5]]) + ln([[P(0, v0 + 1, z0 + 4), P(0, v0 + 4, z0 + 4)], [P(0, v0 + 1, z0 + 2.5), P(0, v0 + 3, z0 + 2.5)]], '#5a4a30', 0.6)
    }
  }
  {
    // bottle shelves behind the bar (left wall), v 58..134, two shelves
    const bot = batch()
    for (const z of [22, 33]) {
      const sh0 = [P(0, 58, z), P(7, 58, z), P(7, 134, z), P(0, 134, z)]
      wallProps += poly(sh0, '#7a4a26') + tex(sh0, 'planks', 'F') + poly([P(7, 58, z), P(7, 134, z), P(7, 134, z - 2.5), P(7, 58, z - 2.5)], '#3d2413') + ln([[P(7, 58, z), P(7, 134, z)]], '#c08a4a')
      for (let v = 61, i = 0; v < 132; v += 6 + (i % 3), i++) {
        const c = ['#3f8f5c', '#9a3b3b', '#c99a2e', '#3f6fb0', '#7a4aa0', '#8a5a2a'][(i * 5 + (z > 30 ? 2 : 0)) % 6] ?? '#8a5a2a'
        const [x, y] = P(4, v, z)
        const h = i % 4 === 0 ? 10 : 7
        if (i % 7 === 3) {
          bot.r('#d8d8e0', x - 2, y - 4, 4, 4).r('#fff', x - 2, y - 4, 1, 4, 0.5)
          continue
        }
        bot.r(sh(c, 0.85), x - 1.5, y - h, 3, h).r(sh(c, 1.35), x - 1.5, y - h, 1, h).r(sh(c, 0.6), x - 1, y - h - 2, 2, 2).r('#cfae6a', x - 1, y - h - 3, 2, 1).r('#e8dcc0', x - 1, y - 3, 3, 2, 0.7)
      }
    }
    wallProps += bot.s()
  }
  {
    // herbs and garlic hanging from the beam over the bar
    const hb = batch()
    for (let v = 64, i = 0; v < 132; v += 13, i++) {
      const [x, y] = P(0, v, 47)
      hb.r('#6a5a3a', x, y, 1, 3)
      if (i % 3 === 2) hb.r('#e8e0c8', x - 1, y + 3, 3, 2).r('#e8e0c8', x - 2, y + 5, 3, 2).r('#e8e0c8', x, y + 6, 3, 2).r('#b8a888', x - 1, y + 7, 1, 1)
      else hb.r(i % 2 ? '#5a7a3a' : '#7a8a42', x - 2, y + 3, 5, 3).r(i % 2 ? '#3e5a2a' : '#5a6a2e', x - 1, y + 6, 4, 3).r('#8aa858', x - 2, y + 3, 1, 2).r('#a8843a', x - 1, y + 2, 3, 1)
    }
    wallProps += hb.s()
  }
  // the right wall: a window in the back corner (WG the glass's u range), plate shelf, dartboard, then the hearth, banner and stair
  const WG: Pt = [7, 35]
  {
    const pt = (u: number, z: number, w: number, h: number) => {
      const [x, y] = P(u, 0, z)
      return [x, y, w, h]
    }
    wallProps += poly(fL(4, 38, 18, 44), '#2a190e') + poly(fL(...WG, 21, 41), '#16243e') + poly(fL(...WG, 32, 41), '#243a62') + poly(fL(...WG, 21, 26), '#0f1a30')
    wallProps += poly([P(7, 0, 41), P(15, 0, 41), P(7, 0, 33)], '#bcd0ff', op(0.16)) + ln([[P(21, 0, 21), P(21, 0, 41)], [P(7, 0, 31), P(35, 0, 31)]], '#4a2c17', 1.5) + ln([[P(7, 0, 41), P(35, 0, 41)]], '#8a5a30')
    wallProps += px('#f4f1d8', [pt(28, 38, 2, 2)]) + px('#9fb0d8', [pt(10, 37, 1, 1), pt(32, 27, 1, 1), pt(14, 24, 1, 1)])
    wallProps += box(2, 0, 40, 5, 15, 18, '#6a4226')
    const [qx, qy] = P(28, 2.5, 18)
    wallProps += px('#a0522d', [[qx - 3, qy - 4, 6, 4]]) + px('#c8703a', [[qx - 3, qy - 4, 2, 4]]) + px('#7a3a1a', [[qx - 4, qy - 5, 8, 1]]) + px('#3a7a40', [[qx - 2, qy - 9, 1, 4], [qx + 1, qy - 8, 1, 3]]) + px('#d8406a', [[qx - 3, qy - 11, 2, 2], [qx + 2, qy - 9, 2, 2]]) + px('#e6b83a', [[qx, qy - 10, 2, 2]])
    const [mx, my] = P(105, 0, 0)
    wallProps += px('#120a08', [[mx - 1, my - 3, 3, 3], [mx, my - 4, 1, 1]]) + px('#8a8d98', [[mx + 5, my + 2, 3, 2], [mx + 8, my + 3, 2, 1]]) + px('#f0a0a0', [[mx + 5, my + 1, 1, 1]])
    const bn = [P(164, 0, 46), P(182, 0, 46), P(182, 0, 24), P(173, 0, 28), P(164, 0, 24)]
    wallProps += ln([[P(162, 0, 46), P(184, 0, 46)]], '#c9a23a', 1.2) + poly(bn, '#7a1f2a') + tex(bn, 'cloth', 'L') + ln([[P(165, 0, 45), P(165, 0, 26)], [P(181, 0, 45), P(181, 0, 26)]], '#c9a23a', 0.8) + poly(fL(169, 177, 33, 40), '#c9a23a') + poly(fL(171, 175, 34, 39), '#7a1f2a') + poly([P(164, 0, 46), P(168, 0, 46), P(168, 0, 25), P(164, 0, 24)], '#000', op(0.2))
    const c = (PC.L ?? (q => q))(P(92, 0, 34))
    const cc = (r: number, fill: string) => `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${r}" fill="${fill}"/>`
    wallProps += inP('L', cc(5.5, '#3a2a1a') + cc(4.5, '#d8c9a6') + cc(3.2, '#2a2420') + cc(2, '#a83a2a') + cc(0.8, '#e8dcc0'))
    const [x, y] = P(92, 0, 34)
    wallProps += ln([[[x + 1, y - 1], [x + 4, y - 3]], [[x - 2, y + 2], [x + 1, y + 1]]], '#c9c9d0', 0.8) + px('#c0392b', [[x + 4, y - 4, 1, 1], [x + 1, y, 1, 1]])
    // plate shelf with plates, jugs and hanging mugs, u 52..76
    wallProps += box(52, 0, 76, 5, 28, 30, '#7a4a26')
    const cir = (u: number, r: number, fill: string) => {
      const q = (PC.L ?? (p => p))(P(u, 2, 34))
      return `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${r}" fill="${fill}"/>`
    }
    wallProps += inP('L', [56, 63].map(u => cir(u, 3.4, '#d8d0c0') + cir(u, 2.2, '#4a6fa0') + cir(u, 1.2, '#e8e0d0')).join(''))
    const jb = batch()
    for (const [u, k] of [[69, '#b8703a'], [74, '#c8c0a8']] as const) {
      const [jx, jy] = P(u, 3, 30)
      jb.r(k, jx - 2, jy - 6, 4, 6).r(sh(k, 1.3), jx - 2, jy - 6, 1, 6).r(sh(k, 0.7), jx + 2, jy - 5, 1, 3).r(sh(k, 0.8), jx - 1, jy - 8, 2, 2)
    }
    for (const u of [56, 62, 68, 74]) {
      const [kx, ky] = P(u, 2, 27)
      jb.r('#2c2d34', kx, ky, 1, 2).r('#c9c9d0', kx - 1, ky + 2, 3, 3).r('#fff', kx - 1, ky + 2, 1, 3, 0.5)
    }
    wallProps += jb.s()
  }
  {
    // cobwebs in the corners
    const web = (c: Pt, rays: Pt[], r: number) =>
      ln(rays.map(([a, b]): Pt[] => [c, [c[0] + a * r, c[1] + b * r]]), '#c8ccd8', 0.5, op(0.45)) +
      ln(rays.slice(1).map(([a, b], i): Pt[] => [[c[0] + (rays[i]?.[0] ?? 0) * r * 0.55, c[1] + (rays[i]?.[1] ?? 0) * r * 0.55], [c[0] + a * r * 0.55, c[1] + b * r * 0.55]]), '#c8ccd8', 0.5, op(0.35))
    wallProps += web(P(0, 0, 42), [[1, 0.5], [0.9, 1.1], [0.2, 1], [-0.5, 1], [-1, 0.5]], 10) + web(P(107, 0, 52), [[-1, -0.5], [-0.9, 0.3], [-0.4, 1], [0, 1]], 8) + web(P(0, 145, 47), [[1, 0.2], [0.8, 0.9], [0.1, 1]], 7)
  }
  // sconces
  const SC: [number, number, string][] = [[41.5, 0, 'L'], [0, 141, 'R']]
  for (const [u, v] of SC) {
    const [x, y] = P(u, v, 30)
    wallProps += px('#2c2d34', [[x - 1, y - 1, 3, 5], [x - 2, y + 4, 5, 1]]) + px('#e8dcc0', [[x - 1, y - 5, 3, 4]]) + px('#ffcf6a', [[x - 1, y - 8, 2, 3]]) + px('#fff1b0', [[x - 1, y - 7, 1, 1]]) + px('#d8c9a6', [[x + 1, y - 3, 1, 2]])
  }

  // ================= the loft over the right wall: roof, back wall, gallery floor, props, railing
  let loft = ''
  const roofZ = (v: number) => RZ + 2 * (v + DL)
  const rq = (u0: number, u1: number, v0: number, v1: number) => [P(u0, v0, roofZ(v0)), P(u1, v0, roofZ(v0)), P(u1, v1, roofZ(v1)), P(u0, v1, roofZ(v1))]
  const lw = (u0: number, u1: number, z0: number, z1: number) => fL(u0, u1, z0, z1, -DL)
  {
    loft += poly(rq(150, U, -DL, vTop), '#23170f') + tex(rq(150, U, -DL, vTop), 'planks', 'Q')
    const rafters: Pt[][] = []
    const lit: Pt[][] = []
    for (let u = 196; u < U; u += 20) {
      rafters.push(rq(u, u + 4, -DL, vTop))
      lit.push([P(u + 4, -DL, RZ), P(u + 4, vTop, roofZ(vTop))])
    }
    loft += polys(rafters, '#120a06') + ln(lit, '#5a3a22') + poly(rq(150, U, -20, -17), '#3a2414') + ln([[P(150, -17, roofZ(-17)), P(U, -17, roofZ(-17))]], '#8a5a30')
    // the back wall: half-timbered plaster in shadow
    loft += poly(lw(40, U, GZ, RZ), '#6a5e4e') + tex(lw(40, U, GZ, RZ), 'cloth', 'L') + poly(lw(40, U, GZ, RZ), '#000', op(0.15))
    const tim = [lw(40, U, GZ, GZ + 3), lw(40, U, RZ - 3, RZ), lw(40, U, GZ + 33, GZ + 35)]
    for (let u = 124; u < U; u += 40) {
      tim.push(lw(u, u + 3, GZ, RZ))
      tim.push([P(u + 3, -DL, RZ - 3), P(u + 7, -DL, RZ - 3), P(u + 22, -DL, GZ + 35), P(u + 18, -DL, GZ + 35)])
    }
    loft += polys(tim, '#2e1b0f') + ln([[P(40, -DL, GZ + 3), P(U, -DL, GZ + 3)]], '#6a4226')
    // the guest-room door: planks, strap hinges, number plate, ring pull, warm light under it
    const d = lw
    const [g1x, g1y] = P(141, -DL, GZ + 8)
    const [g2x, g2y] = P(141, -DL, GZ + 24)
    loft += poly(d(136, 160, GZ, GZ + 33), '#2e1b0f') + poly(d(139, 157, GZ + 1.2, GZ + 30), '#6a4226') + tex(d(139, 157, GZ + 1.2, GZ + 30), 'vplanks', 'L') + polys([d(139, 151, GZ + 7, GZ + 8.5), d(139, 151, GZ + 23, GZ + 24.5)], '#2a2b30') + poly(d(146, 151, GZ + 16, GZ + 19.5), '#c9a23a') + ln([[P(148, -DL, GZ + 16.6), P(148, -DL, GZ + 18.8)]], '#3a2213', 0.8)
    loft += poly(d(139, 157, GZ, GZ + 1.2), '#ffc060') + poly([P(139, -DL, GZ), P(157, -DL, GZ), P(159, -30, GZ), P(141, -30, GZ)], '#ffb04a', op(0.18)) + px('#c9c9d0', [[g1x, g1y - 1, 1, 1], [g2x, g2y - 1, 1, 1]])
    {
      const [x, y] = P(154, -DL, GZ + 13)
      loft += `<circle cx="${f(x)}" cy="${f(y)}" r="1.5" fill="none" stroke="#2a2b30"/>`
    }
    // a window well away from the door, with a sill and its moonlight on the boards
    const [sx, sy] = P(220, -DL, GZ + 27)
    loft += poly(lw(206, 226, GZ + 12, GZ + 32), '#2e1b0f') + poly(lw(208, 224, GZ + 14, GZ + 30), '#1c2c4c') + poly(lw(208, 224, GZ + 23, GZ + 30), '#2c4470') + ln([[P(216, -DL, GZ + 14), P(216, -DL, GZ + 30)], [P(208, -DL, GZ + 22), P(224, -DL, GZ + 22)]], '#2e1b0f', 1.2) + px('#eef2ff', [[sx, sy, 1, 1]])
    loft += box(205, -DL, 227, -DL + 3, GZ + 10, GZ + 12, '#6a4226', { k: 0.8 })
    // the gallery floor
    const gf = [P(0, -DL, GZ), P(U, -DL, GZ), P(U, 0, GZ), P(0, 0, GZ)]
    loft += poly(gf, '#4a301e') + tex(gf, 'planks', 'F') + poly([P(40, -DL, GZ), P(U, -DL, GZ), P(U, -DL + 7, GZ), P(40, -DL + 7, GZ)], url('dithF'), op(0.4))
    loft += poly([P(207, -24, GZ), P(223, -24, GZ), P(227, -10, GZ), P(211, -10, GZ)], '#bcd0ff', op(0.12)) + poly([P(208, -DL, GZ + 30), P(224, -DL, GZ + 30), P(227, -10, GZ), P(211, -10, GZ)], '#bcd0ff', op(0.04))
    {
      // a hammock slung from the rafters between the door and the window
      const a = P(166, -22, GZ + 16)
      const b = P(194, -22, GZ + 16)
      const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 7]
      loft +=
        ln([[a, [a[0], 0]], [b, [b[0], 0]]], '#8a7a58', 0.7) +
        `<path d="M${f(a[0])} ${f(a[1])}Q${f(m[0])} ${f(m[1])} ${f(b[0])} ${f(b[1])}L${f(b[0])} ${f(b[1] + 3)}Q${f(m[0])} ${f(m[1] + 4)} ${f(a[0])} ${f(a[1] + 3)}Z" fill="#b89a68"/><path d="M${f(a[0])} ${f(a[1] + 1.5)}Q${f(m[0])} ${f(m[1] + 2)} ${f(b[0])} ${f(b[1] + 1.5)}" fill="none" stroke="#7a2f2f"/>` +
        ell([m[0] - 4, m[1] - 2], 4, 1.6, '#5a4a7a')
    }
    {
      // a spinning wheel under the window, crates and a keg at the far end
      const [x, y] = P(214, -14, GZ)
      loft += ell([x, y], 7, 2, '#000', op(0.3)) + px('#4a2c17', [[x - 5, y - 4, 10, 2], [x - 4, y - 2, 1, 2], [x + 4, y - 2, 1, 2], [x + 3, y - 9, 1, 6]]) + `<circle cx="${x - 1}" cy="${y - 11}" r="6" fill="none" stroke="#6a4226" stroke-width="1.2"/>` + ln([[[x - 7, y - 11], [x + 5, y - 11]], [[x - 1, y - 17], [x - 1, y - 5]]], '#4a2c17', 0.6) + px('#d8c9a6', [[x - 5, y - 7, 2, 2]])
    }
    loft += boxes([[236, -32, 250, -18, GZ, GZ + 12]], '#9a7440', { k: 0.8 }) + box(250, -30, 262, -18, GZ, GZ + 10, '#8a6838', { k: 0.8 }) + box(239, -30, 248, -21, GZ + 12, GZ + 20, '#a07a44', { k: 0.8 }) + drum(268, -12, 6, 0, 12, '#7a4a24', { hoops: [3, 9], vert: true, base: GZ })
    // the balustrade, with gaps for the chimney stack and the stair head
    const r = railing([[20, 116], [152, S0], [S1, U - 28]], (t, z) => P(t, 0, z), GZ)
    loft += r.s + boxes([...new Set(r.posts)].map(u => [u - 1.5, -1.5, u + 1.5, 1.5, GZ, GZ + 19]), '#4a2c17', { t: '', tt: '' })
  }

  // ================= the hearth: chimney breast and the stack rising through the loft
  const FU0 = 108
  const FU1 = 160
  const MZ = 40
  let hearth = ''
  {
    const fv = (u0: number, u1: number, z0: number, z1: number, v = 14) => fL(u0, u1, z0, z1, v)
    const side = [P(FU1, 0, GZ), P(FU1, 14, GZ), P(FU1, 14, 0), P(FU1, 0, 0)]
    hearth += poly(side, '#4d4a54') + tex(side, 'stone', 'R') + poly(fv(FU0, FU1, 0, GZ), '#7c7984') + tex(fv(FU0, FU1, 0, GZ), 'stone', 'L') + poly(flat(FU0, 0, FU1, 14, GZ), '#8a8792') + tex(flat(FU0, 0, FU1, 14, GZ), 'stone', 'F')
    const sf = fL(118, 150, GZ, 170, 12)
    const ss = [P(150, 0, 170), P(150, 12, 170), P(150, 12, GZ), P(150, 0, GZ)]
    hearth += poly(ss, '#45424c') + tex(ss, 'stone', 'R') + poly(sf, '#6e6b76') + tex(sf, 'stone', 'L') + ln([[P(150, 12, GZ), P(150, 12, 170)]], '#a8a4b0', 0.8) + ln([[P(118, 12, GZ), P(150, 12, GZ)]], '#2a282e')
    hearth += bricks('L', scatter(30, (_, i) => (i % 2 ? [ri(119, 149), 12, ri(56, 140)] : [ri(108, 159), 14, i % 4 ? ri(29, 52) : ri(1, 23)]).map((n, j) => (j === 0 && i % 4 === 0 && n > 118 && n < 150 ? (n < 134 ? 110 : 157) : n))))
    // a shield with crossed swords on the stack
    const q = (PC.L ?? (p => p))(P(134, 12, 76))
    const [a1x, a1y] = P(124, 12, 66)
    const [a2x, a2y] = P(144, 12, 66)
    hearth += ln([[P(124, 12, 66), P(144, 12, 86)], [P(144, 12, 66), P(124, 12, 86)]], '#c9c9d0', 1.2) + px('#8a6a2a', [[a1x - 1, a1y - 1, 2, 2], [a2x - 1, a2y - 1, 2, 2]])
    hearth += inP('L', `<path d="M${f(q[0] - 7)} ${f(q[1] - 8)}h14v7q0 7-7 10q-7-3-7-10z" fill="#2f5a8a"/><path d="M${f(q[0] - 1)} ${f(q[1] - 8)}h2v17h-2z" fill="#c9a23a"/><path d="M${f(q[0] - 7)} ${f(q[1] - 2)}h14v2h-14z" fill="#c9a23a"/><path d="M${f(q[0] - 7)} ${f(q[1] - 8)}h14v7q0 7-7 10q-7-3-7-10z" fill="none" stroke="#1e3a5a"/>`)
    // the firebox
    hearth += poly(fv(FU0 + 12, FU1 - 12, 0, 24), '#0e0a0a') + poly([P(FU0 + 12, 14, 24), P(FU0 + 12, 14, 0), P(FU0 + 12, 6, 0), P(FU0 + 12, 6, 21)], '#2a1a14') + poly(fv(FU0 + 14, FU1 - 14, 0, 18, 8), '#3a1a0e', op(0.8))
    hearth += poly(fv(FU0 + 10, FU1 - 10, 24, 28), '#5a5760') + tex(fv(FU0 + 10, FU1 - 10, 24, 28), 'stone', 'L') + ln([[P(FU0 + 10, 14, 24), P(FU1 - 10, 14, 24)]], '#ffb060', 1, op(0.5))
    const fx = (u: number, z: number) => P(u, 12, z)
    hearth += poly([fx(FU0 + 15, 0), fx(FU1 - 15, 0), fx(FU1 - 17, 7), fx(FU0 + 17, 7)], '#ff8a2a', op(0.55))
    for (const o of ['fl1', 'fl2']) {
      const a = o === 'fl1' ? 0 : 2
      hearth +=
        poly([fx(FU0 + 15, 1), fx(FU0 + 18, 12 - a), fx(FU0 + 23, 8 + a), fx(FU0 + 28, 18 - a), fx(FU0 + 31, 9 + a), fx(FU1 - 17, 13 - a), fx(FU1 - 16, 1)], '#e8531a', `class="${o}"`) +
        poly([fx(FU0 + 19, 1), fx(FU0 + 23, 9 - a), fx(FU0 + 28, 14 + a), fx(FU0 + 33, 7 - a), fx(FU1 - 19, 10 + a), fx(FU1 - 18, 1)], '#ff9a2a', `class="${o}"`) +
        poly([fx(FU0 + 23, 1), fx(FU0 + 28, 8 + a), fx(FU0 + 32, 3), fx(FU1 - 22, 6 - a), fx(FU1 - 21, 1)], '#ffd66a', `class="${o}"`)
    }
    hearth += poly([fx(FU0 + 14, 0), fx(FU1 - 14, 0), fx(FU1 - 14, 3), fx(FU0 + 14, 3)], '#3a2213') + ln([[fx(FU0 + 14, 3), fx(FU1 - 14, 3)]], '#c86a2a') + ln([[fx(FU0 + 14, 1.5), fx(FU1 - 14, 1.5)]], '#24150c')
    const [d1x] = P(FU0 + 16, 13, 0)
    const [, d1y] = P(FU0 + 16, 13, 6)
    const [d2x] = P(FU1 - 16, 13, 0)
    const [, d2y] = P(FU1 - 16, 13, 6)
    hearth += px('#2a2b30', [[d1x, d1y, 2, 6], [d2x, d2y, 2, 6]])
    // the mantel and its clutter: candle stubs with drips, a keg, a tankard, plates
    hearth += box(FU0 - 6, 0, FU1 + 6, 20, MZ - 4, MZ, '#7a4a26', { w: 0.4 })
    const mp = (u: number, z = MZ) => P(u, 10, z)
    const mb = batch()
    for (const [u, h] of [[FU0 - 1, 6], [FU1 + 1, 4]] as const) {
      const [x, y] = mp(u)
      mb.r('#e8dcc0', x - 1, y - h, 3, h).r('#fff', x - 1, y - h, 1, h, 0.4).r('#d8c9a6', x + 1, y - h + 1, 1, 2).r('#d8c9a6', x - 2, y - 1, 5, 1).r('#ffcf6a', x - 0.5, y - h - 3, 1, 3).r('#fff6d0', x - 0.5, y - h - 4, 1, 1)
    }
    {
      const [x, y] = mp(FU0 + 24)
      mb.r('#6a3a1a', x - 3, y - 6, 6, 6).r('#9a5a2a', x - 3, y - 6, 2, 6).r('#2a2b30', x - 3, y - 4, 6, 1).r('#2a2b30', x - 3, y - 2, 6, 1).r('#c9c9d0', x + 3, y - 5, 2, 3)
    }
    {
      const [x, y] = mp(FU0 + 34)
      mb.r('#c9c9d0', x - 2, y - 5, 4, 5).r('#fff', x - 2, y - 5, 1, 5, 0.5).r('#8a8d98', x + 2, y - 4, 2, 3)
    }
    {
      const [x, y] = mp(FU0 + 44)
      mb.r('#d8d0c0', x - 4, y - 2, 8, 1).r('#b8b0a0', x - 4, y - 1, 8, 1).r('#d8d0c0', x - 4, y - 3, 8, 1).r('#4a6fa0', x - 2, y - 3, 4, 1)
    }
    hearth += mb.s()
    const sl = flat(FU0 - 4, 14, FU1 + 4, 28, 1.5)
    hearth += poly(sl, '#706d77') + tex(sl, 'stone', 'F') + poly(fL(FU0 - 4, FU1 + 4, 0, 1.5, 28), '#34323a') + ln([[P(FU0 - 4, 28, 1.5), P(FU1 + 4, 28, 1.5)]], '#a8a4b0')
  }
  // ================= the stair: a straight flight along the right wall past the hearth, rising into the gallery
  // out of the strip bottom. No bottom newel: the foot is below the strip, so flight, handrail and cupboard run out of frame.
  let stair = ''
  {
    const UB = S1 + ((GZ - 9) / RISE) * RUN
    const zk = (k: number) => GZ - (k + 1) * RISE
    const uk = (k: number) => S1 + (k + 1) * RUN
    // crates under the open landing, the closed wall-side stringer, then risers and treads out to the open edge
    stair += box(S0 + 1, 2, S0 + 10, 11, 0, 9, '#8a6838', { k: 0.85 }) + box(S0 + 2, 3, S0 + 8, 9, 9, 15, '#9a7440', { k: 0.85 })
    stair += poly([P(S1, 2, GZ + 1), P(SE, 2, RISE + 1), P(SE, 2, 0), P(S1, 2, GZ - 8)], '#4a2c17')
    const trd: Pt[][] = []
    const ris: Pt[][] = []
    const nose: Pt[][] = []
    for (let k = 0; k < N; k++) {
      const u1 = uk(k)
      const z = zk(k)
      trd.push(flat(u1 - RUN, 2, u1, 12, z))
      ris.push([P(u1, 2, z), P(u1, 12, z), P(u1, 12, z - RISE), P(u1, 2, z - RISE)])
      nose.push([P(u1, 2, z), P(u1, 12, z)])
    }
    stair += polys(ris, '#5a3418') + polys(ris, url('vplanksR')) + polys(trd, '#b07848') + polys(trd, url('planksF')) + ln(nose, '#e8b070')
    // the storage cupboard under the flight, then the open-side stringer cut to the step profile so each notch shows
    const cup = [P(S1, 12, GZ - 8), P(UB, 12, 0), P(S1, 12, 0)]
    const [kx, ky] = P(S1 + 10, 12, 16)
    stair += poly(cup, '#2e1b0f') + tex(cup, 'vplanks', 'L') + poly(fL(S1 + 3, S1 + 13, 0, 30, 12), '#4a2c17') + ln([[P(S1 + 13, 12, 0), P(S1 + 13, 12, 30)], [P(S1 + 3, 12, 30), P(S1 + 13, 12, 30)]], '#c08a4a', 0.6) + px('#c9a23a', [[kx, ky, 1, 2]])
    const str = scatter(N, (_, k) => [P(uk(k) - RUN, 12, zk(k)), P(uk(k), 12, zk(k))]).flat().concat([P(SE, 12, 0), P(UB, 12, 0), P(S1, 12, GZ - 8)])
    stair +=
      poly(str, '#6a4226') + tex(str, 'planks', 'L') + polys(scatter(N, (_, k) => fL(uk(k) - RUN, uk(k), zk(k) - 1.5, zk(k), 12)), '#c08a4a') +
      ln(scatter(N, (_, k): Pt[] => [P(uk(k), 12, zk(k) - 1.5), P(uk(k), 12, zk(k) - RISE)]), '#2e1b0f', 0.8) + ln([[P(S1, 12, GZ - 8), P(UB, 12, 0)]], '#1e110a')
    // the landing flush with the gallery, guard rails round it, a baluster on each tread, the handrail running out of frame, two newels at the head
    stair += box(S0, 0, S1, 12, GZ - 5, GZ, '#7a4a26')
    const bal = scatter(N, (_, k) => P(uk(k) - RUN / 2, 11, zk(k)))
    const bh = f(16 + RISE / 2)
    stair += vl(bal, bh, '#3a2213', 1.3) + vl(bal, bh, '#a8703c', 0.4, 0.7) + ln([[P(S0, 0, GZ + 16), P(S0, 12, GZ + 16)], [P(S0, 12, GZ + 16), P(S1, 12, GZ + 16)], [P(S1, 11, GZ + 16), P(SE, 11, RISE + 16)]], '#6a4226', 2) + ln([[P(S0, 12, GZ + 15), P(S1, 12, GZ + 15)], [P(S1, 11, GZ + 15), P(SE, 11, RISE + 15)]], '#d09a5a', 0.6)
    stair += boxes([[S0 - 1, 10, S0 + 2, 13, 0, GZ + 19], [S1 - 1.5, 9.5, S1 + 1.5, 12.5, 0, GZ + 21]], '#4a2c17', { t: '', tt: '' })
  }
  // hanging lanterns on chains
  const LAN = [[160, -3, 92], [6, 60, 66], [232, 6, 84]] as const
  let lanterns = ''
  for (const [u, v, z] of LAN) {
    const [x, y] = P(u, v, z)
    lanterns += ln([[[x, 0], [x, y - 6]]], '#5a5d68', 0.8) + px('#2a2b30', [[x - 3, y - 6, 6, 2], [x - 3, y + 3, 6, 2], [x - 3, y - 4, 1, 7], [x + 2, y - 4, 1, 7]]) + px('#ffcf6a', [[x - 2, y - 4, 4, 7]]) + px('#fff1b0', [[x - 1, y - 2, 2, 3]]) + px('#2a2b30', [[x - 1, y - 8, 2, 2]])
  }

  // ================= floor objects, depth ordered
  // the bar counter, u 14..30, v 56..134
  add(
    [14, 30, 56, 134],
    (() => {
      let s = ao(P(30, 95, 0), 46, 14, 0.3) + shadow(P(34, 95, 0), 48, 14, 0.25)
      s += box(14, 56, 30, 134, 0, 14, '#8a5a30', { vert: true, top: '#a87040', w: 0.5 })
      const pan: Pt[][] = []
      for (let v = 59; v < 130; v += 19) pan.push([P(30, v + 2, 11), P(30, v + 16, 11), P(30, v + 16, 3), P(30, v + 2, 3)])
      const inset = (a: Pt[]): Pt[] => {
        const [p0 = [0, 0], p1 = [0, 0], p2 = [0, 0], p3 = [0, 0]] = a
        return [[p0[0] - 0.6, p0[1] + 1.3], [p1[0] + 0.6, p1[1] + 0.7], [p2[0] + 0.6, p2[1] - 1.3], [p3[0] - 0.6, p3[1] - 0.7]]
      }
      s += polys(pan, '#4a2c17') + polys(pan.map(inset), '#6a4226') + ln(pan.map(a => [a[3] ?? [0, 0], a[2] ?? [0, 0]]), '#c08a4a', 0.8)
      s += ln([[P(30, 56, 1.5), P(30, 134, 1.5)]], '#c9a23a', 1.4) + ln([[P(30, 56, 1.5), P(30, 134, 1.5)]], '#fff6c0', 0.5) + poly([P(30, 56, 14), P(30, 134, 14), P(30, 134, 12.5), P(30, 56, 12.5)], '#c08a4a')
      const b = batch()
      const on = (u: number, v: number) => P(u, v, 14)
      const mug = (u: number, v: number, c = '#d8d8e0') => {
        const [x, y] = on(u, v)
        b.r('#000', x - 3, y, 6, 1, 0.3).r(c, x - 2, y - 5, 4, 5).r('#fff', x - 2, y - 5, 1, 5, 0.5).r(sh(c, 0.7), x + 2, y - 4, 2, 3).r('#f0e0a0', x - 2, y - 5, 4, 1)
      }
      const bottle = (u: number, v: number, c: string) => {
        const [x, y] = on(u, v)
        b.r('#000', x - 2, y, 5, 1, 0.3).r(sh(c, 0.9), x - 1.5, y - 8, 3, 8).r(sh(c, 1.4), x - 1.5, y - 8, 1, 8).r(sh(c, 0.7), x - 1, y - 11, 2, 3).r('#cfae6a', x - 1, y - 12, 2, 1)
      }
      mug(22, 62)
      mug(24, 69, '#c9a23a')
      mug(21, 124)
      bottle(26, 84, '#9a3b3b')
      bottle(23, 88, '#3f8f5c')
      bottle(22, 130, '#3f6fb0')
      {
        const [x, y] = on(20, 106)
        b.r('#c9c9d0', x - 1, y - 9, 2, 9).r('#c9c9d0', x - 3, y - 11, 6, 2).r('#fff', x - 1, y - 9, 1, 9, 0.5).r('#8a8d98', x + 2, y - 11, 1, 4).r('#c0392b', x - 2, y - 13, 4, 2)
      }
      {
        const [x, y] = on(24, 76)
        for (let i = 0; i < 4; i++) b.r(i % 2 ? '#b8b0a0' : '#e0d8c8', x - 4, y - 1 - i, 8, 1)
      }
      {
        const [x, y] = on(24, 116)
        b.r('#8a8d98', x - 3, y - 1, 6, 1).r('#e8dcc0', x - 1, y - 5, 2, 4).r('#d8c9a6', x + 1, y - 3, 1, 2).r('#d8c9a6', x - 2, y - 2, 1, 1).r('#ffcf6a', x - 0.5, y - 8, 1, 3).r('#fff', x - 0.5, y - 9, 1, 1)
      }
      {
        const [x, y] = on(25, 97)
        b.r('#8a6a3a', x - 4, y - 1, 7, 1, 0.7).r('#c9a23a', x - 3, y - 2, 4, 1, 0.6).r('#d8d8e0', x + 2, y - 3, 4, 3).r('#fff', x + 2, y - 3, 4, 1, 0.5)
      }
      return s + b.s()
    })(),
    16,
  )
  // barrels: kegs by the corner end of the bar, one by the hearth (all clear of the door)
  const barrel = (u: number, v: number, r: number, h: number, w = 0) =>
    add([u - r * 0.7, u + r * 0.7, v - r * 0.7, v + r * 0.7], ao(P(u, v, 0), r * 1.6, r * 0.8, 0.35) + shadow(P(u + 2, v + 2, 0), r * 1.6, r * 0.85, 0.3) + drum(u, v, r, 0, h, '#8a5a2e', { top: '#7a4a24', hoops: [2.5, h - 3, h / 2], vert: true, w }), h + 4)
  barrel(9, 28, 6.5, 15)
  barrel(9, 42, 6.5, 15)
  barrel(190, 8, 6, 14)
  // a firewood pile against the chimney side
  add(
    [162, 178, 2, 12],
    (() => {
      const b = batch()
      for (const [i, z] of [[0, 0], [1, 0], [2, 0], [0, 3.5], [1, 3.5], [0.5, 7]] as const) {
        const [x, y] = P(165 + i * 4, 12, z)
        b.r('#4a2a14', x - 7, y - 4, 9, 3).r('#c08a4a', x + 1, y - 4, 3, 3).r('#8a5a2a', x + 2, y - 3, 1, 1)
      }
      return shadow(P(171, 9, 0), 12, 4, 0.3) + b.s()
    })(),
    10,
  )
  // a bench under the corner window with a lute leaning on it
  add(
    [8, 40, 2, 8],
    ao(P(24, 6, 0), 20, 5, 0.35) + boxes([[10, 3, 12, 8, 0, 5], [36, 3, 38, 8, 0, 5]], '#3d2413', { t: '', tt: '' }) + box(8, 2, 40, 8, 5, 7, '#7a4a26', { w: 0.5 }) +
      (() => {
        const [x, y] = P(13, 3, 7)
        return `<ellipse cx="${f(x)}" cy="${f(y - 4)}" rx="4" ry="5" fill="#b8783a"/>` + ell([x, y - 4], 1.4, 1.4, '#2a1a10') + px('#7a4a26', [[x - 1, y - 21, 2, 13]]) + px('#4a2c17', [[x - 1.5, y - 23, 3, 3]]) + ln([[[x - 0.5, y - 21], [x - 0.5, y - 1]]], '#e8dcc0', 0.3) + `<ellipse cx="${f(x - 1)}" cy="${f(y - 5)}" rx="2" ry="3" fill="#fff" opacity=".12"/>`
      })(),
    14,
  )
  // the king's armchair by the hearth
  add(
    [102, 116, 28, 40],
    ao(P(110, 34, 0), 14, 6, 0.35) + shadow(P(112, 36, 0), 13, 5, 0.3) + box(102, 28, 105, 40, 0, 24, '#5a3418', { vert: true, w: 0.6 }) + box(104, 28, 116, 40, 0, 6, '#7a1f2a', { t: 'cloth', tt: 'weave', w: 0.8 }) +
      boxes([[104, 28, 116, 30, 6, 11], [104, 38, 116, 40, 6, 11]], '#5a3418', { w: 0.6 }),
    30,
    undefined,
    'king',
  )
  // the cat asleep on the warm slab
  add(
    [142, 150, 20, 26],
    (() => {
      const [x, y] = P(146, 23, 1.5)
      return ell([x, y], 6, 2, '#000', op(0.3)) + px('#3a3440', [[x - 5, y - 4, 9, 4], [x + 3, y - 6, 4, 3]]) + px('#5a5262', [[x - 4, y - 4, 7, 1], [x + 3, y - 6, 1, 1], [x + 6, y - 6, 1, 1]]) + px('#2a2430', [[x - 7, y - 2, 3, 2]]) + px('#e0b04a', [[x + 4, y - 5, 1, 1]])
    })(),
    8,
  )
  // the rug under the tables
  let rug = ''
  {
    const r = (a: number, b: number, c: number, d: number) => flat(a, b, c, d, 0)
    rug += poly(r(46, 34, 122, 110), '#2a1018') + poly(r(48, 36, 120, 108), '#5a1f22') + poly(r(51, 39, 117, 105), '#c9a23a') + poly(r(53, 41, 115, 103), '#6e2a2a') + tex(r(53, 41, 115, 103), 'weave', 'F') + poly(r(60, 48, 108, 96), '#4a1620') + tex(r(60, 48, 108, 96), 'weave', 'F')
    const dm = (s: number) => [P(84 - s, 72, 0), P(84, 72 - s, 0), P(84 + s, 72, 0), P(84, 72 + s, 0)]
    rug += poly(dm(18), '#c9a23a') + poly(dm(15), '#2f5a8a') + tex(dm(15), 'weave', 'F') + poly(dm(7), '#e0b04a') + poly(dm(4), '#6e2a2a')
    const fr: Pt[][] = []
    for (let u = 48; u < 121; u += 3) fr.push([P(u, 108, 0), P(u + 0.5, 111, 0)])
    for (let v = 36; v < 109; v += 3) fr.push([P(120, v, 0), P(123, v + 0.5, 0)])
    rug += ln(fr, '#c9a23a', 0.8) + poly(r(48, 36, 120, 108), '#000', op(0.08))
  }
  // stools and tables; a seat and its crab are one object, so the stool never covers its crab
  const stool = (u: number, v: number) =>
    ao(P(u, v, 0), 8, 3.5, 0.35) + shadow(P(u + 1, v + 1, 0), 8, 3.4, 0.32) +
    px('#3d2413', [[-3, -3], [3, -3], [-3, 3], [3, 3]].map(([a = 0, b = 0]) => {
      const [x, y] = P(u + a * 0.8, v + b * 0.8, 0)
      return [x - 0.5, y - 6, 1.6, 6]
    })) +
    drum(u, v, 4.2, 6, 8, '#9a6a38', { top: '#a87040', w: 0.5 })
  const seat = (name: string) => {
    const s = SEAT_SPEC[name]
    if (s) add([s.u - 4, s.u + 4, s.v - 4, s.v + 4], stool(s.u, s.v), 30, undefined, name)
  }
  const table = (u: number, v: number, r: number, z: number, items: (p: Pt) => string) =>
    add(
      [u - r * 0.8, u + r * 0.8, v - r * 0.8, v + r * 0.8],
      ao(P(u, v, 0), r * 1.7, r * 0.8, 0.4) + shadow(P(u + 3, v + 3, 0), r * 1.9, r * 0.95, 0.35) +
        boxes([[u - 1.5, v - r * 0.55, u + 1.5, v + r * 0.55, 0, 2.5], [u - r * 0.55, v - 1.5, u + r * 0.55, v + 1.5, 0, 2.5]], '#3d2413', { t: '', tt: '' }) + box(u - 2, v - 2, u + 2, v + 2, 0, z - 2, '#4a2c17', { vert: true, tt: '', w: 0.5 }) +
        drum(u, v, r, z - 2, z, '#8a5a30', { top: '#a87040', w: 0.6 }) + items(P(u, v, z)),
      z + 8,
    )
  const tank = (b: Batch, x: number, y: number, c = '#d8d8e0') => b.r('#000', x - 3, y, 6, 1, 0.3).r(c, x - 2, y - 4, 4, 4).r('#fff', x - 2, y - 4, 1, 4, 0.45).r(sh(c, 0.7), x + 2, y - 3, 2, 2).r('#f0e0a0', x - 2, y - 4, 4, 1)
  // table A: dice and cards between heavy and medium. The near die rolls (`dz`, its pip `dp`) while medium sits
  // here and heavy's spill (`sl`, unseen until heavy's idle shows it) dries in front of the ale.
  table(66, 56, 9, 10, ([x, y]) => {
    const b = batch()
    tank(b, x - 7, y - 1, '#c9a23a')
    tank(b, x + 8, y)
    b.r('#f0e6cc', x - 3, y - 2, 3, 2).r('#e8dcc0', x - 1, y - 1, 3, 2).r('#c0392b', x, y - 1, 1, 1).r('#f4f4f0', x + 3, y - 3, 2, 2).r('#1f1e1d', x + 3, y - 3, 1, 1)
    const die = batch().r('#f4f4f0', x + 1, y + 1, 2, 2).s()
    const pip = batch().r('#1f1e1d', x + 2, y + 2, 1, 1).s()
    const spill = batch().r('#b8862a', x - 9, y + 1, 4, 1).r('#b8862a', x - 8, y + 2, 3, 1).r('#f0d080', x - 8, y + 1, 1, 1).s()
    return b.s() + `<g class="dz">${die}<g class="dp">${pip}</g></g><g class="sl" opacity="0">${spill}</g>`
  })
  seat('heavy')
  seat('medium')
  // table B: a candle stub with wax drips, bread, tankards between light and fable. The candle's tip flickers
  // (the fire's two frames); light slides its tankard (`tk`) while it sits here.
  table(95, 89, 9, 10, ([x, y]) => {
    const b = batch()
    tank(b, x + 7, y - 1, '#8a8d98')
    b.r('#8a8d98', x - 2, y - 1, 5, 1).r('#e8dcc0', x - 1, y - 6, 2, 5).r('#fff', x - 1, y - 6, 1, 5, 0.4).r('#d8c9a6', x + 1, y - 4, 1, 3).r('#d8c9a6', x - 2, y - 2, 1, 1).r('#ffcf6a', x - 0.5, y - 9, 1, 3).r('#c08a4a', x + 2, y + 1, 4, 2).r('#e0b070', x + 2, y + 1, 4, 1)
    const mug = batch()
    tank(mug, x - 7, y)
    return b.s() + `<g class="fl1">${batch().r('#fff', x - 0.5, y - 10, 1, 1).s()}</g><g class="fl2">${batch().r('#ffcf6a', x + 0.5, y - 8, 1, 1).s()}</g><g class="tk">${mug.s()}</g>`
  })
  seat('light')
  seat('fable')
  // bar stools with customers
  seat('explore')
  seat('careful')
  // the bartender on a duckboard behind the counter: only the counter hides its legs
  add([3, 11, 96, 104], '', 30, undefined, 'other')

  // behind before front by footprint, ties by key
  const order = (list: Obj[]): Obj[] => {
    const n = list.length
    const behind = (a: Obj, b: Obj) => a.fp[1] <= b.fp[0] + 0.01 || a.fp[3] <= b.fp[2] + 0.01
    const out: Obj[] = []
    const done = Array<boolean>(n).fill(false)
    const preds = list.map((b, i) => list.flatMap((a, j) => (i !== j && behind(a, b) && !behind(b, a) ? [j] : [])))
    for (let k = 0; k < n; k++) {
      let best = -1
      for (let i = 0; i < n; i++) if (!done[i] && (preds[i] ?? []).every(j => done[j]) && (best < 0 || (list[i]?.key ?? 0) < (list[best]?.key ?? 0))) best = i
      if (best < 0) best = done.findIndex(d => !d)
      done[best] = true
      const o = list[best]
      if (o) out.push(o)
    }
    return out
  }

  // ================= light: stepped pixel pools; warm near each source, cool and dark away from them
  const pool = (c: Pt, rx: number, ry: number, col: string, steps = [1, 0.72, 0.46, 0.24], o = 0.07) => steps.map(s => ell(c, rx * s, ry * s, col, op(o))).join('')
  const wallPool = (p: string, c: Pt, r: number, col: string, steps: number[], o: number) => {
    const q = (PC[p] ?? (x => x))(c)
    return inP(p, steps.map(s => `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="${f(r * s)}" fill="${col}" ${op(o)}/>`).join(''))
  }
  let light = ''
  light += pool(P(134, 36, 0), 82, 32, '#ff9a3a', [1, 0.78, 0.56, 0.36, 0.18], 0.07)
  light += wallPool('L', P(134, 14, 14), 46, '#ff9a3a', [1, 0.7, 0.45, 0.24], 0.07) + wallPool('L', P(92, 0, 20), 30, '#ff9a3a', [1, 0.5], 0.05) + wallPool('L', P(134, 12, 60), 20, '#ff9a3a', [1, 0.5], 0.05)
  for (const [u, v, p] of SC) light += wallPool(p, P(u, v, 34), 16, '#ffc060', [1, 0.55], 0.08) + pool(P(u + (u ? 0 : 8), v + (v ? 0 : 8), 0), 20, 8, '#ffb04a', [1, 0.55], 0.04)
  for (const [u, v, z] of LAN) light += pool(P(u, v, z), 12, 10, '#ffc060', [1, 0.5], 0.08)
  light += wallPool('L', P(160, -DL, GZ + 26), 16, '#ffb04a', [1, 0.5], 0.05) + wallPool('R', P(-DL, 60, GZ + 10), 16, '#ffb04a', [1, 0.5], 0.05)
  light += pool(P(95, 89, 18), 16, 10, '#ffd070', [1, 0.55], 0.06) + pool(P(24, 116, 20), 14, 8, '#ffd070', [1, 0.55], 0.06) + pool(P(66, 56, 14), 14, 7, '#ffc060', [1], 0.04)
  {
    // the moonbeam: a window point (u, 0, z) lands on the floor at md(u, z); shaft hull, floor patch, mullion shadows
    const md = (u: number, z: number) => P(u + 0.3 * z, 0.8 * z, 0)
    const [a, b] = WG
    light += poly([P(a, 0, 41), P(b, 0, 41), P(b, 0, 21), md(b, 21), md(b, 41), md(a, 41)], '#bcd0ff', op(0.07)) + poly([md(a, 21), md(b, 21), md(b, 41), md(a, 41)], '#bcd0ff', op(0.15)) + poly([md(a + 3, 24), md(b - 3, 24), md(b - 3, 38), md(a + 3, 38)], '#bcd0ff', op(0.09))
    light += ln([[md(21, 21), md(21, 41)], [md(a, 31), md(b, 31)]], '#0a1428', 1.5, op(0.3))
    // the same moon through the open door, falling into the room
    const dm = (v: number, z: number) => P(0.8 * z, v + 0.3 * z, 0)
    light += poly([dm(150, 0), dm(176, 0), dm(176, 38), dm(150, 38)], '#bcd0ff', op(0.08)) + poly([dm(154, 4), dm(172, 4), dm(172, 32), dm(154, 32)], '#bcd0ff', op(0.05))
  }
  // cool, dark far corners and the vignette, in pane coordinates
  const glass = poly([[0, STRIP_H], [0, 104], [70, STRIP_H]], '#0a1428', op(0.22)) + poly([[W, 0], [W, 60], [W - 80, 0]], '#0a1428', op(0.2)) + [0, 1, 2, 3].map(i => `<rect width="${W}" height="${STRIP_H}" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="${(i + 1) * 4}"/>`).join('')

  // each plane's pattern holds its own tile, not an href to a shared one: the engine's Svg scrub is not known to keep href
  const defs = [...used]
    .sort()
    .map(id => {
      const [w, h, m] = TEX[id.slice(0, -1)] ?? [1, 1, []]
      const tf = PLANE[id.slice(-1)]
      return `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse"${tf ? ` patternTransform="${tf}"` : ''}>${tileBody(m)}</pattern>`
    })
    .join('')
  return {
    dx,
    under: `<defs>${defs}</defs>${yard}${leftLoft}${gable}${floor}${walls}${wallProps}${loft}${hearth}${stair}${lanterns}${rug}`,
    objs: order(objs).map(o => ({ svg: o.svg, seat: o.seat })),
    light,
    glass,
  }
}
