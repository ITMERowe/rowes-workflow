import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRun, BgTask, Flow, Panel, Phase, PlannedTask, ProjectMap, SkillKind, SkillUse, Task, TaskStatus, WorkItem, WorkKind } from '../types'

const flow = atom({ plugin: 'savvy-progress', key: 'flow' } as const, null)
const agents = atom({ plugin: 'savvy-progress', key: 'agents' } as const, [])
const panel = atom({ plugin: 'savvy-progress', key: 'panel' } as const, {
  isCompact: false,
  isDoneCollapsed: false,
  autoOpenedFor: '',
})
const now = atom({ plugin: 'savvy-progress', key: 'now' } as const, 0)
const bg = atom({ plugin: 'savvy-progress', key: 'bg' } as const, [])
const work = atom({ plugin: 'savvy-progress', key: 'work' } as const, [])
const tasks = atom({ plugin: 'savvy-progress', key: 'tasks' } as const, [])
const kit = atom({ plugin: 'savvy-progress', key: 'kit' } as const, [])
// When the main session's last turn ended: its work before then is no longer live.
const mainIdleAt = atom({ plugin: 'savvy-progress', key: 'mainIdleAt' } as const, 0)
// ribbon's plan windows, for the band's USAGE row.
const windows = atom({ plugin: 'ribbon', key: 'windows' } as const, [])
type UsageWindow = { kind: string; percentUsed: number; resetsAt?: string }

// Background subagents with no model of their own run on a cheap one. Types that pin their
// own model (searcher, editor, reviewer, savvy-*) and forks keep theirs.
const PINNED = new Set(['searcher', 'editor', 'reviewer'])
function routeModel<T extends { background: boolean; fork: boolean; model?: string; subagentType: string; parentModel: string }>(e: T): T {
  if (!e.background || e.fork || e.model || PINNED.has(e.subagentType) || e.subagentType.startsWith('savvy-')) return e
  if (/haiku/i.test(e.parentModel)) return e
  return { ...e, model: e.subagentType === 'Explore' ? 'haiku' : 'sonnet' }
}

const TOOL = 'mcp__savvy-progress__progress'
const STEP_TOOL = 'mcp__savvy-progress__step'
// Added to the end of each savvy worker's brief. Their system prompt words step
// reporting as a condition ("if the step tool appears among your tools") and they
// skip it even with the tool listed; the same request in the brief is followed.
const STEP_BRIEF = `

Progress reporting: before any other work, call \`${STEP_TOOL}\` with \`total\` (your plan in 3-8 steps) and \`done: 0\`; call it again with \`done\` and a few-word \`note\` as each step finishes. It only draws a progress bar.`
const PANE = 'savvy-agents'
const PHASES: readonly Phase[] = ['plan', 'design', 'delegate', 'review', 'close']
const TIERS: readonly string[] = ['fable', 'heavy', 'careful', 'medium', 'light']
// The tools' schemas are advice to the model, not a check: what a call may ask
// the band and the panel to draw is bounded here.
const MAX_TASKS = 200
const MAX_AFTER = 20
const MAX_TITLE = 120
const ACCENT = '#8f8cf4'
const DONE = '#5fbf8f'

type ProgressInput = {
  title?: string
  total?: number
  done?: number
  phase?: Phase
  finished?: boolean
  tasks?: { title?: string; tier?: string; after?: number[] }[]
}

// ---------------------------------------------------------------------------
// Language: the `language` option, else Claude Code's `language` setting, else the
// process locale; English when nothing says Hebrew or Russian.

type Lang = 'en' | 'ru' | 'he'

const STRINGS = {
  en: {
    pane: 'Agents',
    cost: 'Cost',
    tokens: 'Tokens',
    time: 'Time',
    collapse: 'Collapse',
    expand: 'Expand',
    running: 'Running',
    finished: 'Finished',
    planned: 'Planned',
    empty: 'No subagents yet.',
    round: 'round',
    failed: 'error',
    after: 'after',
    tokensWord: 'tokens',
    agentsCount: 'agents',
    isRunning: 'running',
    isFinished: 'finished',
    isPlanned: 'planned',
    opened: 'Agents panel opened.',
    closed: 'Agents panel closed.',
    done: 'Done',
    plan: 'Plan',
    design: 'Design',
    tasks: 'Tasks',
    review: 'Review',
    busy: 'running',
    ctx: 'ctx',
    tier: { light: 'light', medium: 'medium', careful: 'careful', heavy: 'heavy', fable: 'fable', other: 'other' },
    effort: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
  },
  ru: {
    pane: 'Агенты',
    cost: 'Стоимость',
    tokens: 'Токены',
    time: 'Время',
    collapse: 'Свернуть',
    expand: 'Развернуть',
    running: 'Работают',
    finished: 'Завершены',
    planned: 'Запланированы',
    empty: 'Субагентов пока нет.',
    round: 'раунд',
    failed: 'ошибка',
    after: 'после',
    tokensWord: 'токенов',
    agentsCount: 'агентов',
    isRunning: 'работает',
    isFinished: 'завершён',
    isPlanned: 'запланирована',
    opened: 'Панель агентов открыта.',
    closed: 'Панель агентов закрыта.',
    done: 'Готово',
    plan: 'План',
    design: 'Дизайн',
    tasks: 'Задачи',
    review: 'Ревью',
    busy: 'в работе',
    ctx: 'ctx',
    tier: { light: 'light', medium: 'medium', careful: 'careful', heavy: 'heavy', fable: 'fable', other: 'other' },
    effort: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
  },
  he: {
    pane: 'סוכנים',
    cost: 'עלות',
    tokens: 'טוקנים',
    time: 'זמן',
    collapse: 'כיווץ',
    expand: 'הרחבה',
    running: 'פועלים',
    finished: 'הסתיימו',
    planned: 'מתוכננים',
    empty: 'עדיין אין סוכנים.',
    round: 'סבב',
    failed: 'שגיאה',
    after: 'אחרי',
    tokensWord: 'טוקנים',
    agentsCount: 'סוכנים',
    isRunning: 'פועל',
    isFinished: 'הסתיים',
    isPlanned: 'מתוכנן',
    opened: 'חלונית הסוכנים נפתחה.',
    closed: 'חלונית הסוכנים נסגרה.',
    done: 'הושלם',
    plan: 'תכנון',
    design: 'עיצוב',
    tasks: 'משימות',
    review: 'בדיקה',
    busy: 'בעבודה',
    ctx: 'הקשר',
    tier: { light: 'קל', medium: 'בינוני', careful: 'זהיר', heavy: 'כבד', fable: 'פייבל', other: 'אחר' },
    effort: { low: 'נמוך', medium: 'בינוני', high: 'גבוה', xhigh: 'גבוה מאוד', max: 'מקסימלי' },
  },
} as const

// Module scope is fine here: session.start sets it again on every (re)load.
let lang: Lang = 'en'
const tr = () => STRINGS[lang]

// Hebrew draws every row mirrored: crab and title on the right, numbers on the left.
const isRtl = () => lang === 'he'

// Tier and effort words as shown; anything unknown shows as it came.
const tierWord = (tier: string): string => (tr().tier as Record<string, string>)[tier] ?? tier
const effortWord = (effort: string): string => (tr().effort as Record<string, string>)[effort] ?? effort

const isRussian = (v: unknown): boolean => typeof v === 'string' && /^(ru|russian|рус)/i.test(v.trim())
const isHebrew = (v: unknown): boolean => typeof v === 'string' && /^(he|iw|hebrew|עברית)/i.test(v.trim())
const langOf = (v: unknown): Lang => (isHebrew(v) ? 'he' : isRussian(v) ? 'ru' : 'en')

async function detectLang($: EngineInterface, option: unknown): Promise<Lang> {
  if (option === 'en' || option === 'ru' || option === 'he') return option
  try {
    const settings = (await $.settings.read()) as Record<string, unknown>
    if (typeof settings.language === 'string' && settings.language.trim()) return langOf(settings.language)
  } catch {
    // No settings: fall through to the locale.
  }
  const locale = (await $.env.get('LC_ALL')) || (await $.env.get('LC_MESSAGES')) || (await $.env.get('LANG'))
  return langOf(locale)
}

const blank = (): Flow => ({
  title: 'savvy-flow',
  total: 0,
  done: 0,
  running: 0,
  phase: 'plan',
  isFinished: false,
  tasks: [],
})

const isNewFlow = (prev: Flow | null, input: ProgressInput): boolean =>
  !prev || prev.isFinished || (input.title !== undefined && clip(input.title.trim(), MAX_TITLE) !== prev.title)

// Only a known tier is kept: the name is later a key into the tier tables.
const tierName = (v: string): string => {
  const t = v.replace(/^savvy-/, '').trim().toLowerCase()
  return TIERS.includes(t) ? t : ''
}

const cleanTasks = (tasks: ProgressInput['tasks']): PlannedTask[] | undefined =>
  tasks
    ?.filter(t => t.title?.trim())
    .slice(0, MAX_TASKS)
    .map(t => ({
      title: (t.title ?? '').trim(),
      tier: tierName(t.tier ?? ''),
      after: (t.after ?? []).filter(n => Number.isInteger(n) && n > 0).slice(0, MAX_AFTER),
    }))

const merge = (prev: Flow | null, input: ProgressInput): Flow => {
  // A new title means a new flow: never carry counters over from an earlier one.
  const base = isNewFlow(prev, input) || !prev ? blank() : { ...blank(), ...prev }
  const tasks = cleanTasks(input.tasks) ?? base.tasks
  const total = Math.min(MAX_TASKS, Math.max(0, Math.round(input.total ?? (input.tasks ? tasks.length : base.total))))
  const done = Math.min(total || Infinity, Math.max(0, Math.round(input.done ?? base.done)))
  const phase = input.phase && PHASES.includes(input.phase) ? input.phase : base.phase
  return {
    ...base,
    title: clip(input.title?.trim() || base.title, MAX_TITLE),
    total,
    done,
    phase: input.finished ? 'close' : phase,
    isFinished: input.finished === true,
    tasks,
  }
}

const label = (f: Flow): string => {
  const s = tr()
  if (f.isFinished) return s.done
  if (f.phase === 'plan') return s.plan
  if (f.phase === 'design') return s.design
  const count = f.total ? `${f.done}/${f.total}` : `${f.running} ${s.busy}`
  return `${f.phase === 'review' ? s.review : s.tasks} ${count}`
}

const ratio = (f: Flow): number => (f.isFinished ? 1 : f.total ? f.done / f.total : 0)

// Deterministic noise so the dither does not shimmer between redraws.
const noise = (x: number, y: number): number => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

// The whole row is one SVG: the desktop wraps sibling elements onto new lines,
// so title, bar, percent and the crab live in one drawing; only the count and
// the dismiss are Buttons beside it.
const H = 22
const BAR_H = 16
const CRAB_W = 26
// The crab's drawing grid is 30 units wide, props included.
const CRAB_BOX = 30
const CELL = 3
const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"

const xml = (s: string): string =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

const clip = (s: string, max: number): string => (s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s)

// CJK, fullwidth forms and emoji advance about 1em; at 0.56em a Chinese title was sized at half its width and the bar drew over it.
// 中日韩文字、全角标点和 emoji 约占 1em；按 0.56em 算时中文标题宽度被低估近一半，进度条会压到标题上。
const WIDE =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA960-\uA97F\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF01-\uFF60\uFFE0-\uFFE6\u{1F300}-\u{1FAFF}\u{20000}-\u{3FFFD}]/u

// Rough advance of system UI text, in em; good enough to size the title's slot.
const charEm = (ch: string): number =>
  WIDE.test(ch) ? 1 : /[\s.,:;'|!il1()[\]]/.test(ch) ? 0.3 : /[A-ZА-ЯЁmwшщжюМШЩЖЮ@%]/.test(ch) ? 0.72 : 0.56

const textWidth = (s: string, size: number): number => [...s].reduce((w, ch) => w + charEm(ch) * size, 0)

// Cuts `s` to fit `maxW` pixels, with an ellipsis when it had to cut.
const fitText = (s: string, size: number, maxW: number): string => {
  if (textWidth(s, size) <= maxW) return s
  let out = ''
  for (const ch of s) {
    if (textWidth(out + ch + '…', size) > maxW) break
    out += ch
  }
  return out + '…'
}

// The savvy pixel bar, shared by the band's rows and the Map's cards: a dithered fill,
// sparse at the start and dense toward the head, a faint layer for work handed out,
// ticks between tasks, and a pill with the count riding the head. Pixels twinkle in
// four out-of-phase groups; a calm bar (finished) settles to a slow glow.
const BAR_CSS = (isCalm: boolean): string => `<style>
.t{fill:#1f1f1f}.m{fill:#8a8a8a}.k{fill:#e4e4e2}.tk{fill:#b4b4b0}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.m{fill:#9a9a9a}.k{fill:#2c2c2c}.tk{fill:#5a5a5a}}
.t0,.t1,.t2,.t3{animation:tw ${isCalm ? 3.2 : 2.2}s ease-in-out infinite}
.t1{animation-duration:${isCalm ? 3.8 : 2.8}s;animation-delay:-.7s}.t2{animation-duration:${isCalm ? 4.4 : 1.9}s;animation-delay:-1.3s}.t3{animation-duration:${isCalm ? 3.5 : 3.3}s;animation-delay:-.4s}
@keyframes tw{0%,100%{opacity:1}50%{opacity:${isCalm ? 0.8 : 0.3}}}
@media (prefers-reduced-motion: reduce){.t0,.t1,.t2,.t3{animation:none}}
</style>`

type BarOptions = { run?: number; ticks?: number; rtl?: boolean }

// One bar, drawn at (0, 0) and BAR_W by barH: place it with a translate. `id` keeps its
// clip path its own, since several bars share one drawing.
export const barGroup = (id: string, BAR_W: number, barH: number, fill: number, color: string, pill: string, o: BarOptions = {}): string => {
  const ratioOf = (r: number) => Math.max(0, Math.min(1, r))
  const fillW = Math.round(BAR_W * ratioOf(fill))
  const runW = Math.round(BAR_W * ratioOf(o.run ?? 0))
  const bx = (x: number, w: number): number => (o.rtl ? BAR_W - x - w : x)
  const cols = Math.floor(fillW / CELL)
  const rows = Math.floor(barH / CELL)
  const dots: string[] = []
  for (let c = 0; c < cols; c++) {
    const density = 0.35 + 0.6 * Math.pow(c / Math.max(1, cols), 1.2)
    for (let r = 0; r < rows; r++) {
      if (noise(c, r) < density) dots.push(`<rect class="t${Math.floor(noise(r, c) * 4)}" x="${bx(c * CELL + 1, 2)}" y="${r * CELL + 1}" width="2" height="2"/>`)
    }
  }
  const faint: string[] = []
  for (let c = cols; c < Math.floor(runW / CELL); c++) {
    for (let r = 0; r < rows; r++) {
      if (noise(c + 7, r + 3) < 0.2) faint.push(`<rect class="t${Math.floor(noise(r + 5, c) * 4)}" x="${bx(c * CELL + 1, 1.7)}" y="${r * CELL + 1}" width="1.7" height="1.7"/>`)
    }
  }
  const ticks: string[] = []
  for (let i = 1; i < (o.ticks ?? 0); i++) {
    const x = Math.round((BAR_W * i) / (o.ticks ?? 1))
    if (x > fillW + 4) ticks.push(`<rect x="${bx(x, 1.5)}" y="${barH / 2 - 4}" width="1.5" height="8" rx="0.75"/>`)
  }
  const pillW = pill ? Math.round(18 + pill.length * 6.6) : 0
  const pillX = bx(Math.max(0, Math.min(BAR_W - pillW, fillW - pillW)), pillW)
  const clip = `c-${id.replace(/[^\w-]/g, '')}`
  return `<defs><clipPath id="${clip}"><rect x="0" y="0" width="${BAR_W}" height="${barH}" rx="${barH / 2}"/></clipPath></defs>
<rect class="k" width="${BAR_W}" height="${barH}" rx="${barH / 2}"/>
<g clip-path="url(#${clip})">
<g fill="${color}">${dots.join('')}</g>
<g fill="${color}" opacity="0.45">${faint.join('')}</g>
<g class="tk">${ticks.join('')}</g>
</g>${
    pill
      ? `
<rect x="${pillX}" width="${pillW}" height="${barH}" rx="${barH / 2}" fill="${color}"/>
<text x="${pillX + pillW / 2}" y="${barH / 2 + 4}" text-anchor="middle"${o.rtl ? ' direction="rtl"' : ''} font-family="${FONT}" font-size="11" font-weight="600" fill="#ffffff">${xml(pill)}</text>`
      : ''
  }`
}

const rowSvg = (f: Flow, W: number, isWorking: boolean): string => {
  // The title takes what it needs, up to 40% of the row; the bar takes the rest.
  const title = fitText(f.title, 13, Math.max(60, W * 0.4))
  const BAR_X = Math.round(16 + textWidth(title, 13) + 12)
  const BAR_W = Math.max(60, W - BAR_X - 46 - CRAB_W)
  const color = f.isFinished ? DONE : ACCENT
  const y0 = (H - BAR_H) / 2
  const run = f.total ? Math.min(f.total, f.done + f.running) / f.total : 0
  // Positions are worked out left to right; right to left mirrors each box across
  // the row (`rx`) and the bar inside itself. Text is never mirrored.
  const rtl = isRtl()
  const rx = (x: number, w: number): number => (rtl ? W - x - w : x)
  const percent = `${Math.round(ratio(f) * 100)}%`
  // `direction="rtl"` puts Hebrew words and numbers in reading order; `start` is then the right edge.
  const titleAt = rtl ? `x="${W - 16}" direction="rtl" text-anchor="start"` : 'x="16"'
  const percentAt = rtl ? `x="${CRAB_W + 6}" y="${H / 2 + 4.5}"` : `x="${W - CRAB_W - 6}" y="${H / 2 + 4.5}" text-anchor="end"`
  const crabW = CRAB_BOX * 0.8
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${BAR_CSS(f.isFinished)}
<circle cx="${rtl ? W - 5 : 5}" cy="${H / 2}" r="4" fill="${color}"/>
<text class="t" ${titleAt} y="${H / 2 + 4.5}" font-family="${FONT}" font-size="13" font-weight="500">${xml(title)}</text>
<g transform="translate(${rx(BAR_X, BAR_W)},${y0})">${barGroup('flow', BAR_W, BAR_H, ratio(f), color, label(f), { run, ticks: f.total, rtl })}</g>
<text class="m" ${percentAt} font-family="${FONT}" font-size="12.5" font-variant-numeric="tabular-nums">${percent}</text>
${CRAB_CSS}${crab(rx(W - CRAB_W + 1, crabW), 0, 'king', false, isWorking, 0.8, rtl)}
</svg>`
}

// The band's USAGE row, laid out as the FLOW row is: the plan windows ribbon reads
// (7-day, 5-hour) share the row's width, each a pixel bar of what is left.
const USAGE_COLOR: Record<string, string> = { seven_day: '#D97757', five_hour: '#E0B34A' }
const LOW = '#D0453F'
const windowName = (kind: string): string => (kind === 'seven_day' ? '7D' : kind === 'five_hour' ? '5H' : kind.replace(/_/g, ' ').toUpperCase().slice(0, 6))
export const resetIn = (iso: string | undefined, at: number): string => {
  const ms = iso ? Date.parse(iso) - at : NaN
  if (Number.isNaN(ms)) return ''
  if (ms <= 0) return 'now'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  return h < 24 ? `${h}h ${mins % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`
}
export const usageSvg = (ws: readonly UsageWindow[], W: number, at: number): string => {
  const right = W - CRAB_W - 6
  const GAP = 18
  const seg = (right - 16 - GAP * (ws.length - 1)) / Math.max(1, ws.length)
  const body = ws.map((w, i) => {
    const left = Math.max(0, Math.min(100, Math.round(100 - w.percentUsed)))
    const color = left < 20 ? LOW : (USAGE_COLOR[w.kind] ?? ACCENT)
    const x = 16 + i * (seg + GAP)
    const name = windowName(w.kind)
    const reset = resetIn(w.resetsAt, at)
    const nameW = Math.round(textWidth(name, 12) + 8)
    const resetW = reset ? Math.round(textWidth(reset, 11) + 8) : 0
    const barW = Math.max(40, seg - nameW - resetW)
    return `<text class="m" x="${x}" y="${H / 2 + 4.5}" font-family="${FONT}" font-size="12" font-weight="600">${name}</text>
<g transform="translate(${x + nameW},${(H - BAR_H) / 2})">${barGroup(`u-${w.kind}`, barW, BAR_H, left / 100, color, `${left}%`)}</g>
${reset ? `<text class="m" x="${x + seg}" y="${H / 2 + 4.5}" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${reset}</text>` : ''}`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${BAR_CSS(false)}
<circle cx="5" cy="${H / 2}" r="4" fill="#8a8a8a" class="m"/>
${body.join('')}
</svg>`
}

// The band above the prompt, in the panel's look: one card holding the FLOW row (the
// savvy-flow plan) and the USAGE row (ribbon's plan windows), each bar filling its row.
// ribbon and ponytail draw their own rows beneath this one; once they ran (next.trace)
// this band stands in for them, so their rows are dropped.
const BAND_PAD = 8
const BAND_GAP = 6
const BAND_CSS = `<style>.tile{fill:#f4f3f0}.ln{stroke:#e4e4e1}
@media (prefers-color-scheme: dark){.tile{fill:#262625}.ln{stroke:#333331}}</style>`
export const bandHeight = (rows: number): number => BAND_PAD * 2 + rows * H + (rows - 1) * BAND_GAP
export const bandSvg = (W: number, rows: readonly string[]): string => {
  const BH = bandHeight(rows.length)
  const inner = rows.map((r, i) => `<svg x="${BAND_PAD}" y="${BAND_PAD + i * (H + BAND_GAP)}" width="${W - BAND_PAD * 2}" height="${H}" overflow="visible">${r.replace(/^<svg[^>]*>|<\/svg>\s*$/g, '')}</svg>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${BH}" viewBox="0 0 ${W} ${BH}">${BAND_CSS}
<rect class="tile ln" x="0.5" y="0.5" width="${W - 1}" height="${BH - 1}" rx="10" stroke-width="1"/>
${inner.join('\n')}
</svg>`
}

// The terminal's bar: savvy-progress's block bar.
const blocks = (r: number, cells: number): string => {
  const n = Math.max(0, Math.min(cells, Math.round(r * cells)))
  return '█'.repeat(n) + '░'.repeat(cells - n)
}

const barText = (f: Flow, width: number): string => {
  const filled = Math.round(width * ratio(f))
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}

// ---------------------------------------------------------------------------
// Agents panel: every subagent of the session, plus the tasks the flow planned.

const TIER_COLOR: Record<string, string> = {
  fable: '#7F77DD',
  heavy: '#D85A30',
  careful: '#BA7517',
  medium: '#378ADD',
  light: '#1D9E75',
  other: '#888780',
}

// What each savvy tier runs on, for planned tasks that have no run yet.
const colorOf = (tier: string): string => TIER_COLOR[tier] ?? '#888780'

const TIER_MODEL: Record<string, [model: string, effort: string]> = {
  fable: ['Fable', 'high'],
  heavy: ['Opus', 'xhigh'],
  careful: ['Opus', 'high'],
  medium: ['Opus', 'medium'],
  light: ['Opus', 'low'],
}

// "Opus · xhigh", with the effort word in the panel's language; '' for an unknown tier.
const tierModel = (tier: string): string => {
  const m = TIER_MODEL[tier]
  return m ? `${m[0]} · ${effortWord(m[1])}` : ''
}

// "Opus 5.5 · low" for a run, or just the model when no effort was seen.
const runModel = (a: AgentRun): string => (a.effort ? `${modelName(a.model)} · ${effortWord(a.effort)}` : modelName(a.model))

// USD per million tokens: input, output, cache read, cache write. The first row that
// matches a model id wins, so a release sits above its family.
// The engine reports tokens, not money, so the panel's cost is an estimate. It reports
// one cache-write count with no split by lifetime; writes are priced at the 1-hour
// rate (2x input), which is what Claude Code writes on a subscription.
type Price = [input: number, output: number, cacheRead: number, cacheWrite: number]

const PRICES: [RegExp, Price][] = [
  [/(fable|mythos)-5-1/, [10, 50, 0.25, 20]],
  [/fable|mythos/, [10, 50, 1, 20]],
  [/opus-5-5/, [4, 20, 0.2, 8]],
  [/opus/, [5, 25, 0.5, 10]],
  [/sonnet-5-5/, [2, 10, 0.1, 4]],
  [/sonnet-5/, [2, 10, 0.2, 4]],
  [/sonnet/, [3, 15, 0.3, 6]],
  [/haiku-5-5/, [0.1, 0.5, 0.01, 0.2]],
  [/haiku/, [1, 5, 0.1, 2]],
]

// Haiku 5.5 is priced by prompt length: a request whose prompt (input, cache reads and
// cache writes together) is over 100,000 tokens pays these prices instead.
const HAIKU_LONG_PROMPT = 100_000
const HAIKU_LONG: Price = [0.5, 2.5, 0.05, 1]

type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

const priceOf = (model: string, prompt: number): Price => {
  const id = model.toLowerCase()
  if (prompt > HAIKU_LONG_PROMPT && /haiku-5-5/.test(id)) return HAIKU_LONG
  return PRICES.find(([re]) => re.test(id))?.[1] ?? [4, 20, 0.2, 8]
}

// `isRequest` says the usage is one model request, which is what a prompt-length price
// is set by; a turn's sum is priced at the model's ordinary prices.
const costOf = (model: string, u: Usage, isRequest: boolean): number => {
  const prompt = isRequest ? (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) : 0
  const [i, o, r, w] = priceOf(model, prompt)
  return (
    ((u.input_tokens || 0) * i +
      (u.output_tokens || 0) * o +
      (u.cache_read_input_tokens || 0) * r +
      (u.cache_creation_input_tokens || 0) * w) /
    1e6
  )
}

// Haiku 4.5 and the Claude 3 models have a 200K window; the rest, Haiku 5.5 included, 1M.
const windowOf = (model: string): number => (/haiku-4|claude-3/i.test(model) ? 200_000 : 1_000_000)

// `savvy-careful`, or `savvy-flow:savvy-careful` when the agents ship in a plugin.
const tierOf = (type: string): string => {
  const bare = type.replace(/^[^:]*:/, '')
  const t = bare.replace(/^savvy-/, '').toLowerCase()
  return Object.hasOwn(TIER_COLOR, t) && bare.startsWith('savvy-') ? t : 'other'
}

const modelName = (id: string): string => {
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id)
  const [, family = '', major = '', minor] = m ?? []
  if (!family) return id.replace(/^claude-/, '').replace(/\[.*\]$/, '') || '—'
  return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? '.' + minor : ''}`
}

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

const fmtTokens = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`

const fmtCost = (usd: number): string => `$${usd < 10 ? usd.toFixed(2) : usd.toFixed(1)}`

const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const elapsed = (a: AgentRun, at: number): number => (a.endedAt ?? Math.max(at, a.startedAt)) - a.startedAt

type Planned = PlannedTask & { n: number }

const plannedOf = (f: Flow | null, list: AgentRun[]): Planned[] => {
  if (!f || f.isFinished) return []
  const started = new Set(list.map(a => norm(a.description)))
  return (f.tasks ?? []).map((t, i) => ({ ...t, n: i + 1 })).filter(t => !started.has(norm(t.title)))
}

const totals = (list: AgentRun[], at: number) => {
  const cost = list.reduce((s, a) => s + a.costUsd, 0)
  const tokens = list.reduce((s, a) => s + a.tokens, 0)
  const start = Math.min(...list.map(a => a.startedAt))
  const end = Math.max(...list.map(a => a.endedAt ?? Math.max(at, a.startedAt)))
  return { cost, tokens, time: list.length ? end - start : 0 }
}

// --- desktop drawings: each row is one SVG, as the band above the prompt is.

// The pane's backdrop: a dotted grid as tall as the content laid over it; the
// row SVGs are transparent, so it shows through between their marks.
const GRID_STEP = 16
// A Text or Button row on the desktop is about 20px; the grid errs taller.
const LINE_H = 24
// The engine refuses an Svg taller than 4096px, so a long grid is stacked from
// tiles of at most this height; a multiple of GRID_STEP keeps the dots aligned.
const GRID_TILE = 4096
const gridTiles = (H: number) => Array.from({ length: Math.ceil(H / GRID_TILE) }, (_, i) => Math.min(GRID_TILE, H - i * GRID_TILE))
const gridSvg = (W: number, H: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>.d{fill:#d9d8d4}@media (prefers-color-scheme: dark){.d{fill:#3a3a38}}</style>
<defs><pattern id="g" width="${GRID_STEP}" height="${GRID_STEP}" patternUnits="userSpaceOnUse"><circle class="d" cx="${GRID_STEP / 2}" cy="${GRID_STEP / 2}" r="1"/></pattern></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
</svg>`

const PANE_CSS = `<style>
.t{fill:#1f1f1f}.s{fill:#6b6b68}.m{fill:#9a9a96}.k{fill:#ecebe8}.ln{stroke:#e4e4e1}.tile{fill:#f4f3f0}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#a8a8a4}.m{fill:#7d7d79}.k{fill:#2c2c2b}.ln{stroke:#333331}.tile{fill:#262625}}
.live{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.3}}
@media (prefers-reduced-motion: reduce){.live{animation:none}}
</style>`

// Pixel Clawd from DockCrab (Clawdy): a 24×18 crab on a 30×28 grid, one costume per tier.
// The body keeps the brand clay; the tier's color lives in the costume's accent.
const CLAY = '#D97757'
const INK = '#1F1E1D'

// `cls` puts a pixel in a named group: `bd` (the default) is the body and its
// costume, `la`/`lb` the leg pairs, anything else a prop with its own motion.
type Fill = (x: number, y: number, w: number, h: number, c: string, cls?: string) => void

const stamp = (f: Fill, x: number, y: number, rows: string[], map: Record<string, string>, cls?: string): void =>
  rows.forEach((row, dy) => [...row].forEach((ch, dx) => map[ch] && f(x + dx, y + dy, 1, 1, map[ch] ?? '', cls)))

// `armCls` lets a raised claw travel with the prop it holds.
const crabBody = (f: Fill, armFront = 0, armCls?: string): void => {
  f(7, 10, 16, 12, CLAY)
  f(3, 14, 4, 4, CLAY)
  f(23, 14 + armFront, 4, 4, CLAY, armCls)
  f(9, 12, 2, 2, INK)
  f(19, 12, 2, 2, INK)
  f(7, 22, 2, 4, CLAY, 'la')
  f(17, 22, 2, 4, CLAY, 'la')
  f(11, 22, 2, 4, CLAY, 'lb')
  f(21, 22, 2, 4, CLAY, 'lb')
}

// Pure CSS, run by the compositor: no redraws. Periods divide one second, so the
// once-a-second redraw of a running row restarts them in phase. Every crab walks;
// each costume adds its prop's own motion on top.
const CRAB_CSS = `<style>
.run .la{animation:st .5s steps(1) infinite}.run .lb{animation:st .5s steps(1) infinite -.25s}
.run .bd{animation:bob .5s steps(1) infinite -.125s}
.run g{transform-box:fill-box}
@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}
.c-fable.run{animation:float 1s ease-in-out infinite}
.c-fable.run .la,.c-fable.run .lb,.c-fable.run .bd{animation:none}
.c-fable.run .ant{animation:blink 1s steps(1) infinite}
.c-fable.run .star{animation:blink .5s steps(1) infinite -.25s}
@keyframes float{50%{transform:translateY(-2px)}}@keyframes blink{50%{opacity:.15}}
.c-heavy.run .it{animation:scan 1s steps(1) infinite}
.c-heavy.run .gl{animation:blink 1s steps(1) infinite -.5s}
@keyframes scan{25%{transform:translate(-1px,1px)}50%{transform:translate(-2px,2px)}75%{transform:translate(-1px,1px)}}
.c-careful.run .it{transform-origin:100% 100%;animation:twist .5s ease-in-out infinite}
@keyframes twist{50%{transform:rotate(-35deg)}}
.c-medium.run .pan{transform-origin:0 50%;animation:tilt 1s ease-in-out infinite}
.c-medium.run .egg{animation:flip 1s ease-in-out infinite}
@keyframes tilt{20%,40%{transform:rotate(-12deg)}}@keyframes flip{30%{transform:translateY(-5px) scaleY(-1)}60%{transform:translateY(0)}}
.c-light.run .la{animation-duration:.25s}.c-light.run .lb{animation-duration:.25s;animation-delay:-.125s}
.c-light.run .flag{transform-origin:0 50%;animation:wave .25s steps(1) infinite}
@keyframes wave{50%{transform:skewY(-12deg) scaleX(.85)}}
.c-explore.run .it{transform-origin:50% 100%;animation:fence .5s ease-in-out infinite}
@keyframes fence{50%{transform:rotate(25deg)}}
.c-king.run .gem{animation:blink 1s steps(1) infinite}
@media (prefers-reduced-motion: reduce){.run,.run g{animation:none!important}}
</style>`

const COSTUMES: Record<string, (f: Fill, t: string) => void> = {
  // King: the main session, in a gold crown; its gems glint while it works.
  king: f => {
    crabBody(f)
    stamp(f, 8, 5, ['g....g....g....', 'gg..ggg..ggg.gg', 'ggggggggggggggg', 'ggrgggbgggggrgg', 'ddddddddddddddd'], { g: '#F5C542', d: '#C99A1E', r: '#D0453F', b: '#5B8DEF' })
    f(8, 5, 1, 1, '#FBE08A', 'gem'); f(13, 5, 1, 1, '#FBE08A', 'gem'); f(18, 5, 1, 1, '#FBE08A', 'gem')
  },
  // Fable: astronaut in a glass dome; floats instead of walking, the antenna and the star blink.
  fable: (f, t) => {
    crabBody(f)
    f(6, 7, 18, 1, '#E6E8EE'); f(5, 8, 1, 14, '#E6E8EE'); f(24, 8, 1, 14, '#E6E8EE'); f(6, 22, 18, 1, '#C9CCD2')
    f(6, 8, 18, 14, 'rgba(169,214,245,.32)'); f(8, 9, 2, 1, '#fff'); f(8, 10, 1, 2, '#fff')
    f(14, 4, 2, 3, '#C9CCD2'); f(14, 2, 2, 2, t, 'ant'); f(13, 18, 4, 2, t)
    f(27, 3, 1, 3, '#F5C542', 'star'); f(26, 4, 3, 1, '#F5C542', 'star')
  },
  // Heavy: detective with a deerstalker; the magnifier sweeps and glints.
  heavy: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 6, 3, ['......bbbbbb......', '....bbcbbcbbbb....', '...bbbbbbbbbbbb...', '..bcbbcbbcbbcbbb..', '.bbbbbbbbbbbbbbbb.', 'dddddddddddddddddd'], { b: '#7A4A26', c: '#A0703F', d: '#5A3519' })
    f(6, 9, 18, 1, t)
    stamp(f, 23, 1, ['.kkk.', 'k...k', 'k...k', 'k...k', '.kkk.'], { k: '#3A3A3C' }, 'it')
    f(24, 2, 3, 3, 'rgba(169,214,245,.7)', 'it'); f(25, 6, 1, 4, '#7A4A26', 'it'); f(24, 2, 1, 1, '#fff', 'gl')
  },
  // Careful: engineer in a hard hat; the wrench turns a bolt.
  careful: (f, t) => {
    crabBody(f)
    stamp(f, 6, 4, ['.....yyyyyyyy.....', '...yyyyyhhyyyyy...', '..yyyyyyhhyyyyyy..', '..yyyyyyhhyyyyyy..', '.yyyyyyyhhyyyyyyy.', 'dddddddddddddddddd'], { y: '#F5C542', h: '#FBE08A', d: '#C99A1E' })
    f(13, 5, 4, 2, t)
    stamp(f, 0, 10, ['.s.s', 'sss.', '.s..', '.s..'], { s: '#8E929A' }, 'it')
  },
  // Medium: chef, the toque traced from DockCrab's Sprites.chefHat; tosses the omelette.
  medium: (f, t) => {
    crabBody(f, -4, 'pan')
    stamp(f, 6, 0, ['........lll.......', '.......lllll......', '.wwwwgwwwwwwgwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwgwwwwwggwwwww', '.wwwwgwwwwwggwwwww', '.dddbbbbbbbbbbbbb.', '.dddbbbbbbbbbbbbb.', '.dddbbbbbbbbbbbbb.'], { w: '#F4F3EE', l: '#F7F6F2', g: '#D2D1C8', b: t, d: '#B45F43' })
    f(22, 8, 7, 2, '#4A4A48', 'pan'); f(26, 10, 1, 1, '#4A4A48', 'pan'); f(24, 7, 3, 1, '#F5B731', 'egg')
  },
  // Light: racer in a helmet; runs at double pace, the checkered flag flutters.
  light: (f, t) => {
    crabBody(f, -4)
    stamp(f, 6, 5, ['....rrrrrrrrrr....', '..rrrrrrwwrrrrrr..', '.rrrrrrrwwrrrrrrr.', '.rrrrrrrwwrrrrrrr.', '.rrrrrrrwwrrrrrrr.', '.kkkkkkkkkkkkkkkkr'], { r: t, w: '#F8F6F1', k: INK })
    f(25, 1, 1, 9, '#8E929A')
    stamp(f, 26, 1, ['wkwk', 'kwkw', 'wkwk'], { w: '#F8F6F1', k: INK }, 'flag')
  },
  // Explore: pirate scouting the code; the cutlass fences.
  explore: f => {
    crabBody(f)
    stamp(f, 5, 3, ['.kk..............kk.', '.kkk....kkkk....kkk.', '..kkkkkkkwwkkkkkkk..', '..kkkkkkkkkkkkkkkk..', '.gggggggggggggggggg.'], { k: '#55514C', w: '#F8F6F1', g: '#F5C542' })
    f(7, 11, 11, 1, INK); f(18, 11, 4, 3, INK)
    f(27, 6, 1, 9, '#C9CCD2', 'it'); f(26, 15, 3, 1, '#7A4A26', 'it')
  },
  other: f => crabBody(f),
}

// A costume by task first, then by model. A savvy worker keeps its tier's. A searcher or Explore is
// the pirate, an editor the engineer, a reviewer the detective; any other agent dresses for the
// task its description names, else for the model it runs on (Fable astronaut, Opus engineer,
// Sonnet chef, Haiku racer).
const costumeOf = (a: AgentRun): string => {
  const tier = tierOf(a.type)
  if (tier !== 'other') return tier
  const bare = a.type.replace(/^[^:]*:/, '').toLowerCase()
  if (bare === 'explore' || bare === 'searcher') return 'explore'
  if (bare === 'reviewer') return 'heavy'
  if (bare === 'editor') return 'careful'
  const task = `${bare} ${a.description}`.toLowerCase()
  if (/\b(search|locat|explor|scout|find)/.test(task)) return 'explore'
  if (/\b(review|audit|council|critic|verif)/.test(task)) return 'heavy'
  if (/\b(edit|fix|implement|build|refactor|rename|patch)/.test(task)) return 'careful'
  const m = a.model.toLowerCase()
  if (/fable|mythos/.test(m)) return 'fable'
  if (/opus/.test(m)) return 'careful'
  if (/sonnet/.test(m)) return 'medium'
  if (/haiku/.test(m)) return 'light'
  return 'other'
}

const CRAB_SCALE = 1.1

// Body and props nest inside `bd` so a prop rides the bob and adds its own motion;
// legs stay outside it and step on their own. `mirror` flips the crab inside its
// own box (x .. x + CRAB_BOX * scale) so it faces left.
// `tint` recolours the body: background tasks are smaller crabs in their own colour.
const crab = (x: number, y: number, costume: string, dim = false, isWalking = false, scale = CRAB_SCALE, mirror = false, tint?: string): string => {
  const groups = new Map<string, string[]>([['bd', []]])
  const f: Fill = (cx, cy, w, h, c, cls = 'bd') => {
    if (!groups.has(cls)) groups.set(cls, [])
    groups.get(cls)?.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${c}"/>`)
  }
  const draw = COSTUMES[costume] ?? ((g: Fill) => crabBody(g))
  draw(f, colorOf(costume))
  const group = (cls: string) => `<g class="${cls}">${(groups.get(cls) ?? []).join('')}</g>`
  const props = [...groups.keys()].filter(k => k !== 'bd' && k !== 'la' && k !== 'lb')
  const body = `<g class="bd">${(groups.get('bd') ?? []).join('')}${props.map(group).join('')}</g>`
  const place = mirror ? `translate(${x + CRAB_BOX * scale},${y}) scale(${-scale},${scale})` : `translate(${x},${y}) scale(${scale})`
  const out = `<g transform="${place}" opacity="${dim ? 0.45 : 1}" shape-rendering="crispEdges"><g class="c-${costume}${isWalking ? ' run' : ''}">${body}${group('la')}${group('lb')}</g></g>`
  return tint ? out.replaceAll(`fill="${CLAY}"`, `fill="${tint}"`) : out
}

const statusMark = (x: number, y: number, status: string, color: string): string => {
  if (status === 'running') return `<circle class="live" cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`
  if (status === 'done') return `<path d="M${x - 5} ${y}l3.5 3.5 6.5-7" fill="none" stroke="#3B9C5F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  if (status === 'failed') return `<path d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" stroke="#D0453F" stroke-width="1.8" stroke-linecap="round"/>`
  return `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#9a9a96" stroke-width="1.4"/><path d="M${x} ${y - 2.5}v2.8l1.8 1.2" fill="none" stroke="#9a9a96" stroke-width="1.4" stroke-linecap="round"/>`
}

// Panel rows are laid out left to right; in Hebrew each box mirrors across the
// row (`mx`) and text hugs the mirrored side. `words` text may hold Hebrew and
// takes `direction="rtl"` (whose `start` is the right edge); numbers stay
// left to right so "≈$0.25" keeps its order.
const mx = (W: number, x: number, w = 0): number => (isRtl() ? W - x - w : x)

// Text that starts at x: left-aligned, or right-aligned at the mirrored x.
const startText = (W: number, x: number, y: number, words = true): string =>
  !isRtl()
    ? `x="${x}" y="${y}"`
    : `x="${W - x}" y="${y}"${words ? ' direction="rtl" text-anchor="start"' : ' text-anchor="end"'}`

// Text that ends at x: right-aligned, or left-aligned at the mirrored x.
const endText = (W: number, x: number, y: number, words = false): string =>
  !isRtl() ? `x="${x}" y="${y}" text-anchor="end"` : `x="${W - x}" y="${y}"${words ? ' direction="rtl" text-anchor="end"' : ''}`

const crabWidth = (scale: number): number => Math.round(CRAB_BOX * scale * 100) / 100

// A panel crab at x in a row of width W: on the mirrored side and facing left in Hebrew.
const rowCrab = (W: number, x: number, y: number, costume: string, dim = false, isWalking = false): string =>
  crab(mx(W, x, crabWidth(CRAB_SCALE)), y, costume, dim, isWalking, CRAB_SCALE, isRtl())

const svg = (W: number, H: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${PANE_CSS}${CRAB_CSS}${body}</svg>`

// The pane's own title already says "Agents": the header names the flow, if any.
const headerSvg = (W: number, title: string, t: ReturnType<typeof totals>): string => {
  const s = tr()
  const gap = 6
  const tw = (W - gap * 2) / 3
  const top = title ? 28 : 0
  const tile = (i: number, k: string, v: string) =>
    `<rect class="tile" x="${mx(W, i * (tw + gap), tw)}" y="${top}" width="${tw}" height="40" rx="8"/>
<text class="s" ${startText(W, i * (tw + gap) + 9, top + 16)} font-family="${FONT}" font-size="11">${k}</text>
<text class="t" ${startText(W, i * (tw + gap) + 9, top + 33, false)} font-family="${FONT}" font-size="15" font-weight="600" font-variant-numeric="tabular-nums">${v}</text>`
  return svg(
    W,
    headerHeight(title),
    `${title ? `<text class="t" ${startText(W, 0, 15)} font-family="${FONT}" font-size="14" font-weight="600">${xml(fitText(title, 14, W))}</text>` : ''}
${tile(0, s.cost, '≈' + fmtCost(t.cost))}${tile(1, s.tokens, fmtTokens(t.tokens))}${tile(2, s.time, fmtTime(t.time))}`,
  )
}

const headerHeight = (title: string): number => (title ? 72 : 44)

// The task's own progress when the worker reports steps; a finished run is full.
const progressOf = (a: AgentRun): number | null => {
  if (a.status === 'done') return 1
  if (a.stepTotal) return Math.min(1, (a.stepDone ?? 0) / a.stepTotal)
  return null
}

const ctxOf = (a: AgentRun): number => (a.contextMax ? Math.min(100, Math.round((a.contextTokens / a.contextMax) * 100)) : 0)

const agentSvg = (W: number, a: AgentRun, at: number): string => {
  const s = tr()
  const tier = tierOf(a.type)
  const color = colorOf(tier)
  const ctx = ctxOf(a)
  const textW = W - 42 - 22
  const meta = [runModel(a)]
  if (a.round > 1) meta.push(`${s.round} ${a.round}`)
  if (a.status === 'failed') meta.push(s.failed)
  const barW = textW
  const progress = progressOf(a)
  const stats = `${s.ctx} ${ctx}% · ${fmtTokens(a.contextTokens)}  ≈${fmtCost(a.costUsd)}  ${fmtTime(elapsed(a, at))}`
  const steps = a.stepTotal ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' · ' + a.stepNote : ''}` : ''
  const stepsW = Math.max(0, barW - textWidth(stats, 11) - 12)
  // Without reported steps the bar falls back to the context, drawn grey.
  const fillW = Math.round(barW * (progress ?? ctx / 100))
  return svg(
    W,
    66,
    `${rowCrab(W, 0, 14, costumeOf(a), false, a.status === 'running')}
<text class="t" ${startText(W, 42, 18)} font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(a.description || a.type, 13, textW))}</text>
<text ${startText(W, 42, 34)} font-family="${FONT}" font-size="11"><tspan fill="${color}">${xml(tier === 'other' ? a.type : tierWord(tier))}</tspan><tspan class="s">  ${xml(meta.join('  ·  '))}</tspan></text>
${steps && stepsW > 30 ? `<text class="t" ${startText(W, 42, 49)} font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${xml(fitText(steps, 11, stepsW))}</text>` : ''}
<text class="s" ${endText(W, 42 + barW, 49, true)} font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${stats}</text>
<rect class="k" x="${mx(W, 42, barW)}" y="55" width="${barW}" height="4" rx="2"/><rect${progress === null ? ' class="m"' : ''} x="${mx(W, 42, fillW)}" y="55" width="${fillW}" height="4" rx="2"${progress === null ? '' : ` fill="${color}"`}/>
${statusMark(mx(W, W - 8), 16, a.status, color)}
<line class="ln" x1="0" y1="65.5" x2="${W}" y2="65.5"/>`,
  )
}

const plannedSvg = (W: number, p: Planned): string => {
  const tier = p.tier in TIER_COLOR ? p.tier : 'other'
  const color = colorOf(tier)
  const textW = W - 42 - 22
  const meta = [tierModel(tier)]
  if (p.after.length) meta.push(`${tr().after} ${p.after.join(', ')}`)
  return svg(
    W,
    46,
    `${rowCrab(W, 0, 6, tier, true)}
<text class="s" ${startText(W, 42, 18)} font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(`${p.n}. ${p.title}`, 13, textW))}</text>
<text ${startText(W, 42, 34)} font-family="${FONT}" font-size="11"><tspan fill="${color}">${xml(tierWord(tier))}</tspan><tspan class="m">  ${xml(meta.filter(Boolean).join('  ·  '))}</tspan></text>
${statusMark(mx(W, W - 8), 16, 'planned', color)}
<line class="ln" x1="0" y1="45.5" x2="${W}" y2="45.5"/>`,
  )
}

const compactSvg = (W: number, list: AgentRun[], planned: Planned[], t: ReturnType<typeof totals>): string => {
  const icons = [
    ...list.filter(a => a.status === 'running').map(a => ({ k: costumeOf(a), c: colorOf(costumeOf(a)), s: 'running', dim: false })),
    ...list.filter(a => a.status !== 'running').map(a => ({ k: costumeOf(a), c: colorOf(costumeOf(a)), s: a.status, dim: false })),
    ...planned.map(p => ({ k: p.tier in TIER_COLOR ? p.tier : 'other', c: colorOf(p.tier), s: 'planned', dim: true })),
  ]
  const fit = Math.max(1, Math.floor((W - 150) / 36))
  const shown = icons.slice(0, fit)
  const more = icons.length - shown.length
  const body = shown
    .map((ic, i) => rowCrab(W, i * 36, 0, ic.k, ic.dim, ic.s === 'running') + (ic.s === 'running' ? `<circle class="live" cx="${mx(W, i * 36 + 32)}" cy="4" r="3" fill="${ic.c}"/>` : ''))
    .join('')
  const x = shown.length * 36 + (more ? 4 : 0)
  return svg(
    W,
    32,
    `${body}${more ? `<text class="s" ${startText(W, x, 21, false)} font-family="${FONT}" font-size="12">+${more}</text>` : ''}
<text class="s" ${endText(W, W, 21)} font-family="${FONT}" font-size="12" font-variant-numeric="tabular-nums">≈${fmtCost(t.cost)} · ${fmtTokens(t.tokens)} · ${fmtTime(t.time)}</text>`,
  )
}

// --- the desktop Map: one card per subagent and background task, with what each is
// working on: the files it reads and edits, the commands it runs, what it searches.
// --- the desktop Map: the project as graphify maps it (graphify-out/graph.json), one card
// per community of code, linked where the code calls across, with a crab on the card each
// agent, subagent and background task is working in. Work outside the code (commands,
// web, searches, background tasks) sits on its own card.
export const GRAPH = 'graphify-out/graph.json'
const MAP_MAX = 24
const LIVE_MS = 90_000
// Three zoom levels: 0 chips (name only, up to 24), 1 cards with counts (default, up to
// 16), 2 cards with the latest action and a touched-files bar (up to 12).
export type Zoom = 0 | 1 | 2
const ZOOMS: Record<Zoom, { w: number; h: number; max: number }> = {
  0: { w: 118, h: 26, max: 24 },
  1: { w: 150, h: 40, max: 16 },
  2: { w: 200, h: 62, max: 12 },
}
export const zoomOf = (v: unknown): Zoom => (v === 0 || v === 2 ? v : 1)
const CARD_GAP = 8
const MAP_PAD = 4
const mapCols = (W: number, z: Zoom): number => Math.max(1, Math.floor((W - MAP_PAD * 2 + CARD_GAP) / (ZOOMS[z].w + CARD_GAP)))
export const mapCardCount = (p: ProjectMap, hasOff: boolean, z: Zoom): number => Math.min(p.communities.length, ZOOMS[z].max) + (hasOff ? 1 : 0)
export const mapHeight = (W: number, n: number, z: Zoom): number =>
  MAP_PAD * 2 + Math.ceil(n / mapCols(W, z)) * (ZOOMS[z].h + CARD_GAP) - CARD_GAP + 20

const KIND: Record<WorkKind, [glyph: string, color: string, word: string]> = {
  read: ['◇', '#6AAABD', 'read'],
  edit: ['✎', '#D97757', 'edit'],
  cli: ['❯', '#5FBF8F', 'command'],
  search: ['⌕', '#C9A227', 'search'],
  web: ['◎', '#8F8CF4', 'web'],
}

// Background tasks: small crabs, each in its own colour.
const BG_TINTS = ['#4FA3A5', '#8F8CF4', '#5B8DEF', '#C9A227', '#D96BA0', '#7FB069']
const tintOf = (id: string): string => BG_TINTS[[...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % BG_TINTS.length] ?? '#4FA3A5'
const BG_SCALE = 0.6

const pathKey = (p: string): string => p.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase()

// A community's name as graphify gave it, shortened to the last two parts of a path.
const shortName = (name: string): string => {
  const parts = name.replace(/\\/g, '/').split('/').filter(Boolean)
  return (parts.length > 1 ? parts.slice(-2).join('/') : name).replace(/\.(tsx?|jsx?|mjs|cjs|py|php|md)$/, '')
}

// graph.json to the few cards the panel draws: the largest communities, their files,
// and how many calls and references cross between each pair.
export const projectOf = (raw: string, mtimeMs: number): ProjectMap => {
  type Node = { id?: unknown; community?: unknown; community_name?: unknown; source_file?: unknown }
  type Link = { source?: unknown; target?: unknown }
  const g = JSON.parse(raw) as { nodes?: Node[]; links?: Link[]; edges?: Link[] }
  const byId = new Map<string, number>()
  const groups = new Map<number, { name: string; files: Set<string>; symbols: number }>()
  for (const n of g.nodes ?? []) {
    if (typeof n.community !== 'number' || typeof n.id !== 'string') continue
    byId.set(n.id, n.community)
    const cur = groups.get(n.community) ?? { name: typeof n.community_name === 'string' ? n.community_name : `Community ${n.community}`, files: new Set<string>(), symbols: 0 }
    cur.symbols++
    if (typeof n.source_file === 'string' && n.source_file) cur.files.add(pathKey(n.source_file))
    groups.set(n.community, cur)
  }
  const kept = [...groups.entries()].sort((a, b) => b[1].files.size - a[1].files.size || b[1].symbols - a[1].symbols).slice(0, MAP_MAX)
  const keptIds = new Set(kept.map(([id]) => id))
  const weights = new Map<string, number>()
  for (const l of g.links ?? g.edges ?? []) {
    const a = typeof l.source === 'string' ? byId.get(l.source) : undefined
    const b = typeof l.target === 'string' ? byId.get(l.target) : undefined
    if (a === undefined || b === undefined || a === b || !keptIds.has(a) || !keptIds.has(b)) continue
    const k = a < b ? `${a}:${b}` : `${b}:${a}`
    weights.set(k, (weights.get(k) ?? 0) + 1)
  }
  const links = [...weights.entries()].map(([k, w]): [number, number, number] => {
    const [a, b] = k.split(':').map(Number)
    return [a ?? 0, b ?? 0, w]
  })
  // Order the cards so linked ones sit side by side: start from the largest, then take
  // whichever card is most linked to those already placed.
  const order: number[] = []
  const left = new Set(kept.map(([id]) => id))
  const pull = (id: number) => links.reduce((s, [a, b, w]) => s + ((a === id && order.includes(b)) || (b === id && order.includes(a)) ? w : 0), 0)
  while (left.size > 0) {
    const pick = order.length === 0 ? kept[0]![0] : [...left].sort((x, y) => pull(y) - pull(x))[0]!
    order.push(pick)
    left.delete(pick)
  }
  const info = new Map(kept)
  return {
    mtimeMs,
    total: groups.size,
    communities: order.map(id => {
      const c = info.get(id)!
      return { id, name: shortName(c.name), files: [...c.files].slice(0, 400), symbols: c.symbols }
    }),
    links: links.sort((a, b) => b[2] - a[2]).slice(0, 24),
  }
}

// Who is on the map: the main session, each subagent and each background task, with the
// last thing each worked on.
export type Crew = {
  key: string
  name: string
  costume: string
  tint?: string
  isRunning: boolean
  item?: WorkItem
}

export const crewOf = (list: AgentRun[], bgs: BgTask[], items: WorkItem[], at: number, idleAt = 0): Crew[] => {
  const last = (who: string) => [...items].reverse().find(w => w.who === who)
  const crew: Crew[] = []
  const main = last('main')
  if (main && main.at > idleAt && at - main.at < LIVE_MS) crew.push({ key: 'main', name: 'main', costume: 'king', isRunning: true, item: main })
  for (const a of list) {
    if (a.status !== 'running' || !a.agentId) continue
    crew.push({ key: a.id, name: a.description || a.type, costume: costumeOf(a), isRunning: true, item: last(a.agentId) })
  }
  for (const t of bgs) {
    if (t.status !== 'running') continue
    crew.push({ key: t.id, name: t.label, costume: 'other', tint: tintOf(t.id), isRunning: true, item: { who: t.id, kind: 'cli', label: t.label, at: t.startedAt } })
  }
  return crew
}

// Each crew member on the card of the community holding the file it last worked on;
// anything else (a command, the web, a search, a file outside the graph) is off the code.
export const OFF_CODE = -1
// Work paths are absolute and graph paths relative to where graphify ran: match the tail.
export const inFile = (path: string, file: string): boolean => {
  const k = pathKey(path)
  return k === file || k.endsWith(`/${file}`)
}
export const placeCrew = (p: ProjectMap | null, crew: readonly Crew[]): Map<number, Crew[]> => {
  const out = new Map<number, Crew[]>()
  for (const m of crew) {
    const path = m.item?.path
    const id = path ? (p?.communities.find(c => c.files.some(f => inFile(path, f)))?.id ?? OFF_CODE) : OFF_CODE
    out.set(id, [...(out.get(id) ?? []), m])
  }
  return out
}

const MAP_CSS = `<style>
.card{fill:#f4f3f0;stroke:#e4e4e1}.card.on{fill:#fdf5e9;stroke:#e0b34a}.wire{stroke:#c9c8c3}
@media (prefers-color-scheme: dark){.card{fill:#232322;stroke:#333331}.card.on{fill:#2f271c;stroke:#e0b34a}.wire{stroke:#46453f}}
.wire{stroke-dasharray:3 4}
</style>`

const crewCrab = (m: Crew, x: number, y: number, scale: number): string =>
  m.tint ? crab(x, y, 'other', false, m.isRunning, scale * 0.8, false, m.tint) : crab(x, y, m.costume, false, m.isRunning, scale)

export const mapSvg = (W: number, p: ProjectMap, placed: Map<number, Crew[]>, touched: readonly string[], z: Zoom = 1): string => {
  const Z = ZOOMS[z]
  const off = placed.get(OFF_CODE) ?? []
  const shown = p.communities.slice(0, Z.max)
  const cards = [...shown.map(c => ({ id: c.id, c })), ...(off.length ? [{ id: OFF_CODE, c: null }] : [])]
  const cols = mapCols(W, z)
  // Cards share the row's spare width, so the grid fills it edge to edge.
  const cw = (W - MAP_PAD * 2 - (cols - 1) * CARD_GAP) / cols
  const ch = Z.h
  const spot = (i: number) => ({ x: MAP_PAD + (i % cols) * (cw + CARD_GAP), y: MAP_PAD + Math.floor(i / cols) * (ch + CARD_GAP) })
  const index = new Map(cards.map((k, i) => [k.id, i]))
  const H = mapHeight(W, cards.length, z)

  const wires = p.links.flatMap(([a, b, w]) => {
    const i = index.get(a)
    const j = index.get(b)
    if (i === undefined || j === undefined) return []
    const s = spot(i)
    const t = spot(j)
    const sameRow = s.y === t.y
    const [x1, y1, x2, y2] = sameRow
      ? [s.x + (s.x < t.x ? cw : 0), s.y + ch / 2, t.x + (s.x < t.x ? 0 : cw), t.y + ch / 2]
      : [s.x + cw / 2, s.y + (s.y < t.y ? ch : 0), t.x + cw / 2, t.y + (s.y < t.y ? 0 : ch)]
    const bend = sameRow ? `C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2}` : `C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2}`
    return [`<path class="wire" d="M${x1} ${y1} ${bend} ${x2} ${y2}" fill="none" stroke-width="${Math.min(2.5, 0.8 + Math.log2(w) / 2)}"/>`]
  })

  const crabScale = z === 0 ? 0.42 : z === 1 ? 0.5 : 0.62
  const crabStep = Math.round(CRAB_BOX * crabScale) + 2
  const body = cards.map((k, i) => {
    const { x, y } = spot(i)
    const crew = placed.get(k.id) ?? []
    const isLive = crew.length > 0
    const latest = [...crew].filter(m => m.item).sort((a, b) => (b.item?.at ?? 0) - (a.item?.at ?? 0))[0]
    const maxCrabs = z === 0 ? 2 : 3
    const textW = cw - 16 - Math.min(maxCrabs, crew.length) * crabStep
    const name = k.c ? k.c.name : 'Terminal & web'
    const files = k.c?.files ?? []
    const hit = files.filter(f => touched.some(t => inFile(t, f))).length
    const sub = k.c ? `${files.length} file${files.length === 1 ? '' : 's'} · ${k.c.symbols} sym` : `${off.length} running`
    const nameSize = z === 0 ? 10.5 : 11.5
    const nameY = z === 0 ? ch / 2 + 4 : 16
    const parts = [
      `<rect class="card${isLive ? ' on' : ''}" x="${x}" y="${y}" width="${cw}" height="${ch}" rx="${z === 0 ? 6 : 8}" stroke-width="1"/>`,
      `<text class="t" x="${x + 8}" y="${y + nameY}" font-family="${FONT}" font-size="${nameSize}" font-weight="600">${xml(fitText(name, nameSize, textW))}</text>`,
    ]
    if (z >= 1) parts.push(`<text class="s" x="${x + 8}" y="${y + 30}" font-family="${FONT}" font-size="9.5">${xml(fitText(sub, 9.5, textW))}</text>`)
    if (z === 2) {
      if (latest?.item)
        parts.push(
          `<text x="${x + 8}" y="${y + 44}" font-family="${FONT}" font-size="10"><tspan fill="${KIND[latest.item.kind][1]}">${KIND[latest.item.kind][0]}</tspan><tspan class="t" dx="5">${xml(fitText(latest.item.label, 10, cw - 70))}</tspan><tspan class="m" dx="5">${xml(fitText(latest.name, 9, 60))}</tspan></text>`,
        )
      else if (hit) parts.push(`<text class="m" x="${x + 8}" y="${y + 44}" font-family="${FONT}" font-size="10">${hit} touched</text>`)
      if (k.c) parts.push(`<g transform="translate(${x + 8},${y + 50})">${barGroup(`m-${k.id}`, cw - 16, 6, files.length ? hit / files.length : 0, isLive ? '#E0B34A' : ACCENT, '')}</g>`)
    }
    const crabY = y + (ch - CRAB_BOX * crabScale) / 2 - (z === 2 ? 8 : 0)
    parts.push(
      crew
        .slice(0, maxCrabs)
        .map((m, n) => crewCrab(m, x + cw - 4 - (n + 1) * crabStep, crabY, crabScale))
        .join(''),
    )
    if (crew.length > maxCrabs)
      parts.push(`<text class="m" x="${x + cw - 6 - maxCrabs * crabStep}" y="${crabY + 12}" font-family="${FONT}" font-size="9" text-anchor="end">+${crew.length - maxCrabs}</text>`)
    return parts.join('')
  })
  const hidden = p.total - shown.length
  const legend = (Object.keys(KIND) as WorkKind[]).map(k => `<tspan fill="${KIND[k][1]}">${KIND[k][0]}</tspan> ${KIND[k][2]}`).join('   ')
  return svg(
    W,
    H,
    `${MAP_CSS}${BAR_CSS(false)}
${wires.join('')}
${body.join('')}
<text class="s" x="${MAP_PAD}" y="${H - 5}" font-family="${FONT}" font-size="9.5">${legend}${hidden > 0 ? `   · ${hidden} more (zoom out)` : ''}</text>`,
  )
}

// The graph is read once per change: the panel checks its mtime on each draw. graphify
// writes it where it ran, which may be a folder or two above the session's own.
const GRAPH_DIRS = ['', '../', '../../', '../../../']
let projectCache: { at: string; mtimeMs: number; map: ProjectMap | null; note: string } | null = null
const loadProject = async ($: EngineInterface): Promise<{ map: ProjectMap | null; note: string; root: string }> => {
  for (const dir of GRAPH_DIRS) {
    const at = `${dir}${GRAPH}`
    const st = await $.fs.stat(at).catch(() => null)
    if (!st || st.kind !== 'file') continue
    if (projectCache?.at === at && projectCache.mtimeMs === st.mtimeMs) return { ...projectCache, root: dir || '.' }
    let map: ProjectMap | null = null
    let note = ''
    if (st.size > 4 * 1024 * 1024) note = 'graph.json is over 4 MiB, too large to read'
    else {
      try {
        map = projectOf(await $.fs.read(at), st.mtimeMs)
      } catch {
        note = 'graph.json could not be read'
      }
    }
    projectCache = { at, mtimeMs: st.mtimeMs, map, note }
    return { map, note, root: dir || '.' }
  }
  return { map: null, note: '', root: '.' }
}

let isBuilding = false
const buildProject = async ($: EngineInterface, root: string): Promise<void> => {
  if (isBuilding) return
  isBuilding = true
  $.ui.toast('graphify: mapping the project…')
  try {
    const r = await $.process.run(['graphify', 'update', '.'], { cwd: root, timeoutMs: 600_000 })
    $.ui.toast(r.exitCode === 0 ? 'graphify: project map ready' : `graphify failed (exit ${r.exitCode})`)
  } catch {
    $.ui.toast('graphify is not installed: pip install graphifyy')
  } finally {
    isBuilding = false
    await $.ui.invalidate('ui.render')
  }
}

// A background task as a panel row: a small crab in the task's own colour.
const BG_ROW_H = 30
const bgRowSvg = (W: number, t: BgTask, at: number): string => {
  const tint = tintOf(t.id)
  const time = fmtTime((t.endedAt ?? Math.max(at, t.startedAt)) - t.startedAt)
  return svg(
    W,
    BG_ROW_H,
    `${crab(mx(W, 6, crabWidth(BG_SCALE)), 6, 'other', t.status === 'failed', t.status === 'running', BG_SCALE, isRtl(), tint)}
<text class="t" ${startText(W, 34, 19)} font-family="${FONT}" font-size="12">${xml(fitText(t.label, 12, W - 150))}</text>
<text class="s" ${endText(W, W - 28, 19)} font-family="${FONT}" font-size="10">${t.kind} · ${time}</text>
${statusMark(mx(W, W - 12), 15, t.status, tint)}`,
  )
}

// --- Skills and plugins: what the session has loaded or called, each with its own crab.
// Active means used in the last few minutes; the rest are enabled plugins and skills used
// earlier. Their tints are a palette of their own, apart from subagent tiers and tasks.
const SKILL_TINTS = ['#F4D35E', '#EE964B', '#FF6B6B', '#2EC4B6', '#C3B1E1', '#F7A1C4', '#A3E635', '#FDBA74']
const skillTint = (name: string): string =>
  SKILL_TINTS[[...name].reduce((h, ch) => (h * 33 + ch.charCodeAt(0)) >>> 0, 11) % SKILL_TINTS.length] ?? '#F4D35E'
const SKILL_LIVE_MS = 5 * 60_000
const SKILL_SCALE = 0.7
const SKILL_ROW_H = 30
const SKILL_MAX = 14
// Tools of the app itself and of this plugin are not skills the person added.
const SKIP_SERVERS = /^(ccd_|savvy-progress$|claude_ai_)/

// What a tool call says about a skill or plugin in use, or null for any other call.
export const kitOf = (tool: string, e: Record<string, unknown>): [kind: SkillKind, name: string] | null => {
  if (tool === 'Skill' && typeof e.skill === 'string' && e.skill) return ['skill', e.skill.replace(/^\//, '')]
  const m = /^mcp__(.+?)__/.exec(tool)
  if (!m?.[1] || SKIP_SERVERS.test(m[1])) return null
  // A plugin's own server is named plugin_<plugin>_<server>.
  const plugin = /^plugin_(.+)_[^_]+$/.exec(m[1])?.[1]
  return ['plugin', plugin ?? m[1]]
}

export const useKit = (list: readonly SkillUse[], kind: SkillKind, name: string, who: string, at: number): SkillUse[] => {
  const prev = list.find(u => u.name === name)
  const next: SkillUse = { name, kind: prev?.kind === 'skill' ? 'skill' : kind, who, at, count: (prev?.count ?? 0) + 1 }
  return [...list.filter(u => u.name !== name), next].slice(-60)
}

export type KitRow = { name: string; kind: SkillKind; state: 'active' | 'used' | 'idle'; use?: SkillUse }

// Every skill and plugin to show: used ones newest first, then enabled ones not used yet.
export const kitRowsOf = (uses: readonly SkillUse[], enabled: readonly string[], at: number): KitRow[] => {
  const used = [...uses].sort((a, b) => b.at - a.at).map((u): KitRow => ({ name: u.name, kind: u.kind, state: at - u.at < SKILL_LIVE_MS ? 'active' : 'used', use: u }))
  // A skill named plugin:skill counts as use of that plugin.
  const seen = new Set(uses.flatMap(u => [u.name, u.name.split(':')[0] ?? u.name]))
  const idle = enabled.filter(n => !seen.has(n)).sort().map((n): KitRow => ({ name: n, kind: 'plugin', state: 'idle' }))
  return [...used.filter(r => r.state === 'active'), ...used.filter(r => r.state === 'used'), ...idle]
}

const whoName = (who: string, list: readonly AgentRun[]): string =>
  who === 'main' ? 'main' : (list.find(a => a.agentId === who)?.type ?? 'subagent')

const kitRowSvg = (W: number, r: KitRow, list: readonly AgentRun[], at: number): string => {
  const tint = skillTint(r.name)
  const isActive = r.state === 'active'
  const sub =
    r.state === 'idle'
      ? 'enabled · not used yet'
      : `${isActive ? 'active' : `${fmtTime(at - (r.use?.at ?? at))} ago`} · ${whoName(r.use?.who ?? 'main', list)} · ${r.use?.count ?? 0}×`
  return svg(
    W,
    SKILL_ROW_H,
    `${crab(mx(W, 4, crabWidth(SKILL_SCALE)), 4, 'other', !isActive, isActive, SKILL_SCALE, isRtl(), tint)}
<text class="${r.state === 'idle' ? 's' : 't'}" ${startText(W, 34, 14)} font-family="${FONT}" font-size="12"${isActive ? ' font-weight="600"' : ''}>${xml(fitText(r.name, 12, W - 60))}</text>
<text class="m" ${startText(W, 34, 26)} font-family="${FONT}" font-size="10">${r.kind} · ${xml(fitText(sub, 10, W - 100))}</text>
${isActive ? `<circle class="live" cx="${mx(W, W - 10)}" cy="15" r="3.5" fill="${tint}"/>` : ''}`,
  )
}

// The main session as a row beside its subagents: what it is on (the task list's current
// step) and the last thing it did.
const MAIN_ROW_H = 46
const mainRowSvg = (W: number, step: string, item: WorkItem | undefined, isWorking: boolean): string =>
  svg(
    W,
    MAIN_ROW_H,
    `${rowCrab(W, 4, 8, 'king', false, isWorking)}
<text class="t" ${startText(W, 44, 19)} font-family="${FONT}" font-size="13" font-weight="600">Main session</text>
<text class="s" ${startText(W, 44, 35)} font-family="${FONT}" font-size="11">${xml(fitText(step || 'no task list yet', 11, W - 70))}</text>
${item ? `<text ${endText(W, W - 8, 19)} font-family="${FONT}" font-size="11"><tspan fill="${KIND[item.kind][1]}">${KIND[item.kind][0]}</tspan><tspan class="m"> ${xml(fitText(item.label, 11, W * 0.45))}</tspan></text>` : ''}`,
  )

// Enabled plugins from settings: { "name@marketplace": true }.
const enabledPlugins = async ($: EngineInterface): Promise<string[]> => {
  try {
    const st = (await $.settings.read()) as { enabledPlugins?: Record<string, unknown> }
    return Object.entries(st.enabledPlugins ?? {})
      .filter(([, on]) => on === true)
      .map(([k]) => k.split('@')[0] ?? k)
      .filter(n => n !== 'savvy-progress')
  } catch {
    return []
  }
}

// --- terminal drawing: the same rows in text.

const ctxBar = (pct: number, width: number): string => {
  const filled = Math.round((width * pct) / 100)
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}

const STATUS_GLYPH: Record<string, string> = { running: '●', done: '✓', failed: '✗', planned: '◷' }

// Opens the agents pane, or closes it when it is up; true when it ends up open.
async function togglePane($: EngineInterface): Promise<boolean> {
  const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
  if (isOpen) {
    await $.ui.close({ id: PANE })
    return false
  }
  const at = await $.clock.now()
  await update($, now, () => at)
  await $.ui.open({ id: PANE, title: tr().pane })
  return true
}

// What a subagent's tool call worked on, as one line of the map.
export const workOf = (tool: string, e: Record<string, unknown>): [WorkKind, string] | null => {
  const str = (k: string): string => (typeof e[k] === 'string' ? (e[k] as string) : '')
  const tail = (path: string): string => path.replace(/\\/g, '/').split('/').filter(Boolean).slice(-2).join('/')
  switch (tool) {
    case 'Read':
      return ['read', tail(str('file_path'))]
    case 'Edit':
    case 'Write':
      return ['edit', tail(str('file_path'))]
    case 'Bash':
      return ['cli', str('description') || str('command')]
    case 'Grep':
    case 'Glob':
      return ['search', str('pattern')]
    case 'WebFetch':
      return ['web', /^\w+:\/\/([^/]+)/.exec(str('url'))?.[1] ?? str('url')]
    case 'WebSearch':
      return ['web', str('query')]
  }
  return null
}

// The main session's calls are 'main'; a subagent's carry its agentId.
async function recordWork($: EngineInterface, tool: string, e: { agentId?: string }): Promise<void> {
  const w = workOf(tool, e as Record<string, unknown>)
  if (!w || !w[1]) return
  const at = await $.clock.now()
  const path = (e as { file_path?: unknown }).file_path
  const item: WorkItem = {
    who: e.agentId ?? 'main',
    kind: w[0],
    label: w[1].replace(/\s+/g, ' ').slice(0, 100),
    at,
    ...(typeof path === 'string' && path ? { path } : {}),
  }
  await update($, work, list => [...list, item].slice(-300))
}

// The app's task list as update_plan changes it: a whole new list, or a step moved on.
const MAX_PLAN = 12
const STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'completed']
export const applyPlan = (list: Task[], e: Record<string, unknown>): Task[] => {
  if (Array.isArray(e.items)) {
    return e.items
      .filter((t): t is { content: string; status?: unknown } => typeof t === 'object' && t !== null && typeof (t as { content?: unknown }).content === 'string')
      .slice(0, MAX_PLAN)
      .map(t => ({ content: t.content.slice(0, 120), status: STATUSES.includes(t.status as TaskStatus) ? (t.status as TaskStatus) : 'pending' }))
  }
  let next = list.slice()
  const set = (i: number, status: TaskStatus) => {
    const t = next[i]
    if (t) next[i] = { ...t, status }
  }
  if (e.advance === true) {
    const cur = next.findIndex(t => t.status === 'in_progress')
    if (cur >= 0) set(cur, 'completed')
    const nxt = next.findIndex(t => t.status === 'pending')
    if (nxt >= 0) set(nxt, 'in_progress')
  }
  if (Array.isArray(e.done)) for (const n of e.done) if (typeof n === 'number') set(n - 1, 'completed')
  if (typeof e.start === 'number') {
    next = next.map(t => (t.status === 'in_progress' ? { ...t, status: 'completed' } : t))
    set(e.start - 1, 'in_progress')
  }
  return next
}
const TASK_GLYPH: Record<TaskStatus, string> = { completed: '✓', in_progress: '◐', pending: '○' }
const TASK_COLOR: Record<TaskStatus, string | undefined> = { completed: DONE, in_progress: ACCENT, pending: undefined }

async function track($: EngineInterface, id: string, kind: BgTask['kind'], label: string): Promise<void> {
  const at = await $.clock.now()
  await update($, bg, list => [...list.filter(t => t.id !== id), { id, kind, label: label.slice(0, 120), status: 'running' as const, startedAt: at }].slice(-100))
  await update($, now, () => at)
}

async function autoOpen($: EngineInterface, key: string): Promise<void> {
  const p = await read($, panel)
  if (p.autoOpenedFor === key) return
  await update($, panel, prev => ({ ...prev, autoOpenedFor: key }))
  void $.ui.open({ id: PANE, title: tr().pane })
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    lang = await detectLang($, options.language)
    await $.tool.register({
      name: 'progress',
      description:
        'Report /savvy-flow progress to the progress bar above the prompt and the agents panel. ' +
        'Call it after presenting the plan (title, total, tasks, phase "delegate"), each time a task is accepted (done), ' +
        'when switching phase or re-planning (tasks), and once at the end with finished: true. Fields left out keep their previous value. ' +
        'For the main session only: a call from a subagent is ignored (workers report with `step`).',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short name of the overall task, a few words.' },
          total: { type: 'integer', minimum: 0, description: 'Number of planned worker tasks.' },
          done: { type: 'integer', minimum: 0, description: 'Number of tasks accepted after review.' },
          phase: { type: 'string', enum: [...PHASES] },
          finished: { type: 'boolean', description: 'True once the flow is closed.' },
          tasks: {
            type: 'array',
            description:
              'The planned worker tasks in order, numbered from 1. Each title must equal the Agent tool `description` the task will be delegated with, so the panel can match runs to tasks.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'A few words; reused verbatim as the Agent description.' },
                tier: { type: 'string', enum: [...TIERS] },
                after: { type: 'array', items: { type: 'integer' }, description: 'Numbers of the tasks this one waits for.' },
              },
              required: ['title', 'tier'],
            },
          },
        },
      },
    })
    await $.tool.register({
      name: 'step',
      description:
        'For savvy-flow workers: report progress on your own task to the agents panel. ' +
        'Right after reading the brief, call it with `total` (your plan in 3-8 steps) and `done: 0`; ' +
        'call it again as each step finishes. Cheap and silent: it only draws a bar.',
      inputSchema: {
        type: 'object',
        properties: {
          done: { type: 'integer', minimum: 0, description: 'Steps finished so far.' },
          total: { type: 'integer', minimum: 1, description: 'Steps planned; may change if the plan changes.' },
          note: { type: 'string', description: 'The step in progress, a few words.' },
        },
        required: ['done'],
      },
      // In every agent's tool list, not behind ToolSearch: workers do not go looking for it.
      isDeferred: false,
    })
    await $.command.register({
      name: 'agents-info',
      description: 'Show or hide the panel of subagents: running, finished and planned, with model, context, cost and time',
    })

    // Ticks the clocks while anything is running or still lit (recent work, a skill in use),
    // so it goes dark on time; quiet otherwise.
    $.clock.every(1000, () => {
      void (async () => {
        const at = await $.clock.now()
        const isRunning = (await read($, agents)).some(a => a.status === 'running') || (await read($, bg)).some(t => t.status === 'running')
        const lastWork = (await read($, work)).at(-1)?.at ?? 0
        const lastKit = Math.max(0, ...(await read($, kit)).map(u => u.at))
        const shown = await read($, now)
        const isLit = (lastWork > shown - LIVE_MS && at - lastWork < LIVE_MS + 2000) || (lastKit > shown - SKILL_LIVE_MS && at - lastKit < SKILL_LIVE_MS + 2000)
        if (!isRunning && !isLit) return
        await update($, now, () => at)
      })()
    })
    // Always on: the panel opens with every session.
    void $.ui.open({ id: PANE, title: tr().pane })
    return started
  })

  // Background shells and monitors are not agents: track them from their tool calls.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const r = await next(e)
    await recordWork($, 'Bash', e)
    const id = (r as { result?: { backgroundTaskId?: string } }).result?.backgroundTaskId
    if (id) await track($, id, 'shell', String(e.description || e.command || 'shell'))
    return r
  })
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const r = await next(e)
    await recordWork($, 'Read', e)
    return r
  })
  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const r = await next(e)
    await recordWork($, 'Edit', e)
    return r
  })
  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const r = await next(e)
    await recordWork($, 'Write', e)
    return r
  })
  on('tool.call', { tool: 'Grep' }, async ($, e, next) => {
    const r = await next(e)
    await recordWork($, 'Grep', e)
    return r
  })
  on('tool.call', { tool: 'Glob' }, async ($, e, next) => {
    const r = await next(e)
    await recordWork($, 'Glob', e)
    return r
  })
  on('tool.call', { tool: 'WebFetch' }, async ($, e, next) => {
    const r = await next(e)
    await recordWork($, 'WebFetch', e)
    return r
  })
  on('tool.call', { tool: 'WebSearch' }, async ($, e, next) => {
    const r = await next(e)
    await recordWork($, 'WebSearch', e)
    return r
  })
  // The app's task list (update_plan), shown in the panel; wrap_up checks it off.
  on('tool.call', { tool: 'mcp__ccd_turn__update_plan' }, async ($, e, next) => {
    await update($, tasks, list => applyPlan(list, e as Record<string, unknown>))
    return next(e)
  }).catch(($, e, next) => next(e))
  on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' }, async ($, e, next) => {
    await update($, tasks, list => list.map(t => ({ ...t, status: 'completed' as const })))
    return next(e)
  }).catch(($, e, next) => next(e))
  on('tool.call', async ($, e, next) => {
    const k = kitOf(e.tool, e as Record<string, unknown>)
    if (k) {
      const at = await $.clock.now()
      await update($, kit, list => useKit(list, k[0], k[1], e.agentId ?? 'main', at))
    }
    return next(e)
  })
  on('skill.prompt', async ($, e, next) => {
    const at = await $.clock.now()
    await update($, kit, list => useKit(list, 'skill', e.skill, 'main', at))
    return next(e)
  })
  on('tool.call', { tool: 'Monitor' }, async ($, e, next) => {
    const r = await next(e)
    const id = (r as { result?: { taskId?: string } }).result?.taskId
    if (id) await track($, id, 'monitor', String(e.description || 'monitor'))
    return r
  })
  // A background task's notification names the task and how it ended.
  on('prompt.submit', async ($, e, next) => {
    if (e.origin?.kind === 'task-notification') {
      const id = /<task-id>([^<]+)<\/task-id>/.exec(e.text)?.[1]
      const state = /<status>([^<]+)<\/status>/.exec(e.text)?.[1]
      if (id && state && state !== 'running') {
        const at = await $.clock.now()
        await update($, bg, list =>
          list.map((t): BgTask => (t.id === id ? { ...t, status: state === 'completed' ? 'done' : 'failed', endedAt: at } : t)),
        )
      }
    }
    return next(e)
  })

  on('command.run', { command: 'agents-info' }, async ($, e) => {
    // `/agents-info open` opens the panel, or brings it forward from behind another tab, without toggling it.
    if ((e.args ?? '').trim() === 'open') {
      const at = await $.clock.now()
      await update($, now, () => at)
      await $.ui.open({ id: PANE, title: tr().pane })
      return { text: tr().opened }
    }
    const isOpen = await togglePane($)
    return { text: isOpen ? tr().opened : tr().closed }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    // The flow is the main session's: a call from a worker's loop carries its agentId
    // and changes nothing, or any subagent could rename, finish or reset the flow.
    if (e.agentId) return { result: 'ignored: only the main session reports the flow' }
    const input = e as unknown as ProgressInput
    const prev = await read($, flow)
    if (isNewFlow(prev, input) && input.title !== undefined) {
      // A new flow starts with a clean list; agents still running stay.
      await update($, agents, list => list.filter(a => a.status === 'running'))
    }
    const next = await update($, flow, p => merge(p, input))
    if (next && input.tasks?.length) await autoOpen($, next.title)
    return { result: `ok: ${label(next ?? blank())}` }
  })

  // A worker's own progress: the call runs in the worker's loop, so agentId names it.
  on('tool.call', { tool: STEP_TOOL }, async ($, e) => {
    const input = e as unknown as { done?: number; total?: number; note?: string }
    const agentId = e.agentId
    if (!agentId) return { result: 'ignored: only subagents report steps' }
    let matched = false
    await update($, agents, list =>
      list.map(a => {
        if (a.agentId !== agentId) return a
        matched = true
        const total = Math.max(0, Math.round(input.total ?? a.stepTotal ?? 0))
        const done = Math.max(0, Math.round(input.done ?? a.stepDone ?? 0))
        return { ...a, stepTotal: total, stepDone: total ? Math.min(total, done) : done, stepNote: input.note?.trim() || undefined }
      }),
    )
    return { result: matched ? 'ok' : `ignored: no panel row for agent ${agentId}` }
  })

  // Safety net: worker launches move the faint layer even if the orchestrator forgets to report.
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const type = String(e.subagent_type ?? '')
    if (!type.startsWith('savvy-')) return next(e)

    await update($, flow, prev => {
      const base = prev && !prev.isFinished ? { ...blank(), ...prev } : blank()
      return { ...base, running: base.running + 1, phase: base.phase === 'plan' ? 'delegate' : base.phase }
    })
    try {
      return await next(e)
    } finally {
      await update($, flow, prev => (prev ? { ...prev, running: Math.max(0, prev.running - 1) } : prev))
    }
  })

  on('agent.spawn', async ($, e, next) => {
    const isUnbriefed = e.subagentType.startsWith('savvy-') && !e.prompt.includes(STEP_TOOL)
    const started = await next(routeModel(isUnbriefed ? { ...e, prompt: e.prompt + STEP_BRIEF } : e))
    if (started.deny !== undefined) return started

    const at = await $.clock.now()
    await update($, agents, list => {
      const round = 1 + list.filter(a => norm(a.description) === norm(e.description) && e.description).length
      const run: AgentRun = {
        id: started.agentId ?? e.tool_use_id,
        agentId: started.agentId,
        type: e.subagentType,
        description: e.description,
        model: started.model,
        status: 'running',
        startedAt: at,
        contextTokens: 0,
        contextMax: windowOf(started.model),
        tokens: 0,
        costUsd: 0,
        steps: 0,
        round,
      }
      return [...list.filter(a => a.id !== run.id), run].slice(-200)
    })
    await update($, now, () => at)
    if (e.subagentType.startsWith('savvy-')) {
      const f = await read($, flow)
      await autoOpen($, f && !f.isFinished ? f.title : 'savvy-flow')
    } else if (options.autoOpen === 'any') {
      await autoOpen($, 'any-agent')
    }
    return started
  })

  // Each model request of a subagent: live context, tokens and cost.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const agentId = e.agentId
    const usage = result.usage
    if (!agentId || !usage) return result

    const model = usage.model || e.model
    await update($, agents, list =>
      list.map((a): AgentRun =>
        a.agentId !== agentId
          ? a
          : {
              ...a,
              model,
              effort: typeof e.effort === 'string' ? e.effort : a.effort,
              status: 'running',
              endedAt: undefined,
              contextTokens:
                (usage.input_tokens || 0) +
                (usage.cache_read_input_tokens || 0) +
                (usage.cache_creation_input_tokens || 0) +
                (usage.output_tokens || 0),
              contextMax: windowOf(model),
              tokens:
                a.tokens +
                (usage.input_tokens || 0) +
                (usage.output_tokens || 0) +
                (usage.cache_read_input_tokens || 0) +
                (usage.cache_creation_input_tokens || 0),
              costUsd: a.costUsd + costOf(model, usage, true),
              steps: a.steps + 1,
            },
      ),
    )
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const agentId = e.agentId
    if (!agentId) {
      const at = await $.clock.now()
      await update($, mainIdleAt, () => at)
      await update($, now, () => at)
    }
    if (agentId) {
      const at = await $.clock.now()
      await update($, agents, list =>
        list.map((a): AgentRun => {
          if (a.agentId !== agentId) return a
          // A run whose steps went unseen still gets the turn's own sum.
          const fallback = a.steps === 0 && e.usage
          return {
            ...a,
            status: e.reason === 'answer' ? 'done' : 'failed',
            endedAt: at,
            ...(fallback && e.usage
              ? {
                  model: e.usage.model || a.model,
                  tokens:
                    e.usage.input_tokens +
                    e.usage.output_tokens +
                    e.usage.cache_read_input_tokens +
                    e.usage.cache_creation_input_tokens,
                  costUsd: costOf(e.usage.model || a.model, e.usage, false),
                }
              : {}),
          }
        }),
      )
      await update($, now, () => at)
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const s = tr()
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const list = await read($, agents)
    const bgList = (await read($, bg)).slice().reverse()
    const bgRows = bgList.map(t => (
      <Text key={`bg-${t.id}`} wrap="truncate-end">
        <Text color={tintOf(t.id)}>▪</Text>{' '}
        <Text color={t.status === 'failed' ? 'red' : t.status === 'done' ? 'green' : undefined}>{STATUS_GLYPH[t.status]}</Text> {t.kind} · {t.label}
      </Text>
    ))
    const nowAt = await read($, now)
    const workList = await read($, work)
    const project = await loadProject($)
    const idleAt = await read($, mainIdleAt)
    const crewList = crewOf(list, bgList, workList, nowAt, idleAt)
    const placed = placeCrew(project.map, crewList)
    const shownMap: ProjectMap = project.map ?? { mtimeMs: 0, total: 0, communities: [], links: [] }
    const zoom = zoomOf((await read($, panel)).mapZoom)
    const mapCards = mapCardCount(shownMap, placed.has(OFF_CODE), zoom)
    const touched = workList.filter(w => w.kind === 'edit' && w.path).map(w => w.path ?? '')
    const setZoom = (d: number) => update($, panel, prev => ({ ...prev, mapZoom: Math.max(0, Math.min(2, zoomOf(prev.mapZoom) + d)) as Zoom }))
    const mapButton = (
      <Box key="map-tools" flexDirection="row" gap={2}>
        <Button key="map-build" label={project.map ? '↻ Rebuild' : '⌗ Build project map (graphify)'} plain onPress={() => void buildProject($, project.root)} />
        {project.map && <Button key="map-out" label="− Zoom out" plain onPress={() => setZoom(-1)} />}
        {project.map && <Button key="map-in" label="+ Zoom in" plain onPress={() => setZoom(1)} />}
      </Box>
    )
    const mapNote = project.note || (project.map ? '' : 'No project map yet: graphify maps the code into communities.')
    const taskList = await read($, tasks)
    const mainItem = [...workList].reverse().find(w => w.who === 'main')
    const mainStep = taskList.find(t => t.status === 'in_progress')?.content ?? ''
    const isMainWorking = !!mainItem && mainItem.at > idleAt && nowAt - mainItem.at < LIVE_MS
    const showMain = !!mainItem || taskList.length > 0
    const kitRows = kitRowsOf(await read($, kit), await enabledPlugins($), nowAt)
    const kitActive = kitRows.filter(k => k.state === 'active').length
    const kitShown = kitRows.slice(0, SKILL_MAX)
    const kitMore = kitRows.length - kitShown.length
    const kitText = kitShown.map(k => (
      <Text key={`kit-${k.name}`} wrap="truncate-end">
        <Text color={skillTint(k.name)} dimColor={k.state !== 'active'}>
          ▣
        </Text>{' '}
        <Text bold={k.state === 'active'} dimColor={k.state === 'idle'}>
          {k.name}
        </Text>{' '}
        <Text dimColor>
          {k.kind} · {k.state === 'idle' ? 'not used yet' : k.state}
        </Text>
      </Text>
    ))
    const tasksDone = taskList.filter(t => t.status === 'completed').length
    const taskRows = taskList.map((t, i) => (
      <Text key={`task-${i}`} wrap="truncate-end">
        <Text color={TASK_COLOR[t.status]} dimColor={t.status === 'pending'}>
          {TASK_GLYPH[t.status]}
        </Text>{' '}
        <Text dimColor={t.status === 'pending'} bold={t.status === 'in_progress'} strikethrough={t.status === 'completed'}>
          {t.content}
        </Text>
      </Text>
    ))
    const mapRows = [...shownMap.communities.map(c => ({ id: c.id, name: c.name, sub: `${c.files.length} files` })), ...(placed.has(OFF_CODE) ? [{ id: OFF_CODE, name: 'Terminal & web', sub: '' }] : [])].map(c => (
      <Box key={`card-${c.id}`} flexDirection="column">
        <Text wrap="truncate-end">
          <Text color={placed.has(c.id) ? '#E0B34A' : undefined}>{placed.has(c.id) ? '◆' : '◇'}</Text> {c.name} <Text dimColor>{c.sub}</Text>
        </Text>
        {(placed.get(c.id) ?? []).map(m => (
          <Text key={`crew-${c.id}-${m.key}`} wrap="truncate-end">
            {'  '}
            <Text color={m.tint ?? CLAY}>▣</Text> {m.name}
            {m.item && (
              <Text dimColor>
                {' '}
                {KIND[m.item.kind][0]} {m.item.label}
              </Text>
            )}
          </Text>
        ))}
      </Box>
    ))
    const f = await read($, flow)
    const p: Panel = await read($, panel)
    const at = Math.max(await read($, now), ...list.map(a => a.startedAt), 0)

    const running = list.filter(a => a.status === 'running').reverse()
    const finished = list.filter(a => a.status !== 'running').reverse()
    const planned = plannedOf(f, list)
    const t = totals(list, at)
    // The pane's title says "Agents"; inside, only the flow's own name.
    const title = f && !f.isFinished ? f.title : ''

    const toggleCompact = (
      <Button
        key="compact"
        label={p.isCompact ? s.expand : s.collapse}
        plain
        onPress={() => update($, panel, prev => ({ ...prev, isCompact: !prev.isCompact }))}
      />
    )
    const toggleDone = (
      <Button
        key="done"
        label={`${p.isDoneCollapsed ? (isRtl() ? '◂' : '▸') : '▾'} ${s.finished} · ${finished.length}`}
        plain
        onPress={() => update($, panel, prev => ({ ...prev, isDoneCollapsed: !prev.isDoneCollapsed }))}
      />
    )
    const isEmpty = list.length === 0 && planned.length === 0 && bgList.length === 0 && taskList.length === 0
    const summary = `≈${fmtCost(t.cost)}, ${fmtTokens(t.tokens)} ${s.tokensWord}, ${fmtTime(t.time)}`

    if (e.surface === 'desktop' && 'Svg' in ui) {
      const { Svg } = ui
      const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))
      const section = (key: string, text: string) => (
        <Text key={key} dimColor>
          {text}
        </Text>
      )

      // In Hebrew the column hugs the right edge: section heads and buttons right-aligned.
      const align = isRtl() ? 'flex-end' : undefined
      if (p.isCompact) {
        return (
          <Box flexDirection="column" gap={1} alignItems={align}>
            <Svg source={compactSvg(W, list, planned, t)} alt={`${list.length} ${s.agentsCount}, ${summary}`} width={W} height={32} />
            {toggleCompact}
          </Box>
        )
      }
      const shownDone = p.isDoneCollapsed ? 0 : finished.length
      // Row 2 is two columns once the pane is wide enough: the crew (main session, subagents,
      // tasks, background) on the left, skills and plugins on the right.
      const isTwoCol = W >= 560
      const colW = isTwoCol ? Math.floor((W - 12) / 2) : W
      const leftH =
        (showMain ? MAIN_ROW_H : 0) +
        ((isEmpty ? 1 : 0) + (running.length > 0 ? 1 : 0) + (finished.length > 0 ? 1 : 0) + (planned.length > 0 ? 1 : 0)) * LINE_H +
        (running.length + shownDone) * 66 +
        planned.length * 46 +
        (taskList.length > 0 ? 1 + taskList.length : 0) * LINE_H +
        (bgList.length > 0 ? LINE_H + bgList.length * BG_ROW_H : 0)
      const rightH = LINE_H + (kitShown.length ? kitShown.length * SKILL_ROW_H : LINE_H) + (kitMore > 0 ? LINE_H : 0)
      const mapH = mapCards > 0 ? mapHeight(W, mapCards, zoom) : 0
      // Every row sits in the absolute overlay, so all of them must size the grid or they are clipped.
      const contentH =
        headerHeight(title) + LINE_H + (isTwoCol ? Math.max(leftH, rightH) : leftH + rightH) + LINE_H * (2 + (mapNote ? 1 : 0)) + mapH + 8
      // shortcut: assumes a desktop row is at least GRID_STEP px, so the grid never overshoots the pane; measure if it falls short.
      const gridH = Math.max(contentH, (e.props.scroll?.bodyRows || 0) * GRID_STEP)
      const left = (
        <Box key="col-crew" flexDirection="column" width={colW} flexShrink={0} alignItems={align}>
          {showMain && <Svg key="main" source={mainRowSvg(colW, mainStep, mainItem, isMainWorking)} alt={`Main session: ${mainStep}`} width={colW} height={MAIN_ROW_H} />}
          {isEmpty && <Text dimColor>{s.empty}</Text>}
          {running.length > 0 && section('h-run', `${s.running} · ${running.length}`)}
          {running.map(a => (
            <Svg key={a.id} source={agentSvg(colW, a, at)} alt={`${a.description}: ${modelName(a.model)}, ${s.isRunning}`} width={colW} height={66} />
          ))}
          {finished.length > 0 && toggleDone}
          {!p.isDoneCollapsed &&
            finished.map(a => (
              <Svg key={a.id} source={agentSvg(colW, a, at)} alt={`${a.description}: ${modelName(a.model)}, ${s.isFinished}`} width={colW} height={66} />
            ))}
          {planned.length > 0 && section('h-plan', `${s.planned} · ${planned.length}`)}
          {planned.map(pl => (
            <Svg key={`plan-${pl.n}`} source={plannedSvg(colW, pl)} alt={`${pl.n}. ${pl.title}: ${s.isPlanned}`} width={colW} height={46} />
          ))}
          {taskList.length > 0 && section('h-tasks', `Tasks · ${tasksDone}/${taskList.length}`)}
          {taskRows}
          {bgList.length > 0 && section('h-bg', `Background · ${bgList.length}`)}
          {bgList.map(t => (
            <Svg key={`bg-${t.id}`} source={bgRowSvg(colW, t, nowAt)} alt={`${t.kind}: ${t.label}, ${t.status}`} width={colW} height={BG_ROW_H} />
          ))}
        </Box>
      )
      const right = (
        <Box key="col-kit" flexDirection="column" width={colW} flexShrink={0} alignItems={align}>
          {section('h-kit', `Skills & plugins · ${kitActive} active of ${kitRows.length}`)}
          {kitShown.length === 0 && <Text dimColor>No skills or plugins seen yet.</Text>}
          {kitShown.map(r => (
            <Svg key={`kit-${r.name}`} source={kitRowSvg(colW, r, list, nowAt)} alt={`${r.kind} ${r.name}: ${r.state}`} width={colW} height={SKILL_ROW_H} />
          ))}
          {kitMore > 0 && <Text dimColor>+{kitMore} more not used</Text>}
        </Box>
      )
      return (
        <Box flexDirection="column">
          {/* The grid sizes the pane; the content is placed over it, as an
              absolute Box paints over the siblings before it. */}
          {gridTiles(gridH).map((tileH, i) => (
            <Svg key={`grid-${i}`} source={gridSvg(W, tileH)} alt="dotted grid" width={W} height={tileH} />
          ))}
          <Box flexDirection="column" position="absolute" top={0} left={0} right={0} alignItems={align}>
            {/* Row 1: cost, tokens and time. */}
            <Svg source={headerSvg(W, title, t)} alt={title ? `${title}: ${summary}` : summary} width={W} height={headerHeight(title)} />
            {toggleCompact}
            {/* Row 2: the crew beside the skills and plugins. */}
            <Box flexDirection={isTwoCol ? (isRtl() ? 'row-reverse' : 'row') : 'column'} gap={isTwoCol ? 1 : 0}>
              {left}
              {right}
            </Box>
            {/* Row 3: the project map. */}
            {section('h-map', project.map ? `Map · ${shownMap.total} communities from graphify` : 'Map')}
            {mapNote && <Text dimColor>{mapNote}</Text>}
            {mapButton}
            {mapCards > 0 && (
              <Svg
                key="map"
                source={mapSvg(W, shownMap, placed, touched, zoom)}
                alt={`Project map: ${mapCards} communities, zoom ${zoom}, ${crewList.length} working`}
                width={W}
                height={mapH}
              />
            )}
          </Box>
        </Box>
      )
    }

    // Terminal: the same content in text rows.
    const cols = Math.max(24, e.props.bodyColumns || 40)
    const barW = Math.max(6, Math.min(20, cols - 34))
    const row = (a: AgentRun) => {
      const tier = tierOf(a.type)
      const color = colorOf(tier)
      const ctx = ctxOf(a)
      const progress = progressOf(a)
      const model = runModel(a)
      const steps = a.stepTotal ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' ' + a.stepNote : ''} · ` : ''
      return (
        <Box key={a.id} flexDirection="column" marginBottom={1}>
          <Box flexDirection="row" gap={1}>
            <Text color={color}>▣</Text>
            <Text bold wrap="truncate-end">
              {a.description || a.type}
            </Text>
            <Text color={a.status === 'failed' ? 'red' : a.status === 'done' ? 'green' : color}>{STATUS_GLYPH[a.status]}</Text>
          </Box>
          <Text dimColor wrap="truncate-end">
            {'  '}
            {tier === 'other' ? a.type : tierWord(tier)} · {model}
            {a.round > 1 ? ` · ${s.round} ${a.round}` : ''}
          </Text>
          <Text wrap="truncate-end">
            {'  '}
            {progress === null ? <Text dimColor>{ctxBar(ctx, barW)}</Text> : <Text color={color}>{ctxBar(progress * 100, barW)}</Text>}
            <Text dimColor>
              {' '}
              {steps}{s.ctx} {ctx}% · {fmtTokens(a.contextTokens)} ≈{fmtCost(a.costUsd)} {fmtTime(elapsed(a, at))}
            </Text>
          </Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold wrap="truncate-end">
            {title}
          </Text>
          {toggleCompact}
        </Box>
        <Text dimColor>
          ≈{fmtCost(t.cost)} · {fmtTokens(t.tokens)} {s.tokensWord} · {fmtTime(t.time)}
        </Text>
        {p.isCompact ? (
          <Text wrap="truncate-end">
            {[...running, ...finished].map(a => (
              <Text key={a.id} color={colorOf(tierOf(a.type))}>
                {STATUS_GLYPH[a.status]}{' '}
              </Text>
            ))}
            {planned.map(pl => (
              <Text key={`plan-${pl.n}`} dimColor>
                ◷{' '}
              </Text>
            ))}
          </Text>
        ) : (
          <Box flexDirection="column" marginTop={1}>
            {showMain && (
              <Text wrap="truncate-end">
                <Text color={CLAY}>▣</Text> <Text bold>Main session</Text> <Text dimColor>{mainStep || (mainItem ? `${KIND[mainItem.kind][0]} ${mainItem.label}` : '')}</Text>
              </Text>
            )}
            {isEmpty && <Text dimColor>{s.empty}</Text>}
            {running.length > 0 && <Text dimColor>{s.running} · {running.length}</Text>}
            {running.map(row)}
            {finished.length > 0 && toggleDone}
            {!p.isDoneCollapsed && finished.map(row)}
            {planned.length > 0 && <Text dimColor>{s.planned} · {planned.length}</Text>}
            {planned.map(pl => {
              const tier = pl.tier in TIER_COLOR ? pl.tier : 'other'
              return (
                <Box key={`plan-${pl.n}`} flexDirection="column" marginBottom={1}>
                  <Text dimColor wrap="truncate-end">
                    <Text color={colorOf(tier)}>▢</Text> {pl.n}. {pl.title} ◷
                  </Text>
                  <Text dimColor wrap="truncate-end">
                    {'  '}
                    {tierWord(tier)} · {tierModel(tier)}
                    {pl.after.length ? ` · ${s.after} ${pl.after.join(', ')}` : ''}
                  </Text>
                </Box>
              )
            })}
            {taskList.length > 0 && <Text dimColor>Tasks · {tasksDone}/{taskList.length}</Text>}
            {taskRows}
            {bgList.length > 0 && <Text dimColor>Background · {bgList.length}</Text>}
            {bgRows}
            <Text dimColor>Skills & plugins · {kitActive} active of {kitRows.length}</Text>
            {kitText}
            <Text dimColor>{project.map ? `Map · ${shownMap.total} communities from graphify` : 'Map'}</Text>
            {mapNote && <Text dimColor>{mapNote}</Text>}
            {mapButton}
            {mapRows}
          </Box>
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    // Draw the other mods' bands first. Claude Code's own placeholder ({ type: 'engine' }) is
    // never nested: the desktop drops a band that nests it.
    const drawn = await Promise.resolve(next(e)).catch(() => null)
    const below = drawn && typeof drawn === 'object' && (drawn as { type?: string }).type !== 'engine' ? drawn : null
    const beneath = new Set(next.trace.filter(t => t.outcome !== 'skipped').map(t => t.plugin))
    const f = await read($, flow)
    const ws = beneath.has('ribbon') ? await read($, windows) : []
    if (f === null && ws.length === 0) return drawn ?? next(e)
    // This band stands in for ribbon's and ponytail's rows; any other band is kept.
    const isOurs = [...beneath].every(p => p === 'ribbon' || p === 'ponytail')
    const rest = isOurs ? null : below

    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const list = await read($, agents)
    const crew = list.length + (f ? plannedOf(f, list).length : 0)
    const isWorking = list.some(a => a.status === 'running')
    // The clock is read only for the usage resets: a band without them needs no clock.
    const at = ws.length ? await $.clock.now() : 0
    const crewButton = <Button key="savvy-agents" label={`×${crew}`} plain onPress={() => void togglePane($)} />
    const dismiss = f && <Button key="savvy-dismiss" label="✕" plain role="dismiss" onPress={() => update($, flow, () => null)} />
    const percent = f ? `${Math.round(ratio(f) * 100)}%` : ''
    const usageAlt = ws.map(w => `${windowName(w.kind)} ${Math.max(0, Math.round(100 - w.percentUsed))}% left`).join(', ')

    // The terminal's element table is completed with an `Svg` that draws nothing: test the surface too.
    if (e.surface !== 'terminal' && 'Svg' in ui) {
      const { Svg } = ui
      // About 8 CSS px per reported column; the rest is the count, the dismiss and their gaps.
      const width = Math.max(220, Math.min(1600, (e.props.bodyColumns || 100) * 8 - 96))
      const inner = width - 16
      const rows = [...(f ? [rowSvg(f, inner, isWorking)] : []), ...(ws.length ? [usageSvg(ws, inner, at)] : [])]
      const alt = [f ? `${f.title}: ${label(f)}, ${percent}` : '', usageAlt].filter(Boolean).join('; ')
      return (
        <Box flexDirection="column">
          <Box flexDirection={isRtl() ? 'row-reverse' : 'row'} alignItems="center" gap={1}>
            <Svg source={bandSvg(width, rows)} alt={alt} width={width} height={bandHeight(rows.length)} />
            {crewButton}
            {dismiss}
          </Box>
          {rest}
        </Box>
      )
    }

    const cols = e.props.bodyColumns
    const titleW = Math.max(8, Math.min(30, (f?.title.length ?? 5) + 2, Math.floor(cols / 3)))
    const width = Math.max(6, Math.min(40, cols - titleW - 32))
    const usageW = Math.max(4, Math.floor((cols - 8) / Math.max(1, ws.length)) - 16)
    return (
      <Box flexDirection="column">
        {f && (
          <Box flexDirection="row" gap={2}>
            <Box width={titleW} flexShrink={0}>
              <Text color={f.isFinished ? DONE : ACCENT}>● </Text>
              <Text wrap="truncate-end">{f.title}</Text>
            </Box>
            <Text color={f.isFinished ? DONE : ACCENT}>{barText(f, width)}</Text>
            <Text bold>{label(f)}</Text>
            <Text dimColor>{percent}</Text>
            {crewButton}
            {dismiss}
          </Box>
        )}
        {ws.length > 0 && (
          <Box flexDirection="row" gap={2}>
            {ws.map(w => {
              const left = Math.max(0, Math.min(100, Math.round(100 - w.percentUsed)))
              const color = left < 20 ? LOW : (USAGE_COLOR[w.kind] ?? ACCENT)
              return (
                <Text key={`w-${w.kind}`}>
                  <Text dimColor>{windowName(w.kind)} </Text>
                  <Text color={color}>{blocks(left / 100, usageW)}</Text>
                  <Text bold> {left}%</Text>
                  <Text dimColor> {resetIn(w.resetsAt, at)}</Text>
                </Text>
              )
            })}
          </Box>
        )}
        {rest}
      </Box>
    )
  })
}
