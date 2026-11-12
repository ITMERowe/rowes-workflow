import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRun, BgTask, Flow, Phase, PlannedTask, Quad, SkillKind, SkillUse, Split, Task, TaskStatus, WorkItem, WorkKind } from '../types'

const flow = atom({ plugin: 'hideout', key: 'flow' } as const, null)
const agents = atom({ plugin: 'hideout', key: 'agents' } as const, [])
const panel = atom({ plugin: 'hideout', key: 'panel' } as const, {
  isCompact: false,
  isDoneCollapsed: false,
  autoOpenedFor: '',
})
const now = atom({ plugin: 'hideout', key: 'now' } as const, 0)
const bg = atom({ plugin: 'hideout', key: 'bg' } as const, [])
const work = atom({ plugin: 'hideout', key: 'work' } as const, [])
const tasks = atom({ plugin: 'hideout', key: 'tasks' } as const, [])
const kit = atom({ plugin: 'hideout', key: 'kit' } as const, [])
// Plugins whose SessionStart hook added context: on for the whole session, so each prompt counts as their use.
const modes = atom({ plugin: 'hideout', key: 'modes' } as const, [])
// When the main session's last turn ended: its work before then is no longer live.
const mainIdleAt = atom({ plugin: 'hideout', key: 'mainIdleAt' } as const, 0)
const NO_SPLIT: Split = { requests: 0, tokens: [0, 0, 0, 0], usd: [0, 0, 0, 0] }
const mainSplit = atom({ plugin: 'hideout', key: 'mainSplit' } as const, NO_SPLIT)
// Every subagent request of the session, kept apart from the agents list so the totals never drop when rows go.
const subSplit = atom({ plugin: 'hideout', key: 'subSplit' } as const, NO_SPLIT)
// Enabled plugins from settings, read at SessionStart and each prompt, so a redraw reads no settings.
const enabled = atom({ plugin: 'hideout', key: 'enabled' } as const, [])
// ribbon's plan windows, for the band's USAGE row.
const windows = atom({ plugin: 'ribbon', key: 'windows' } as const, [])
type UsageWindow = { kind: string; percentUsed: number; resetsAt?: string }

// Background subagents with no model of their own run on a cheap one. Types that pin their
// own model (searcher, reader, editor, reviewer, savvy-*, auto-route:*) and forks keep theirs.
const PINNED = new Set(['searcher', 'reader', 'editor', 'reviewer'])
function routeModel<T extends { background: boolean; fork: boolean; model?: string; subagentType: string; parentModel: string }>(e: T): T {
  if (!e.background || e.fork || e.model || PINNED.has(e.subagentType) || /^(savvy-|auto-route:)/.test(e.subagentType)) return e
  if (/haiku/i.test(e.parentModel)) return e
  return { ...e, model: e.subagentType === 'Explore' ? 'haiku' : 'sonnet' }
}

const TOOL = 'mcp__hideout__progress'
const STEP_TOOL = 'mcp__hideout__step'
// Added to the end of each savvy worker's brief. Their system prompt words step
// reporting as a condition ("if the step tool appears among your tools") and they
// skip it even with the tool listed; the same request in the brief is followed.
const STEP_BRIEF = `

Progress reporting: before any other work, call \`${STEP_TOOL}\` with \`total\` (your plan in 3-8 steps) and \`done: 0\`; call it again with \`done\` and a few-word \`note\` as each step finishes. It only draws a progress bar.`
const PANE = 'hideout-agents'

// Each desktop card's box in pane px and how far it scrolls (in items).
type CardRect = { key: string; x: number; y: number; w: number; h: number; max: number; step: number }
// Set by the last desktop draw; the wheel hook reads it to find the card under the pointer.
let cardRects: CardRect[] = []
const scrollCard = ($: EngineInterface, key: string, d: number, max: number) =>
  update($, panel, prev => ({ ...prev, offsets: { ...prev.offsets, [key]: Math.max(0, Math.min(max, Math.min(prev.offsets?.[key] ?? 0, max) + d)) } }))
// The card under a wheel tick, from the pointer's cell. shortcut: a desktop column is taken as 8 px, as W assumes.
// shortcut: a desktop row is the code font's line height, about 20 px measured; read it from the surface if one ever reports it.
export const ROW_PX = 20
// The desktop sends the wheel only while the pane has rows to scroll: a parked pane is two rows taller than its window,
// the window held on row 1, and every tick scrolls the card under the pointer instead.
let paneParked = false
let paneRow = 0
export const cardAt = (rects: readonly CardRect[], column: number, row: number): CardRect | undefined => {
  const x = column * 8
  const y = row * ROW_PX
  return rects.find(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
}
const PHASES: readonly Phase[] = ['plan', 'design', 'delegate', 'review', 'close']
const TIERS: readonly string[] = ['fable', 'heavy', 'careful', 'medium', 'light']
// The tools' schemas are advice to the model, not a check: what a call may ask
// the band and the panel to draw is bounded here.
const MAX_TASKS = 200
const MAX_AFTER = 20
const MAX_TITLE = 120
const ACCENT = '#8f8cf4'
const DONE = '#3B9C5F'

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
    mainSession: 'Main session',
    more: 'more',
    isFailed: 'failed',
    kit: 'Skills & plugins',
    kitEmpty: 'No skills or plugins seen yet.',
    noTasks: 'No task list yet.',
    active: 'active',
    notActive: 'not active',
    hideout: 'Hideout',
    home: 'home',
    out: 'out',
    tier: { light: 'light', medium: 'medium', careful: 'careful', heavy: 'heavy', fable: 'fable', other: 'other' },
    effort: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
  },
  ru: {
    pane: 'Агенты',
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
    mainSession: 'Основная сессия',
    more: 'ещё',
    isFailed: 'сбой',
    kit: 'Навыки и плагины',
    kitEmpty: 'Навыков и плагинов пока нет.',
    noTasks: 'Списка задач пока нет.',
    active: 'активны',
    notActive: 'не активны',
    hideout: 'Убежище',
    home: 'дома',
    out: 'в деле',
    tier: { light: 'light', medium: 'medium', careful: 'careful', heavy: 'heavy', fable: 'fable', other: 'other' },
    effort: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
  },
  he: {
    pane: 'סוכנים',
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
    mainSession: 'סשן ראשי',
    more: 'נוספים',
    isFailed: 'נכשל',
    kit: 'מיומנויות ותוספים',
    kitEmpty: 'עדיין אין מיומנויות או תוספים.',
    noTasks: 'עדיין אין רשימת משימות.',
    active: 'פעילים',
    notActive: 'לא פעילים',
    hideout: 'מחבוא',
    home: 'בבית',
    out: 'בחוץ',
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
// A run's, job's or task's status as words, for alt text.
const statusWord = (status: string): string => {
  const s = tr()
  if (status === 'running' || status === 'in_progress') return s.isRunning
  if (status === 'failed') return s.isFailed
  return status === 'done' || status === 'completed' ? s.isFinished : s.isPlanned
}

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

// Tool input comes from the model, whatever its schema says: a field of the wrong type reads as absent.
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

const isNewFlow = (prev: Flow | null, input: ProgressInput): boolean =>
  !prev || prev.isFinished || (typeof input.title === 'string' && clip(input.title.trim(), MAX_TITLE) !== prev.title)

// Only a known tier is kept: the name is later a key into the tier tables.
const tierName = (v: string): string => {
  const t = v.replace(/^savvy-/, '').trim().toLowerCase()
  return TIERS.includes(t) ? t : ''
}

const cleanTasks = (tasks: unknown): PlannedTask[] | undefined =>
  Array.isArray(tasks)
    ? tasks
        .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null && str(t.title).trim() !== '')
        .slice(0, MAX_TASKS)
        .map(t => ({
          title: str(t.title).trim(),
          tier: tierName(str(t.tier)),
          after: (Array.isArray(t.after) ? t.after : []).filter((n): n is number => Number.isInteger(n) && n > 0).slice(0, MAX_AFTER),
        }))
    : undefined

const merge = (prev: Flow | null, input: ProgressInput): Flow => {
  // A new title means a new flow: never carry counters over from an earlier one.
  const base = isNewFlow(prev, input) || !prev ? blank() : { ...blank(), ...prev }
  const tasks = cleanTasks(input.tasks) ?? base.tasks
  const total = Math.min(MAX_TASKS, Math.max(0, Math.round(num(input.total) ?? (Array.isArray(input.tasks) ? tasks.length : base.total))))
  const done = Math.min(total || Infinity, Math.max(0, Math.round(num(input.done) ?? base.done)))
  const phase = input.phase && PHASES.includes(input.phase) ? input.phase : base.phase
  return {
    ...base,
    title: clip(str(input.title).trim() || base.title, MAX_TITLE),
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

// The grey tones every drawing shares, light and dark: text (t), second lines (s), tertiary text (m),
// bar tracks (k), hairlines (ln), tertiary strokes (ms) and tiles.
const TOKENS = `.t{fill:#1f1f1f}.s{fill:#4f4f4c}.m{fill:#6b6b68}.k{fill:#e4e4e2}.ln{stroke:#e4e4e1}.ms{stroke:#6b6b68}.tile{fill:#f4f3f0}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#bcbcb8}.m{fill:#9a9a96}.k{fill:#2c2c2c}.ln{stroke:#333331}.ms{stroke:#9a9a96}.tile{fill:#262625}}`

// The pixel bar, the band's rows: a dithered fill,
// sparse at the start and dense toward the head, a faint layer for work handed out,
// ticks between tasks, and a pill with the count riding the head. Pixels twinkle in
// four out-of-phase groups; a calm bar (finished) settles to a slow glow.
// A calm bar's pixels take classes and a keyframe of their own (g0..g3, gw): the band nests two
// rows in one drawing, where one shared name would take the last row's timing for both.
const BAR_CSS = (isCalm: boolean): string => {
  const c = isCalm ? 'g' : 't'
  return `<style>
${TOKENS}.tk{fill:#b4b4b0}
@media (prefers-color-scheme: dark){.tk{fill:#5a5a5a}}
.${c}0,.${c}1,.${c}2,.${c}3{animation:${c}w ${isCalm ? 3.2 : 2.2}s ease-in-out infinite}
.${c}1{animation-duration:${isCalm ? 3.8 : 2.8}s;animation-delay:-.7s}.${c}2{animation-duration:${isCalm ? 4.4 : 1.9}s;animation-delay:-1.3s}.${c}3{animation-duration:${isCalm ? 3.5 : 3.3}s;animation-delay:-.4s}
@keyframes ${c}w{0%,100%{opacity:1}50%{opacity:${isCalm ? 0.8 : 0.3}}}
@media (prefers-reduced-motion: reduce){.${c}0,.${c}1,.${c}2,.${c}3{animation:none}}
</style>`
}

type BarOptions = { run?: number; ticks?: number; rtl?: boolean; calm?: boolean }

// barGroup is pure: the band redraws the same bars every second, so the last few are kept.
const barMemo = new Map<string, string>()

// One bar, drawn at (0, 0) and BAR_W by barH: place it with a translate. `id` keeps its
// clip path its own, since several bars share one drawing.
export const barGroup = (id: string, BAR_W: number, barH: number, fill: number, color: string, pill: string, o: BarOptions = {}): string => {
  const key = JSON.stringify([id, BAR_W, barH, fill, color, pill, o.run, o.ticks, o.rtl, o.calm])
  const hit = barMemo.get(key)
  if (hit !== undefined) return hit
  if (barMemo.size > 32) barMemo.clear()
  const out = drawBar(id, BAR_W, barH, fill, color, pill, o)
  barMemo.set(key, out)
  return out
}

const drawBar = (id: string, BAR_W: number, barH: number, fill: number, color: string, pill: string, o: BarOptions): string => {
  const ratioOf = (r: number) => Math.max(0, Math.min(1, r))
  const cls = o.calm ? 'g' : 't'
  const fillW = Math.round(BAR_W * ratioOf(fill))
  const runW = Math.round(BAR_W * ratioOf(o.run ?? 0))
  const bx = (x: number, w: number): number => (o.rtl ? BAR_W - x - w : x)
  const cols = Math.floor(fillW / CELL)
  const rows = Math.floor(barH / CELL)
  const dots: string[] = []
  for (let c = 0; c < cols; c++) {
    const density = 0.35 + 0.6 * Math.pow(c / Math.max(1, cols), 1.2)
    for (let r = 0; r < rows; r++) {
      if (noise(c, r) < density) dots.push(`<rect class="${cls}${Math.floor(noise(r, c) * 4)}" x="${bx(c * CELL + 1, 2)}" y="${r * CELL + 1}" width="2" height="2"/>`)
    }
  }
  const faint: string[] = []
  for (let c = cols; c < Math.floor(runW / CELL); c++) {
    for (let r = 0; r < rows; r++) {
      if (noise(c + 7, r + 3) < 0.2) faint.push(`<rect class="${cls}${Math.floor(noise(r + 5, c) * 4)}" x="${bx(c * CELL + 1, 1.7)}" y="${r * CELL + 1}" width="1.7" height="1.7"/>`)
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
<text x="${pillX + pillW / 2}" y="${barH / 2 + 4}" text-anchor="middle"${o.rtl ? ' direction="rtl"' : ''} font-family="${FONT}" font-size="11" font-weight="600" fill="${color === LOW ? '#ffffff' : INK}">${xml(pill)}</text>`
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
<text class="t" ${titleAt} y="${H / 2 + 4.5}" font-family="${FONT}" font-size="13" font-weight="600">${xml(title)}</text>
<g transform="translate(${rx(BAR_X, BAR_W)},${y0})">${barGroup('flow', BAR_W, BAR_H, ratio(f), color, label(f), { run, ticks: f.total, rtl, calm: f.isFinished })}</g>
<text class="m" ${percentAt} font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${percent}</text>
${CRAB_CSS}${crab(rx(W - CRAB_W + 1, crabW), 0, 'king', false, isWorking, 0.8, rtl)}
</svg>`
}

// The band's USAGE row, laid out as the FLOW row is: the plan windows ribbon reads
// (7-day, 5-hour) share the row's width, each a pixel bar of what is left.
const USAGE_COLOR: Record<string, string> = { seven_day: '#D97757', five_hour: '#E0B34A' }
const LOW = '#D0453F'
// A failed run, job or step: the same red as a window running low.
const FAIL = LOW
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
  // Mirrored in Hebrew as the FLOW row is: each box across the row (`rx`), each bar inside itself.
  const rtl = isRtl()
  const rx = (x: number, w: number): number => (rtl ? W - x - w : x)
  const right = W - CRAB_W - 6
  const GAP = 18
  const seg = (right - 16 - GAP * (ws.length - 1)) / Math.max(1, ws.length)
  const body = ws.map((w, i) => {
    const left = Math.max(0, Math.min(100, Math.round(100 - w.percentUsed)))
    const color = left < 20 ? LOW : (USAGE_COLOR[w.kind] ?? ACCENT)
    const x = 16 + i * (seg + GAP)
    const name = windowName(w.kind)
    const reset = resetIn(w.resetsAt, at)
    const nameW = Math.round(textWidth(name, 11) + 8)
    const resetW = reset ? Math.round(textWidth(reset, 11) + 8) : 0
    const barW = Math.max(40, seg - nameW - resetW)
    return `<text class="s" ${rtl ? `x="${W - x}" text-anchor="end"` : `x="${x}"`} y="${H / 2 + 4.5}" font-family="${FONT}" font-size="11" font-weight="600" letter-spacing=".4">${name}</text>
<g transform="translate(${rx(x + nameW, barW)},${(H - BAR_H) / 2})">${barGroup(`u-${w.kind}`, barW, BAR_H, left / 100, color, `${left}%`, { rtl })}</g>
${reset ? `<text class="m" ${rtl ? `x="${W - x - seg}"` : `x="${x + seg}" text-anchor="end"`} y="${H / 2 + 4.5}" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${reset}</text>` : ''}`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${BAR_CSS(false)}
<circle cx="${rtl ? W - 5 : 5}" cy="${H / 2}" r="4" class="m"/>
${body.join('')}
</svg>`
}

// The band above the prompt, in the panel's look: one card holding the FLOW row (the
// savvy-flow plan) and the USAGE row (ribbon's plan windows), each bar filling its row.
// ribbon and ponytail draw their own rows beneath this one; once they ran (next.trace)
// this band stands in for them, so their rows are dropped.
const BAND_PAD = 8
const BAND_GAP = 6
const BAND_CSS = `<style>${TOKENS}</style>`
export const bandHeight = (rows: number): number => BAND_PAD * 2 + rows * H + (rows - 1) * BAND_GAP
export const bandSvg = (W: number, rows: readonly string[]): string => {
  const BH = bandHeight(rows.length)
  const inner = rows.map((r, i) => `<svg x="${BAND_PAD}" y="${BAND_PAD + i * (H + BAND_GAP)}" width="${W - BAND_PAD * 2}" height="${H}" overflow="visible">${r.replace(/^<svg[^>]*>|<\/svg>\s*$/g, '')}</svg>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${BH}" viewBox="0 0 ${W} ${BH}">${BAND_CSS}
<rect class="tile ln" x="0.5" y="0.5" width="${W - 1}" height="${BH - 1}" rx="10" stroke-width="1"/>
${inner.join('\n')}
</svg>`
}

// The terminal's bar: the band's block bar.
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
const quadOf = (u: Usage): Quad => [u.input_tokens || 0, u.output_tokens || 0, u.cache_read_input_tokens || 0, u.cache_creation_input_tokens || 0]

const costParts = (model: string, u: Usage, isRequest: boolean): Quad => {
  const [i, o, r, w] = quadOf(u)
  const [pi, po, pr, pw] = priceOf(model, isRequest ? i + r + w : 0)
  return [(i * pi) / 1e6, (o * po) / 1e6, (r * pr) / 1e6, (w * pw) / 1e6]
}

const addQuad = (a: Quad, b: Quad): Quad => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]]

const costOf = (model: string, u: Usage, isRequest: boolean): number => costParts(model, u, isRequest).reduce((a, b) => a + b, 0)

// One more model request added to a split; a turn's sum (`isRequest` false) at the model's ordinary prices.
export const addRequest = (s: Split, model: string, u: Usage, isRequest = true): Split => ({
  model,
  requests: s.requests + 1,
  tokens: addQuad(s.tokens, quadOf(u)),
  usd: addQuad(s.usd, costParts(model, u, isRequest)),
})

const sum = (q: readonly number[]): number => q.reduce((a, b) => a + b, 0)

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

// The whole session: the main session's own figures (what the engine reports as its cost and
// start, the tokens summed here) plus the subagents. With no session figures, the subagents alone.
// Subagent tokens and cost come from `sub`, every request summed, so they hold when the list is reset or trimmed.
export type SessionFigures = { costUsd?: number; startedAt?: number; tokens?: number }
export const totals = (list: AgentRun[], at: number, session: SessionFigures = {}, sub: Split = NO_SPLIT) => {
  const subCost = sum(sub.usd)
  const tokens = sum(sub.tokens) + (session.tokens ?? 0)
  const start = Math.min(...list.map(a => a.startedAt), session.startedAt || Infinity)
  // The session runs until now; subagents alone stop the clock when the last one ends.
  const end = Math.max(session.startedAt ? at : -Infinity, ...list.map(a => a.endedAt ?? Math.max(at, a.startedAt)))
  // The engine's session cost already holds the subagents; it can lag a step behind this plugin's own sum.
  return { cost: Math.max(session.costUsd ?? 0, subCost), tokens, time: Number.isFinite(start) ? Math.max(0, end - start) : 0 }
}

// --- desktop drawings: each row is one SVG, as the band above the prompt is.

// The pane's backdrop: a dotted grid as tall as the content laid over it; the
// row SVGs are transparent, so it shows through between their marks.
const GRID_STEP = 16
// The engine refuses an Svg taller than 4096px, so a long grid is stacked from
// tiles of at most this height; a multiple of GRID_STEP keeps the dots aligned.
const GRID_TILE = 4096
const gridTiles = (H: number) => Array.from({ length: Math.ceil(H / GRID_TILE) }, (_, i) => Math.min(GRID_TILE, H - i * GRID_TILE))
const gridSvg = (W: number, H: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>.d{fill:#d9d8d4}@media (prefers-color-scheme: dark){.d{fill:#3a3a38}}</style>
<defs><pattern id="g" width="${GRID_STEP}" height="${GRID_STEP}" patternUnits="userSpaceOnUse"><circle class="d" cx="${GRID_STEP / 2}" cy="${GRID_STEP / 2}" r="1"/></pattern></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
</svg>`

// The border of the panel's section cards and tooltips: a theme key, so it reads in light and dark.
const EDGE = 'subtle'

const PANE_CSS = `<style>
${TOKENS}
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
@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}
.f2,.q2,.q3,.q4{opacity:0}
.run .f1{animation:fa .5s steps(1) infinite}.run .f2{animation:fb .5s steps(1) infinite}
@keyframes fa{50%{opacity:0}}@keyframes fb{50%{opacity:1}}
.run .q1,.run .q2,.run .q3,.run .q4{animation:q 1s steps(1) infinite}
.run .q2{animation-delay:-.75s}.run .q3{animation-delay:-.5s}.run .q4{animation-delay:-.25s}
@keyframes q{0%{opacity:1}25%,100%{opacity:0}}
.c-king.run .la,.c-king.run .lb,.c-king.run .bd{animation:none}
.c-king.run .f1,.c-king.run .f2{animation-duration:1s}
.c-fable.run,.c-light.run,.c-heavy.run{animation:float 1s steps(2) infinite}
.c-fable.run .la,.c-fable.run .lb,.c-fable.run .bd,.c-light.run .la,.c-light.run .lb,.c-light.run .bd,.c-heavy.run .la,.c-heavy.run .lb,.c-heavy.run .bd{animation:none}
@keyframes float{50%{transform:translateY(-2px)}}
@media (prefers-reduced-motion: reduce){.run,.run g{animation:none!important}}
</style>`

// A caster's particles: frame k (q1..q4) lights the points in spots[k], the first of each in
// `bright`, the rest in `dim`, each with a dim pixel trailing below it.
const motes = (f: Fill, spots: [number, number][][], bright: string, dim: string): void =>
  spots.forEach((pts, k) =>
    pts.forEach(([x, y], i) => {
      f(x, y, 1, 1, i === 0 ? bright : dim, `q${k + 1}`)
      if (y + 1 < 28) f(x, y + 1, 1, 1, dim, `q${k + 1}`)
    }),
  )

// The eyes' glint, moved a pixel to show where the crab looks.
const glance = (f: Fill, dx: number, dy: number, cls: string): void => {
  f(9 + dx, 12 + dy, 1, 1, '#FFFFFF', cls)
  f(19 + dx, 12 + dy, 1, 1, '#FFFFFF', cls)
}

// One class costume per role, original pixel art. Motion is sprite frames: `f1`/`f2` swap every half second, `q1`..`q4` step through four
// quarters of a second; the first frame shows at rest. Casters float while they work, with particles
// of their school around them; the planner stands still. Each costume keeps its own palette and never paints CLAY (only a claw that moves with
// the frames does), so any shell tint fits any costume, whatever the routing.
const COSTUMES: Record<string, (f: Fill) => void> = {
  // King: Tactician, the main session. Shaggy brown hair, a campaign map held in both claws; the eyes
  // move over the map and the red mark moves to the next objective.
  king: f => {
    crabBody(f)
    stamp(f, 7, 5, ['..h.hh..hh.h.h..', '.hhhhhhhhhhhhhh.', 'hhhhhhhhhhhhhhhh', 'hdhhdhhhhdhhdhhh', 'h.hh.h.hh.h.hh.h'], { h: '#5A3A22', d: '#3E2716' })
    stamp(f, 5, 15, ['eppppppppppppppppppe', 'eplllpppppplppppllpe', 'epppplpppplplppppppe', 'eppppplllllpplllpppe', 'eppppppppppppppppppe'], { p: '#E8D9B0', l: '#8A6A3A', e: '#C9B48A' })
    stamp(f, 8, 16, ['r.r', '.r.', 'r.r'], { r: '#C4302B' }, 'f1')
    stamp(f, 17, 16, ['r.r', '.r.', 'r.r'], { r: '#C4302B' }, 'f2')
    glance(f, 0, 1, 'f1'); glance(f, 1, 1, 'f2')
  },
  // Explore: Pathfinder. Short blonde hair, a bow slung on the back, a claw shading the eyes; walks
  // and looks one way, then the other.
  explore: f => {
    crabBody(f, -4)
    stamp(f, 7, 6, ['...hhhhhhhhhh...', '.hhhhhhhhhhhhhh.', 'hhhhhhhhhhhhhhhh', 'hh.hhh.hhhh.h.hh'], { h: '#E2C46A' })
    f(9, 7, 3, 1, '#B8963E'); f(16, 8, 3, 1, '#B8963E')
    f(5, 6, 1, 12, '#8A5A2B'); f(6, 7, 1, 10, '#D9D4C7')
    for (let i = 0; i < 6; i++) f(9 + i * 2, 15 + i, 2, 1, '#6B4A2B')
    glance(f, 0, 0, 'f1'); glance(f, 1, 0, 'f2')
  },
  // Light: Ritualist. A deep blue hood edged in glowing runes; stands and casts, one rune after another
  // flaring over the raised claw.
  light: f => {
    crabBody(f, -4)
    stamp(f, 6, 4, ['......kkkkkk......', '....kkkkkkkkkk....', '...kkkkkkkkkkkk...', '..kkkkkkkkkkkkkk..', '..kkkkkkkkkkkkkk..', '.bbbbbbbbbbbbbbbb.', '.kk............kk.', '.k..............k.'], { k: '#1E2433', b: '#3E6FB0' })
    f(14, 16, 2, 2, '#3E6FB0')
    stamp(f, 23, 3, ['..r..', '.r.r.', 'r.r.r', '.r.r.', '..r..'], { r: '#5FD0FF' }, 'f1')
    stamp(f, 23, 3, ['r.r.r', '.rrr.', 'rr.rr', '.rrr.', 'r.r.r'], { r: '#9FE6FF' }, 'f2')
    f(14, 16, 2, 2, '#9FE6FF', 'f2')
    // Rune motes drift up both sides.
    motes(f, [[[2, 19], [28, 21]], [[2, 16], [28, 18]], [[1, 13], [29, 15]], [[2, 10], [28, 12]]], '#5FD0FF', '#3E6FB0')
  },
  // Medium: Gladiator. A crested bronze helm and a buckler; the sword is raised, then swung through.
  medium: f => {
    crabBody(f, -4, 'f1')
    stamp(f, 6, 3, ['........cc........', '.......cccc.......', '....bbbbbbbbbb....', '..bbbbbbbbbbbbbb..', '.bbbbbbbbbbbbbbbb.', '.bbdbbbbbbbbbbdbb.', 'dddddddddddddddddd', '.bb............bb.', '.bb............bb.'], { c: '#C4302B', b: '#B8863B', d: '#7A5524' })
    stamp(f, 2, 13, ['.bbb.', 'bbobb', '.bbb.'], { b: '#8A5A2B', o: '#C9A227' })
    f(25, 2, 1, 7, '#D9DCE3', 'f1'); f(24, 9, 3, 1, '#C9A227', 'f1')
    f(23, 14, 4, 4, CLAY, 'f2'); f(26, 13, 1, 1, '#C9A227', 'f2')
    f(27, 12, 1, 1, '#D9DCE3', 'f2'); f(28, 11, 1, 1, '#D9DCE3', 'f2'); f(29, 10, 1, 1, '#D9DCE3', 'f2')
    f(22, 3, 1, 1, '#FFFFFF', 'f2'); f(24, 2, 2, 1, '#FFFFFF', 'f2'); f(27, 3, 1, 1, '#FFFFFF', 'f2'); f(28, 5, 1, 2, '#FFFFFF', 'f2')
  },
  // Careful: Martial Artist. Shaved head with a dark topknot, tattoos and wrapped claws; the quarterstaff
  // is held upright, then struck across with a spark where it lands.
  careful: f => {
    crabBody(f)
    stamp(f, 13, 5, ['.kk.', 'kkkk', '.kk.', '.kk.', '.kk.'], { k: '#2B2724' })
    f(8, 10, 5, 1, '#6E6A66'); f(17, 10, 5, 1, '#6E6A66')
    f(8, 16, 1, 2, '#203A70'); f(21, 16, 1, 2, '#203A70')
    f(3, 15, 4, 1, '#E8E4D8'); f(23, 15, 4, 1, '#E8E4D8')
    f(27, 2, 1, 19, '#8A5A2B', 'f1'); f(27, 2, 1, 1, '#C9A227', 'f1'); f(27, 20, 1, 1, '#C9A227', 'f1')
    for (let i = 0; i < 9; i++) f(21 + i, 3 + i * 2, 1, 2, i === 0 || i === 8 ? '#C9A227' : '#8A5A2B', 'f2')
    f(20, 1, 1, 1, '#FBE08A', 'f2'); f(22, 1, 1, 1, '#FBE08A', 'f2'); f(19, 3, 1, 1, '#FBE08A', 'f2')
  },
  // Heavy: Stormweaver. Long dark hair lit violet; stands and casts, sparks gathering at the claw, then
  // a bolt striking down.
  heavy: f => {
    crabBody(f, -4)
    stamp(f, 6, 5, ['....kkkkkkkkkk....', '..kkkkkkkkkkkkkk..', '.kkkpkkkkkkkkpkkk.', '.kkkkkkkkkkkkkkkk.', 'kkk............kkk', 'kk..............kk', 'k.................', 'k.................', 'p.................'], { k: '#2A1F3D', p: '#7A4FD0' })
    f(7, 19, 16, 1, '#7A4FD0')
    f(24, 8, 1, 1, '#C9A8FF', 'f1'); f(27, 7, 1, 1, '#C9A8FF', 'f1'); f(26, 5, 1, 1, '#9B6BFF', 'f1')
    stamp(f, 24, 0, ['..b', '..b', '.b.', '.b.', '..b', '...b', '..b', '.b.', '.b.'], { b: '#F1E6FF' }, 'f2')
    f(23, 9, 1, 1, '#9B6BFF', 'f2'); f(28, 9, 1, 1, '#9B6BFF', 'f2'); f(28, 3, 1, 1, '#9B6BFF', 'f2')
    // Static crackles at a new spot each quarter second.
    motes(f, [[[1, 9], [5, 22]], [[3, 6], [28, 18]], [[0, 15], [27, 22]], [[4, 3], [29, 15]]], '#E3D2FF', '#7A4FD0')
  },
  // Fable: Chronomancer. Silver hair under a dark circlet; floats, a clock face over the raised claw
  // with its hand sweeping round each second.
  fable: f => {
    crabBody(f, -4)
    stamp(f, 7, 5, ['...ssssssssss...', '.ssssssssssssss.', 'ssssssssssssssss', 'kkkkkkkbbkkkkkkk', 's.ss.sss.ss.ss.s'], { s: '#D8DDE6', k: '#2E3440', b: '#4A7BD8' })
    stamp(f, 23, 1, ['..ccc..', '.c...c.', 'c.....c', 'c.....c', 'c.....c', '.c...c.', '..ccc..'], { c: '#9FD3FF' })
    f(26, 4, 1, 1, '#C9A227')
    f(26, 2, 1, 2, '#E6F0FF', 'q1'); f(27, 4, 2, 1, '#E6F0FF', 'q2'); f(26, 5, 1, 2, '#E6F0FF', 'q3'); f(24, 4, 2, 1, '#E6F0FF', 'q4')
    // Motes of time circle the crab, a quarter turn each quarter second.
    motes(f, [[[12, 2], [17, 26]], [[28, 17], [1, 9]], [[17, 26], [12, 2]], [[1, 9], [28, 17]]], '#E8C55A', '#9FD3FF')
  },
  // Other: the Exile, washed ashore in rags, for tasks, skills, background jobs and any agent no class
  // fits; the loose ends flap.
  other: f => {
    crabBody(f)
    f(7, 10, 16, 2, '#8B7D6B'); f(12, 10, 2, 1, '#6E6252')
    f(8, 12, 1, 1, '#8B7D6B'); f(13, 12, 2, 1, '#8B7D6B'); f(17, 12, 1, 1, '#8B7D6B')
    f(16, 17, 3, 2, '#6E6252'); f(17, 17, 1, 1, '#8B7D6B')
    f(3, 10, 4, 1, '#8B7D6B', 'f1'); f(4, 11, 2, 1, '#6E6252', 'f1')
    f(3, 11, 4, 1, '#8B7D6B', 'f2'); f(2, 12, 2, 1, '#6E6252', 'f2')
  },
}

// A costume by task first, then by model. A savvy worker keeps its tier's. A searcher or Explore is
// the Pathfinder, an editor the Martial Artist, a reviewer the Stormweaver; any other agent dresses
// for the task its description names, else for the model it runs on (Fable Chronomancer, Opus
// Martial Artist, Sonnet Gladiator, Haiku Ritualist), else as the Exile.
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
export const crab = (x: number, y: number, costume: string, dim = false, isWalking = false, scale = CRAB_SCALE, mirror = false, tint?: string): string => {
  const groups = new Map<string, string[]>([['bd', []]])
  const f: Fill = (cx, cy, w, h, c, cls = 'bd') => {
    if (!groups.has(cls)) groups.set(cls, [])
    groups.get(cls)?.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${c}"/>`)
  }
  const draw = COSTUMES[costume] ?? COSTUMES.other ?? ((g: Fill) => crabBody(g))
  draw(f)
  const group = (cls: string) => `<g class="${cls}">${(groups.get(cls) ?? []).join('')}</g>`
  const props = [...groups.keys()].filter(k => k !== 'bd' && k !== 'la' && k !== 'lb')
  const body = `<g class="bd">${(groups.get('bd') ?? []).join('')}${props.map(group).join('')}</g>`
  const place = mirror ? `translate(${x + CRAB_BOX * scale},${y}) scale(${-scale},${scale})` : `translate(${x},${y}) scale(${scale})`
  const out = `<g transform="${place}" opacity="${dim ? 0.45 : 1}" shape-rendering="crispEdges"><g class="c-${costume}${isWalking ? ' run' : ''}">${body}${group('la')}${group('lb')}</g></g>`
  return tint ? out.replaceAll(`fill="${CLAY}"`, `fill="${tint}"`) : out
}

const statusMark = (x: number, y: number, status: string, color: string): string => {
  if (status === 'running') return `<circle class="live" cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`
  if (status === 'done') return `<path d="M${x - 5} ${y}l3.5 3.5 6.5-7" fill="none" stroke="${DONE}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  if (status === 'failed') return `<path d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" stroke="${FAIL}" stroke-width="1.8" stroke-linecap="round"/>`
  return `<circle class="ms" cx="${x}" cy="${y}" r="5" fill="none" stroke-width="1.4"/><path class="ms" d="M${x} ${y - 2.5}v2.8l1.8 1.2" fill="none" stroke-width="1.4" stroke-linecap="round"/>`
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
const rowCrab = (W: number, x: number, y: number, costume: string, dim = false, isWalking = false, tint?: string): string =>
  crab(mx(W, x, crabWidth(CRAB_SCALE)), y, costume, dim, isWalking, CRAB_SCALE, isRtl(), tint)

// The crab's shell colour by model: Haiku grey, Sonnet blue, Opus yellow, Fable orange.
const SHELL_TINT: [RegExp, string][] = [
  [/fable|mythos/i, '#C27A2E'],
  [/opus/i, '#E6CC3E'],
  [/sonnet/i, '#7B7BF0'],
  [/haiku/i, '#C8C8C0'],
]
export const modelTint = (model: string): string | undefined => SHELL_TINT.find(([re]) => re.test(model))?.[1]

const svg = (W: number, H: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${PANE_CSS}${CRAB_CSS}${body}</svg>`

// The task's own progress when the worker reports steps; a finished run is full.
const progressOf = (a: AgentRun): number | null => {
  if (a.status === 'done') return 1
  if (a.stepTotal) return Math.min(1, (a.stepDone ?? 0) / a.stepTotal)
  return null
}

const ctxOf = (a: AgentRun): number => (a.contextMax ? Math.min(100, Math.round((a.contextTokens / a.contextMax) * 100)) : 0)

// The tool calls a row stands for: a subagent's by its agentId, a task's as the main session's calls
// made while it was in progress. Pending tasks and unknown agents have none.
export const callsOf = (list: readonly WorkItem[], who: string | undefined, from = -Infinity, to = Infinity): WorkItem[] =>
  who ? list.filter(w => w.who === who && w.at >= from && w.at <= to) : []

// One row for every kind of work (a subagent, a background job, a task, a planned step), drawn alike:
// the crab, the title with its status mark, a line of tag and meta with the numbers on its right, and a bar.
const ROW_H = 58
type RowSpec = {
  crab: string
  title: string
  tag: string
  color: string
  meta: string
  stats: string
  /** The bar's fill, 0 to 1; null draws it grey at `grey` (the context when no steps are reported). */
  fill: number | null
  grey?: number
  status: string
  dim?: boolean
}
// Room on the title line for the row's call-list toggle, laid over the drawing.
const TOGGLE_W = 56
const workRowSvg = (W: number, r: RowSpec, hasToggle = false): string => {
  const textW = W - 42 - 22 - (hasToggle ? TOGGLE_W : 0)
  const barW = W - 42
  // The numbers take at most 60% of the line, so the tag and meta keep at least 40%.
  const stats = r.stats ? fitText(r.stats, 11, barW * 0.6 - 12) : ''
  const statsW = stats ? textWidth(stats, 11) + 12 : 0
  const left = fitText(`${r.tag}${r.meta ? ` · ${r.meta}` : ''}`, 11, Math.max(40, barW - statsW))
  const fillW = Math.round(barW * Math.max(0, Math.min(1, r.fill ?? r.grey ?? 0)))
  return svg(
    W,
    ROW_H,
    `${r.crab}
<text class="${r.dim ? 's' : 't'}" ${startText(W, 42, 17)} font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(r.title, 13, textW))}</text>
<text class="s" ${startText(W, 42, 34)} font-family="${FONT}" font-size="11">${xml(left)}</text>
${stats ? `<text class="s" ${endText(W, W, 34)} font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${xml(stats)}</text>` : ''}
<rect class="k" x="${mx(W, 42, barW)}" y="44" width="${barW}" height="4" rx="2"/>${fillW > 0 ? `<rect${r.fill === null ? ' class="m"' : ''} x="${mx(W, 42, fillW)}" y="44" width="${fillW}" height="4" rx="2"${r.fill === null ? '' : ` fill="${r.color}"`}/>` : ''}
${statusMark(mx(W, W - 10), 14, r.status, r.color)}
<line class="ln" x1="0" y1="${ROW_H - 0.5}" x2="${W}" y2="${ROW_H - 0.5}"/>`,
  )
}
const ROW_CRAB_Y = 10

const agentSvg = (W: number, a: AgentRun, at: number, hasToggle = false): string => {
  const s = tr()
  const tier = tierOf(a.type)
  const ctx = ctxOf(a)
  const meta = [runModel(a)]
  if (a.round > 1) meta.push(`${s.round} ${a.round}`)
  if (a.stepTotal) meta.push(`${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' ' + a.stepNote : ''}`)
  if (a.status === 'failed') meta.push(s.failed)
  return workRowSvg(W, {
    crab: rowCrab(W, 0, ROW_CRAB_Y, costumeOf(a), false, a.status === 'running', modelTint(a.model)),
    title: a.description || a.type,
    tag: tier === 'other' ? a.type : tierWord(tier),
    color: colorOf(tier),
    meta: meta.join(' · '),
    stats: [`${s.ctx} ${ctx}%`, fmtTokens(a.contextTokens), `≈${fmtCost(a.costUsd)}`, fmtTime(elapsed(a, at))].join(' · '),
    fill: progressOf(a),
    grey: ctx / 100,
    status: a.status,
  }, hasToggle)
}

const plannedSvg = (W: number, p: Planned): string => {
  const tier = p.tier in TIER_COLOR ? p.tier : 'other'
  const meta = [tierModel(tier)]
  if (p.after.length) meta.push(`${tr().after} ${p.after.join(', ')}`)
  return workRowSvg(W, {
    crab: rowCrab(W, 0, ROW_CRAB_Y, tier, true, false, modelTint(TIER_MODEL[tier]?.[0] ?? '')),
    title: `${p.n}. ${p.title}`,
    tag: tierWord(tier),
    color: colorOf(tier),
    meta: meta.filter(Boolean).join(' · '),
    stats: '',
    fill: 0,
    status: 'planned',
    dim: true,
  })
}

// A background job: a crab in the job's own colour; the bar fills when it ends.
const bgSvg = (W: number, t: BgTask, at: number): string => {
  const tint = tintOf(t.id)
  return workRowSvg(W, {
    crab: crab(mx(W, 0, crabWidth(CRAB_SCALE)), ROW_CRAB_Y, 'other', false, t.status === 'running', CRAB_SCALE, isRtl(), tint),
    title: t.label,
    tag: t.kind === 'monitor' ? 'monitor' : 'background shell',
    color: tint,
    meta: t.status === 'failed' ? tr().failed : '',
    stats: fmtTime((t.endedAt ?? Math.max(at, t.startedAt)) - t.startedAt),
    fill: t.status === 'running' ? null : 1,
    status: t.status,
  })
}

// A step of the app's task list (update_plan).
const TASK_TINT = '#7FA7D9'
const taskSvg = (W: number, t: Task, n: number, total: number, hasToggle = false): string =>
  workRowSvg(W, {
    crab: crab(mx(W, 0, crabWidth(CRAB_SCALE)), ROW_CRAB_Y, 'other', t.status === 'pending', t.status === 'in_progress', CRAB_SCALE, isRtl(), TASK_TINT),
    title: t.content,
    tag: 'task',
    color: TASK_TINT,
    meta: `${n}/${total}`,
    stats: '',
    fill: t.status === 'completed' ? 1 : 0,
    status: t.status === 'completed' ? 'done' : t.status === 'in_progress' ? 'running' : 'planned',
    dim: t.status === 'pending',
  }, hasToggle)

// --- Live work: how long the main session counts as working after its last action, and the glyph per kind of work.
const LIVE = '#E0B34A'
const LIVE_MS = 90_000
const KIND: Record<WorkKind, [glyph: string, color: string, word: string]> = {
  read: ['◇', '#6AAABD', 'read'],
  edit: ['✎', '#D97757', 'edit'],
  cli: ['❯', '#C76BA8', 'command'],
  search: ['⌕', '#C9A227', 'search'],
  web: ['◎', '#8F8CF4', 'web'],
}

// Background tasks: small crabs, each in its own colour.
const BG_TINTS = ['#4FA3A5', '#8F8CF4', '#5B8DEF', '#C9A227', '#D96BA0', '#7FB069']
const tintOf = (id: string): string => BG_TINTS[[...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % BG_TINTS.length] ?? '#4FA3A5'

// --- Skills and plugins: what the session has loaded or called, each with its own crab.
// Active means used since the main session's last turn ended; the rest are enabled plugins and skills used
// earlier. Their tints are a palette of their own, apart from subagent tiers and tasks.
const SKILL_TINTS = ['#F4D35E', '#EE964B', '#FF6B6B', '#2EC4B6', '#C3B1E1', '#F7A1C4', '#A3E635', '#FDBA74']
const skillTint = (name: string): string =>
  SKILL_TINTS[[...name].reduce((h, ch) => (h * 33 + ch.charCodeAt(0)) >>> 0, 11) % SKILL_TINTS.length] ?? '#F4D35E'
const SKILL_SCALE = 0.7
const SKILL_ROW_H = 38
const SKILL_MAX = 14
// Tools of the app itself and of this plugin are not skills the person added.
const SKIP_SERVERS = /^(ccd_|hideout$|claude_ai_)/

// What a tool call says about a plugin in use, or null for any other call. Skills are counted at skill.prompt.
export const kitOf = (tool: string): [kind: SkillKind, name: string] | null => {
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

// The enabled plugins a hook's added context names: a plugin's command hooks run in the engine's core,
// so the context they add is the only sign of them.
// A hook announces itself at the top of its text; a name deeper in (memory notes, skill lists) is only a mention.
// shortcut: matches by name in the first HEAD characters, so a hook that announces itself later is missed; use the hook's own plugin if the trace ever names it.
const HEAD = 400
export const pluginsIn = (texts: readonly string[], enabled: readonly string[]): string[] =>
  enabled.filter(n => {
    const re = new RegExp(`(^|[^\\w-])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w-]|$)`, 'i')
    return texts.some(t => re.test(t.slice(0, HEAD)))
  })

export type KitRow = { name: string; kind: SkillKind; state: 'active' | 'used' | 'idle'; use?: SkillUse }

// Every skill and plugin to show: used ones newest first, then enabled ones not used yet.
// Active means used since the main session's last turn ended: it goes back to idle when that turn does.
export const kitRowsOf = (uses: readonly SkillUse[], enabled: readonly string[], idleAt: number): KitRow[] => {
  const used = [...uses].sort((a, b) => b.at - a.at).map((u): KitRow => ({ name: u.name, kind: u.kind, state: u.at > idleAt ? 'active' : 'used', use: u }))
  // A skill named plugin:skill counts as use of that plugin.
  const seen = new Set(uses.flatMap(u => [u.name, u.name.split(':')[0] ?? u.name]))
  const idle = enabled.filter(n => !seen.has(n)).sort().map((n): KitRow => ({ name: n, kind: 'plugin', state: 'idle' }))
  return [...used.filter(r => r.state === 'active'), ...used.filter(r => r.state === 'used'), ...idle]
}

export const kitLabel = (name: string): string => {
  const [plugin, skill] = name.split(':')
  if (!skill || !plugin) return name
  return skill === plugin ? skill : `${skill} · ${plugin}`
}

const whoName = (who: string, list: readonly AgentRun[]): string =>
  who === 'main' ? 'main' : (list.find(a => a.agentId === who)?.type ?? 'subagent')

// A skill or plugin in use now (the others sit in the chip grid): its crab walks and its dot is lit.
const kitRowSvg = (W: number, r: KitRow, list: readonly AgentRun[]): string => {
  const tint = skillTint(r.name)
  const kindW = textWidth(r.kind, 11)
  const sub = `now · ${whoName(r.use?.who ?? 'main', list)} · ${r.use?.count ?? 0}×`
  return svg(
    W,
    SKILL_ROW_H,
    `${crab(mx(W, 4, crabWidth(SKILL_SCALE)), 8, 'other', false, true, SKILL_SCALE, isRtl(), tint)}
<text class="t" ${startText(W, 36, 17)} font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(kitLabel(r.name), 13, W - 36 - kindW - 30))}</text>
<text class="s" ${startText(W, 36, 31)} font-family="${FONT}" font-size="11">${xml(fitText(sub, 11, W - 90))}</text>
<text class="m" ${endText(W, W - 22, 17)} font-family="${FONT}" font-size="11">${r.kind}</text>
<circle class="live" cx="${mx(W, W - 10)}" cy="14" r="3.5" fill="${tint}"/>`,
  )
}

// Skills and plugins not active: small chips, two to a row, each row one drawing so the card scrolls through them.
// `top` is the gap above the first row.
const CHIP_H = 24
const CHIP_TOP = 8
const kitIdleSvg = (W: number, pair: readonly KitRow[], top: number): string => {
  const cw = (W - 6) / 2
  return svg(
    W,
    top + CHIP_H,
    pair
      .map((r, i) => {
        const x = i * (cw + 6)
        const y = top + 2
        const w = cw
        return `<rect class="tile ln" x="${mx(W, x, w)}" y="${y + 0.5}" width="${w}" height="${CHIP_H - 4}" rx="10" stroke-width="1"/>
${crab(mx(W, x + 5, crabWidth(0.45)), y + 3, 'other', true, false, 0.45, isRtl(), skillTint(r.name))}
<text class="s" ${startText(W, x + 24, y + 14)} font-family="${FONT}" font-size="11">${xml(fitText(kitLabel(r.name), 11, w - 30))}</text>`
      })
      .join(''),
  )
}

// The main session as a row beside its subagents: what it is on (the task list's current
// step) and the last thing it did.
const MAIN_ROW_H = 62
// The main session's row, always shown: the Tactician in its model's shell, with the model named.
const mainRowSvg = (W: number, step: string, item: WorkItem | undefined, isWorking: boolean, model?: string): string => {
  const s = tr()
  // The head is cut to fit as one line: the name in bold, the model after it.
  const head = fitText(`${s.mainSession}${model ? ` · ${modelName(model)}` : ''}`, 13, W - 70)
  const cut = Math.min(s.mainSession.length, head.length)
  return svg(
    W,
    MAIN_ROW_H,
    `<rect class="tile ln" x="0.5" y="0.5" width="${W - 1}" height="${MAIN_ROW_H - 10}" rx="10" stroke-width="1"/>
${rowCrab(W, 6, 10, 'king', false, isWorking, model ? modelTint(model) : undefined)}
<text ${startText(W, 46, 18)} font-family="${FONT}" font-size="13"><tspan class="t" font-weight="600">${xml(head.slice(0, cut))}</tspan><tspan class="s">${xml(head.slice(cut))}</tspan></text>
<text class="s" ${startText(W, 46, 33)} font-family="${FONT}" font-size="11">${xml(fitText(step || s.noTasks, 11, W - 70))}</text>
${item ? `<text ${startText(W, 46, 46)} font-family="${FONT}" font-size="11"><tspan fill="${KIND[item.kind][1]}">${KIND[item.kind][0]}</tspan><tspan class="m"> ${xml(fitText(item.label, 11, W - 80))}</tspan></text>` : ''}
${isWorking ? `<circle class="live" cx="${mx(W, W - 10)}" cy="14" r="3.5" fill="${LIVE}"/>` : ''}`,
  )
}

// --- The Hideout: the crew's tavern at night, a 3/4 pixel interior on a 16 px grid. Each costume has a seat;
// its crab walks out of the door at the bar end while an agent in that costume is on a job, and back when it ends.
const SCENE_H = 144
const WALL_H = 56
const WALK_MS = 4000
const WOOD = ['#3b2416', '#5e3a22', '#8a5a30', '#b5793f', '#e0a85c'] as const
const STONE = ['#2a2b33', '#4a4d5a', '#6e7284', '#9a9eaf'] as const
// Floor rows from the back wall forward: darker toward the back.
const FLOOR = ['#3d2516', '#432918', '#492d1b', '#4f311d', '#55351f', '#5b3921'] as const
const WARM = '#ffd27a'
const SHADE = '#0000005c'
const BOTTLES = ['#3f7d4a', '#7a2f3a', '#2f5a7a', '#a8862a', '#5b3f7a'] as const
const SEATS = ['king', 'explore', 'light', 'medium', 'careful', 'heavy', 'fable', 'other'] as const
const DOOR = { x: 20, y: 62 }
// The aisle in front of the bar, a step in front of the crabs leaning on it: a crab walks to it, along it, then up to the door.
const BAR_Y = 88
const AISLE_Y = 98

// Pixels as paths, one per run of a fill, with neighbours in a row merged: the scene is thousands of
// pixels and an Svg's source holds at most 131072 characters. Later pixels paint over earlier ones.
const pixels = () => {
  let out = ''
  let fill = ''
  let d = ''
  let run: [number, number, number, number] | null = null
  const endRun = () => {
    if (run) d += `M${run[0]} ${run[1]}h${run[2]}v${run[3]}h-${run[2]}z`
    run = null
  }
  const flush = () => {
    endRun()
    if (d) out += `<path fill="${fill}" d="${d}"/>`
    d = ''
  }
  const px = (x: number, y: number, w: number, h: number, c: string): void => {
    const [rx, ry, rw, rh] = [Math.round(x), Math.round(y), Math.round(w), Math.round(h)]
    if (rw <= 0 || rh <= 0) return
    if (c !== fill) {
      flush()
      fill = c
    }
    if (run && run[1] === ry && run[3] === rh && run[0] + run[2] === rx) run[2] += rw
    else {
      endRun()
      run = [rx, ry, rw, rh]
    }
  }
  return { px, done: () => (flush(), out) }
}
type Px = (x: number, y: number, w: number, h: number, c: string) => void

// A shape of centred rows, `widths` from the top down: round tables, stools, disks.
const centred = (px: Px, cx: number, top: number, widths: readonly number[], c: string): void =>
  widths.forEach((w, k) => px(cx - w / 2, top + k, w, 1, c))
const disk = (px: Px, cx: number, cy: number, r: number, c: string): void =>
  centred(px, cx, cy - r, Array.from({ length: r * 2 }, (_, k) => 2 * Math.round(Math.sqrt(r * r - (k - r + 0.5) ** 2))), c)

type Spot = { x: number; y: number }
// A crab's feet; `z` orders the drawing (a crab behind a table sorts before it, one on a stool after it).
type Seat = Spot & { z: number; isOnStool?: boolean; mug?: Spot & { z: number } }
type TavernLayout = { W: number; barEnd: number; hx: number; t1: Spot; t2: Spot; crate: Spot; barrel: Spot; seats: Record<string, Seat> }

// Wall and floor anchors from the scene width, door and bar on the left (the right in Hebrew, mirrored whole).
const tavernLayout = (W: number): TavernLayout => {
  const barW = Math.max(64, Math.min(136, Math.round((W * 0.22) / 8) * 8))
  const barEnd = 40 + barW
  const hx = Math.max(Math.round(W / 2), barEnd + 40)
  const t1 = { x: Math.round((barEnd + hx - 30) / 2), y: 118 }
  const t2 = { x: Math.round((hx + 30 + W) / 2), y: 128 }
  const crate = { x: hx + 14, y: 102 }
  const barrel = { x: W - 16, y: 98 }
  const onBar = (x: number): Seat => ({ x, y: BAR_Y, z: BAR_Y, mug: { x: x + 7, y: 60, z: 80.5 } })
  // Behind a table only the head and eyes clear its top.
  const behind = (t: Spot, dx: number): Seat => ({ x: t.x + dx, y: t.y - 14, z: t.y - 1, mug: { x: t.x + dx + 5, y: t.y - 15, z: t.y + 0.5 } })
  // By the hearth, but clear of the bar's end in a narrow pane.
  const fableX = Math.max(hx - 48, barEnd + 14)
  return {
    W,
    barEnd,
    hx,
    t1,
    t2,
    crate,
    barrel,
    seats: {
      // The king's mug stands on the map, at the crate's near corner.
      king: { x: hx - 10, y: 100, z: 100, mug: { x: crate.x - 7, y: crate.y - 14, z: crate.y + 0.5 } },
      explore: onBar(58),
      light: onBar(barEnd - 18),
      medium: behind(t1, 2),
      careful: { x: t1.x - 28, y: t1.y - 6, z: t1.y + 2.5, isOnStool: true, mug: { x: t1.x - 7, y: t1.y - 16, z: t1.y + 0.5 } },
      heavy: behind(t2, -2),
      fable: { x: fableX, y: 68, z: 76.5, isOnStool: true, mug: { x: fableX + 11, y: 61, z: 62 } },
      other: { x: hx + 48, y: 74, z: 74, mug: { x: hx + 60, y: 75, z: 75 } },
    },
  }
}

// The stool under a seated crab: its feet rest on the seat, 6 px above the floor.
const stool = (px: Px, cx: number, y: number): void => {
  px(cx - 7, y - 1, 14, 2, SHADE)
  px(cx - 5, y - 7, 1, 6, WOOD[0])
  px(cx + 4, y - 7, 1, 6, WOOD[0])
  px(cx - 1, y - 6, 2, 5, WOOD[0])
  centred(px, cx, y - 10, [8, 12, 12], WOOD[3])
  px(cx - 6, y - 8, 12, 1, WOOD[2])
  px(cx - 3, y - 10, 4, 1, WOOD[4])
}

// A round table seen from above at an angle: the top's ellipse over its own edge, one pedestal.
const TABLE_TOP = [14, 20, 24, 26, 28, 28, 26, 24, 20, 14]
const table = (px: Px, cx: number, y: number): void => {
  px(cx - 13, y - 1, 26, 2, SHADE)
  px(cx - 6, y - 3, 12, 2, WOOD[1])
  px(cx - 2, y - 11, 4, 9, WOOD[0])
  px(cx - 1, y - 11, 1, 9, WOOD[1])
  centred(px, cx, y - 20, TABLE_TOP, WOOD[1])
  centred(px, cx, y - 23, TABLE_TOP, WOOD[3])
  px(cx - 8, y - 22, 9, 1, WOOD[4])
  px(cx - 5, y - 19, 12, 1, WOOD[2])
  px(cx - 9, y - 17, 7, 1, WOOD[2])
}

// The furniture on the floor, each with the y it sorts at among the crabs.
const tavernProps = (L: TavernLayout): { z: number; svg: string }[] => {
  const draw = (z: number, paint: (px: Px) => void) => {
    const p = pixels()
    paint(p.px)
    return { z, svg: p.done() }
  }
  const { barEnd, t1, t2, crate, barrel, seats } = L
  // A narrow pane has no room right of the second table: its stool and the barrel are left out.
  const isRoomy = barrel.x - 9 >= t2.x + 36
  return [
    // The bar counter: its top, then a paneled front with a contact shadow.
    draw(80, px => {
      px(40, 80, barEnd - 40, 3, SHADE)
      px(40, 64, barEnd - 40, 16, WOOD[1])
      for (let x = 46; x < barEnd - 4; x += 12) px(x, 68, 1, 10, WOOD[0])
      px(40, 64, barEnd - 40, 2, WOOD[2])
      px(40, 78, barEnd - 40, 2, WOOD[0])
      px(40, 58, barEnd - 40, 6, WOOD[3])
      px(40, 58, barEnd - 40, 1, WOOD[4])
      px(barEnd - 3, 58, 3, 22, WOOD[2])
    }),
    draw(t1.y, px => table(px, t1.x, t1.y)),
    draw(t2.y, px => table(px, t2.x, t2.y)),
    draw(t1.y + 2, px => stool(px, t1.x - 28, t1.y + 2)),
    draw(76, px => stool(px, seats.fable?.x ?? 0, 76)),
    ...(!isRoomy ? [] : [
      draw(t2.y + 4, px => stool(px, t2.x + 28, t2.y + 4)),
      // The barrel: staves, two iron hoops and a lid seen from above.
      draw(barrel.y, px => {
        const { x, y } = barrel
        px(x - 9, y - 1, 18, 2, SHADE)
        px(x - 7, y - 19, 14, 18, WOOD[2])
        px(x - 8, y - 16, 16, 12, WOOD[2])
        px(x - 3, y - 19, 1, 18, WOOD[1])
        px(x + 3, y - 19, 1, 18, WOOD[1])
        px(x - 6, y - 18, 2, 16, WOOD[3])
        px(x - 8, y - 15, 16, 1, STONE[1])
        px(x - 8, y - 6, 16, 1, STONE[1])
        centred(px, x, y - 22, [8, 12, 14, 12], WOOD[1])
        centred(px, x, y - 21, [6, 10], WOOD[0])
      }),
    ]),
    // The Tactician's crate, the campaign map spread on its lid.
    draw(crate.y, px => {
      const { x, y } = crate
      px(x - 12, y - 1, 24, 2, SHADE)
      px(x - 11, y - 10, 22, 9, WOOD[2])
      px(x - 11, y - 7, 22, 1, WOOD[1])
      px(x - 11, y - 4, 22, 1, WOOD[1])
      px(x - 11, y - 10, 2, 9, WOOD[1])
      px(x + 9, y - 10, 2, 9, WOOD[1])
      px(x - 11, y - 15, 22, 5, WOOD[3])
      px(x - 9, y - 16, 17, 5, '#e8d9b0')
      px(x - 9, y - 12, 17, 1, '#c9b48a')
      px(x - 7, y - 14, 5, 1, '#8a6a3a')
      px(x - 1, y - 16, 1, 3, '#8a6a3a')
      px(x + 3, y - 15, 1, 1, '#c4302b')
      px(x + 5, y - 15, 1, 1, '#c4302b')
      px(x + 4, y - 14, 1, 1, '#c4302b')
    }),
  ]
}

// Wall, floor, wall props and the hearth with its fire; the warm light on them, its edge dithered.
const tavernBack = (L: TavernLayout): string => {
  const { W, barEnd, hx } = L
  const { px, done } = pixels()
  // Floor: plank rows, a seam between rows and plank ends staggered row by row.
  for (let k = 0; WALL_H + k * 16 < SCENE_H; k++) px(0, WALL_H + k * 16, W, 16, FLOOR[k] ?? WOOD[1])
  const ends: Spot[] = []
  for (let k = 0; WALL_H + k * 16 < SCENE_H; k++) {
    for (let x = Math.floor(noise(k, 1) * 40) - 40; x < W; x += 40 + Math.floor(noise(x, k) * 32)) ends.push({ x, y: WALL_H + k * 16 })
  }
  for (const e of ends) px(e.x, e.y + 1, 1, 15, WOOD[0])
  for (let k = 0; WALL_H + k * 16 < SCENE_H; k++) px(0, WALL_H + k * 16, W, 1, WOOD[0])
  for (const e of ends) px(e.x + 5 + Math.floor(noise(e.y, e.x) * 12), e.y + 4 + Math.floor(noise(e.x, e.y) * 9), 6 + Math.floor(noise(e.x + 1, e.y) * 12), 1, '#ffffff12')
  px(0, WALL_H, W, 2, '#1e130b')
  // Back wall: a beam, boards with a lit edge every 16 px, a rail, then a stone base.
  px(0, 0, W, WALL_H, WOOD[1])
  for (let x = 16; x < W; x += 16) px(x, 6, 1, 32, WOOD[0])
  for (let x = 17; x < W; x += 16) px(x, 6, 1, 32, '#6a4428')
  px(0, 0, W, 5, WOOD[0])
  px(0, 5, W, 1, '#24160d')
  px(0, 38, W, 2, WOOD[2])
  px(0, 40, W, 1, WOOD[0])
  px(0, 41, W, 15, STONE[1])
  for (let x = 0; x < W; x += 16) px(x, 41, 1, 7, STONE[0])
  for (let x = 8; x < W; x += 16) px(x, 49, 1, 7, STONE[0])
  px(0, 48, W, 1, STONE[0])
  for (let x = 1; x < W; x += 16) px(x, 41, 8, 1, STONE[2])
  for (let x = 9; x < W; x += 16) px(x, 49, 8, 1, STONE[2])
  // The door at the bar end, in a stone frame.
  px(4, 8, 32, 48, STONE[2])
  px(4, 8, 32, 1, STONE[3])
  px(8, 13, 24, 43, WOOD[2])
  for (const x of [14, 20, 26]) px(x, 13, 1, 43, WOOD[1])
  px(8, 19, 24, 2, STONE[0])
  px(8, 46, 24, 2, STONE[0])
  px(27, 32, 2, 3, '#c9a227')
  // The wall between the bar and the hearth, when wide, gets a shelf of its own under the first lantern;
  // right of the hearth, the window with the moon, then the notice board when there is room.
  const left = [barEnd + 8, hx - 38] as const
  const right = [hx + 38, W - 8] as const
  const mid = Math.round((left[0] + left[1]) / 2)
  const wx = Math.round(right[0] + (right[1] - right[0]) / 3)
  const nx = Math.round(right[0] + ((right[1] - right[0]) * 2) / 3)
  // The back bar: shelves of bottles over a rack of kegs.
  px(38, 6, barEnd - 36, 50, '#2a190f')
  const shelves: (readonly [x0: number, x1: number, y: number])[] = [[38, barEnd + 2, 17], [38, barEnd + 2, 30]]
  if (left[1] - left[0] >= 60) shelves.push([mid - 32, mid + 32, 30])
  const bottles: [number, number, string][] = []
  for (const [x0, x1, sy] of shelves) for (let x = x0 + 5; x + 3 <= x1 - 5; x += 5 + Math.floor(noise(x, sy) * 3)) bottles.push([x, sy, BOTTLES[Math.floor(noise(sy, x) * BOTTLES.length)] ?? BOTTLES[0]])
  for (const c of BOTTLES) for (const [x, sy, bc] of bottles) if (bc === c) {
    px(x, sy - 7, 3, 7, c)
    px(x + 1, sy - 9, 1, 2, c)
  }
  for (const [x, sy] of bottles) px(x, sy - 6, 1, 3, '#ffffff4d')
  for (const [x0, x1, sy] of shelves) {
    px(x0, sy, x1 - x0, 2, WOOD[2])
    px(x0, sy + 2, x1 - x0, 1, WOOD[0])
  }
  for (let x = 47; x + 7 <= barEnd - 2; x += 16) {
    disk(px, x, 47, 7, WOOD[1])
    disk(px, x, 47, 5, WOOD[2])
    px(x - 1, 46, 2, 2, WOOD[0])
    px(x - 1, 50, 2, 4, '#c9a227')
  }
  px(38, 54, barEnd - 36, 2, WOOD[0])
  // The hearth: a stone chimney breast, the mantel, the firebox and its two flame frames.
  px(hx - 30, 0, 60, WALL_H, STONE[1])
  for (let y = 0, r = 0; y < WALL_H; y += 7, r++) {
    px(hx - 30, y, 60, 1, STONE[0])
    for (let x = hx - 30 + (r % 2 ? 6 : 0); x < hx + 30; x += 12) px(x, y + 1, 1, 6, STONE[0])
  }
  for (let y = 0, r = 0; y < WALL_H; y += 7, r++) for (let x = hx - 29 + (r % 2 ? 6 : 0); x < hx + 28; x += 12) px(x, y + 1, 5, 1, STONE[2])
  px(hx - 21, 29, 42, 27, STONE[2])
  px(hx - 21, 29, 42, 1, STONE[3])
  px(hx - 18, 33, 36, 23, '#120b0b')
  px(hx - 15, 31, 30, 2, '#120b0b')
  px(hx - 14, 40, 28, 16, '#3b160c')
  px(hx - 10, 46, 20, 10, '#5c2410')
  px(hx - 35, 21, 70, 4, WOOD[2])
  px(hx - 35, 21, 70, 1, WOOD[3])
  px(hx - 33, 25, 66, 1, WOOD[0])
  px(hx - 24, 16, 4, 5, '#4a6a5a')
  px(hx + 19, 17, 5, 4, STONE[2])
  px(hx - 12, 51, 24, 3, WOOD[0])
  px(hx - 12, 51, 24, 1, WOOD[1])
  px(hx - 14, 54, 28, 2, '#7a2a12')
  for (const x of [-11, -6, -1, 4, 9]) px(hx + x, 54, 1, 1, '#ff7a2a')
  const flames = [1, 2].map(k => {
    const f = pixels()
    const cols: [number, number][] = []
    for (let x = -12; x < 12; x += 2) cols.push([x, Math.round((1 - Math.abs(x + 1) / 13) * 18 * (0.5 + 0.6 * noise(x, k + 3)))])
    for (const [c, s] of [['#c2401f', 1], ['#ff8a2a', 0.72], ['#ffc04d', 0.48], ['#fff1c4', 0.22]] as const) for (const [x, h] of cols) f.px(hx + x, 51 - Math.round(h * s), 2, Math.round(h * s), c)
    return `<g class="fl${k}">${f.done()}</g>`
  })
  px(hx - 34, WALL_H, 68, 7, STONE[2])
  px(hx - 34, WALL_H, 68, 1, STONE[3])
  px(hx - 34, WALL_H + 7, 68, 1, STONE[0])
  for (const x of [-12, 12]) px(hx + x, WALL_H + 1, 1, 6, STONE[1])
  if (right[1] - right[0] >= 34) {
    px(wx - 15, 8, 30, 28, WOOD[0])
    px(wx - 13, 10, 26, 24, '#18203f')
    px(wx - 13, 24, 26, 10, '#222c52')
    px(wx - 9, 13, 4, 1, '#f2ead0')
    px(wx - 10, 14, 6, 3, '#f2ead0')
    px(wx - 9, 17, 4, 1, '#f2ead0')
    px(wx - 8, 15, 1, 1, '#d8cfae')
    for (const [x, y] of [[4, 13], [9, 16], [-4, 27], [8, 29], [3, 25]] as const) px(wx + x, y, 1, 1, '#c9d3ff')
    px(wx - 1, 10, 2, 24, WOOD[2])
    px(wx - 13, 21, 26, 2, WOOD[2])
    px(wx - 16, 36, 32, 3, WOOD[3])
    px(wx - 16, 39, 32, 1, WOOD[0])
  }
  if (right[1] - right[0] >= 76) {
    px(nx - 14, 11, 28, 23, WOOD[0])
    px(nx - 12, 13, 24, 19, '#9a6a3a')
    px(nx - 10, 14, 9, 10, '#e8dcc0')
    px(nx + 1, 16, 9, 8, '#d8c49a')
    px(nx - 6, 25, 11, 6, '#efe6cf')
    for (const [x, y, w] of [[-9, 17, 6], [-9, 19, 7], [-9, 21, 5], [2, 19, 7], [2, 21, 5], [-5, 28, 8]] as const) px(nx + x, y, w, 1, '#8a7a5a')
    for (const [x, y] of [[-6, 14], [5, 16], [-1, 25]] as const) px(nx + x, y, 1, 1, '#c4302b')
  }
  // Two lanterns hang over the tables; the hearth is the one light, so they only smoulder.
  for (const lx of [L.t1.x, L.t2.x]) {
    px(lx, 0, 1, 9, STONE[1])
    px(lx - 2, 8, 5, 1, STONE[0])
    px(lx - 3, 9, 7, 11, STONE[0])
    px(lx - 2, 11, 5, 7, '#6b3d18')
    px(lx - 1, 14, 3, 3, '#b8672a')
    px(lx - 1, 20, 3, 1, STONE[0])
  }
  // The hearth's light: a soft core cut off at LIT, then two dithered steps at the core's edge level, a checker
  // and then a sparser one, so the falloff reads as pixels.
  const rx = Math.max(120, Math.min(190, Math.round(W * 0.4)))
  const ry = 92
  const LIT = 0.72
  const glow = pixels()
  for (let y = 0; y < SCENE_H; y += 2) {
    for (let x = Math.max(0, hx - rx); x < Math.min(W, hx + rx); x += 2) {
      if (((x + y) / 2) % 2) continue
      const d = Math.hypot((x + 1 - hx) / rx, (y + 1 - 50) / ry)
      const density = d < LIT ? 0 : d < LIT + 0.07 ? 1 : d < LIT + 0.14 ? 0.5 : 0
      if (noise(x, y) < density) glow.px(x, y, 2, 2, '#ffd27a1c')
    }
  }
  const stop = (at: number, a: number) => `<stop offset="${at}" stop-color="${WARM}" stop-opacity="${a}"/>`
  return `<defs><radialGradient id="tg">${stop(0, 0.34)}${stop(0.4, 0.17)}${stop(LIT, 0.11)}${stop(LIT + 0.01, 0)}</radialGradient>
<radialGradient id="tv" cx=".5" cy=".3" r=".72"><stop offset=".45" stop-color="#07050b" stop-opacity="0"/><stop offset="1" stop-color="#07050b" stop-opacity=".85"/></radialGradient></defs>${done()}${flames.join('')}
<ellipse cx="${hx}" cy="50" rx="${rx}" ry="${ry}" fill="url(#tg)"/>${glow.done()}`
}

// What sits over the crew: a last touch of warmth near the fire, and the dark corners.
const tavernOver = (L: TavernLayout): string =>
  `<ellipse cx="${L.hx}" cy="60" rx="${Math.round(Math.min(160, L.W * 0.3))}" ry="70" fill="url(#tg)" opacity=".45"/><rect width="${L.W}" height="${SCENE_H}" fill="url(#tv)"/>`

// Fire flicker in two frames, an idle bob: periods that divide a second, as the crabs' do (the 2 s bob is
// phased from the clock when a walk redraws it each second). Reduced motion stops all of it.
const TAVERN_CSS = `<style>.fl2{opacity:0}.fl1{animation:fa .5s steps(1) infinite}.fl2{animation:fb .5s steps(1) infinite}
.idle{animation:ib 2s steps(1) infinite}@keyframes ib{50%{transform:translateY(-1px)}}
@media (prefers-reduced-motion: reduce){.fl1,.fl2,.idle{animation:none}}</style>`

export type Crew = { out: Record<string, number>; walk: Record<string, number>; tint: Record<string, string> }

// A costume's model before any run of it is seen: the tier it usually runs on.
const SEAT_MODEL: Record<string, string> = { explore: 'haiku', light: 'haiku', medium: 'sonnet', careful: 'opus', heavy: 'opus', fable: 'fable' }

// The main session's spell of work as of `at`: from its first call after it last went idle (or after a lull of
// LIVE_MS), to when it went idle or its last call went stale. `until` is absent while it works, as long as the
// main row is lit. Undefined before its first call.
// shortcut: keyed on tool calls, as the main row's light is; a turn with no calls never sends the king out.
export const mainSpan = (workList: readonly WorkItem[], idleAt: number, at: number): { since: number; until?: number } | undefined => {
  const mine = workList.filter(w => w.who === 'main').map(w => w.at)
  let i = mine.length - 1
  const last = mine[i]
  if (last === undefined) return undefined
  while (i > 0 && (mine[i - 1] ?? 0) > idleAt && (mine[i] ?? 0) - (mine[i - 1] ?? 0) < LIVE_MS) i--
  const since = mine[i] ?? last
  if (last > idleAt && at - last < LIVE_MS) return { since }
  return { since, until: last > idleAt ? last + LIVE_MS : Math.min(idleAt, last + LIVE_MS) }
}

// Who is out on a job (running agents by costume, the king while the main session works), where a crab on its
// way is (0 at its seat, 1 at the door), and each crab's shell colour: its costume's newest run's model, else the
// costume's usual one; the king's is the main session's. A crab walks out for WALK_MS after its first job
// started, and back in for WALK_MS after the last one ended.
export const crewOf = (list: readonly AgentRun[], at: number, main?: { since: number; until?: number }, mainModel = ''): Crew => {
  const out: Record<string, number> = {}
  const walk: Record<string, number> = {}
  const tint: Record<string, string> = {}
  const place = (c: string, since: number, until?: number) => {
    if (until === undefined && at - since < WALK_MS) walk[c] = Math.round((Math.max(0, at - since) / WALK_MS) * 100) / 100
    if (until !== undefined && at - until < WALK_MS) walk[c] = Math.round((1 - Math.max(0, at - until) / WALK_MS) * 100) / 100
  }
  const byCostume = new Map<string, AgentRun[]>()
  for (const a of list) {
    const c = costumeOf(a)
    const mine = byCostume.get(c)
    if (mine) mine.push(a)
    else byCostume.set(c, [a])
  }
  for (const c of SEATS) {
    const mine = byCostume.get(c) ?? []
    const newest = mine.reduce<AgentRun | undefined>((a, b) => (a && a.startedAt > b.startedAt ? a : b), undefined)
    const shell = c === 'king' ? modelTint(mainModel) : (modelTint(newest?.model ?? '') ?? modelTint(SEAT_MODEL[c] ?? ''))
    if (shell) tint[c] = shell
    const running = mine.filter(a => a.status === 'running')
    if (running.length) {
      out[c] = running.length
      place(c, Math.min(...running.map(a => a.startedAt)))
    } else place(c, -Infinity, Math.max(-Infinity, ...mine.map(a => a.endedAt ?? -Infinity)))
  }
  if (main) {
    if (main.until === undefined) out.king = 1
    place('king', main.since, main.until)
  }
  return { out, walk, tint }
}

// The point `t` of the way from a seat to the door: down or up to the aisle, along it, then up to the door.
const walkAt = (seat: Spot, t: number): Spot => {
  const pts = [seat, { x: seat.x, y: AISLE_Y }, { x: DOOR.x, y: AISLE_Y }, DOOR]
  const legs = pts.slice(1).map((p, i) => Math.abs(p.x - (pts[i]?.x ?? 0)) + Math.abs(p.y - (pts[i]?.y ?? 0)))
  let rest = t * sum(legs)
  for (let i = 0; i < legs.length; i++) {
    const a = pts[i] ?? DOOR
    const b = pts[i + 1] ?? DOOR
    const leg = legs[i] ?? 0
    if (rest <= leg && leg > 0) return { x: Math.round(a.x + ((b.x - a.x) * rest) / leg), y: Math.round(a.y + ((b.y - a.y) * rest) / leg) }
    rest -= leg
  }
  return DOOR
}

const tavernBg = new Map<string, { L: TavernLayout; under: string; props: { z: number; svg: string }[]; over: string }>()
const tavernMemo = new Map<string, string>()

// The tavern for `crew`, as one drawing W wide and SCENE_H tall in a thin dark wood frame: crabs at their seats
// in their model's shell colour, sorted by their feet, a mug where one is out, and a "×N out" tag on the bar
// for a costume with more than one agent out.
export const hideoutSvg = (W: number, crew: Crew, at: number): string => {
  const rtl = isRtl()
  const isWalking = Object.keys(crew.walk).length > 0
  const phase = isWalking ? Math.floor(at / 1000) % 2 : 0
  const key = JSON.stringify([W, rtl, lang, crew, phase])
  const hit = tavernMemo.get(key)
  if (hit !== undefined) return hit
  if (tavernMemo.size > 32) tavernMemo.clear()
  const bgKey = `${W}|${rtl}`
  let bg = tavernBg.get(bgKey)
  if (!bg) {
    if (tavernBg.size > 32) tavernBg.clear()
    const L = tavernLayout(W)
    bg = { L, under: tavernBack(L), props: tavernProps(L), over: tavernOver(L) }
    tavernBg.set(bgKey, bg)
  }
  const { L } = bg
  const items = [...bg.props]
  SEATS.forEach((c, i) => {
    const seat = L.seats[c]
    if (!seat) return
    const t = crew.walk[c]
    const isOut = !!crew.out[c]
    // The seat stays empty while its crab is away or on its way, an untouched mug where it sat.
    if (seat.mug && (isOut || t !== undefined)) {
      const m = seat.mug
      const p = pixels()
      p.px(m.x - 2, m.y - 5, 4, 5, WOOD[3])
      p.px(m.x - 2, m.y - 5, 1, 5, WOOD[4])
      p.px(m.x + 2, m.y - 4, 1, 3, WOOD[2])
      p.px(m.x - 2, m.y - 6, 4, 1, '#f2e6c8')
      items.push({ z: m.z, svg: p.done() })
    }
    if (isOut && t === undefined) return
    const pos = t === undefined ? seat : walkAt(seat, t)
    // Three fixed scale steps by depth; the sprite is 30 units wide with its feet at unit 26.
    const scale = pos.y < 84 ? 0.75 : pos.y < 108 ? 0.875 : 1
    const x0 = Math.round(pos.x - 15 * scale)
    const y0 = Math.round(pos.y - 26 * scale)
    const isBusy = t !== undefined
    // On its way a crab faces where it goes (the door is left of every seat); seated, it faces the hearth.
    const faceLeft = t !== undefined ? isOut : seat.x > L.hx
    // The contact shadow, a flat oval 2 px tall; a crab on a stool has the stool's.
    const p = pixels()
    if (t !== undefined || !seat.isOnStool) {
      p.px(pos.x - Math.round(10 * scale), pos.y - 1, Math.round(20 * scale), 2, '#00000040')
      p.px(pos.x - Math.round(7 * scale), pos.y - 1, Math.round(14 * scale), 2, '#00000040')
    }
    const shadow = p.done()
    // A warm 1 px rim on the side that faces the fire.
    const isNearFire = t === undefined && Math.abs(pos.x - L.hx) < 70 && pos.y < 104
    const rim = isNearFire
      ? `<rect x="${x0 + Math.round((pos.x < L.hx ? 22 : 7) * scale)}" y="${y0 + Math.round(10 * scale)}" width="1" height="${Math.round(12 * scale)}" fill="${WARM}" opacity=".6"/>`
      : ''
    const sprite = crab(x0, y0, c, false, isBusy, scale, faceLeft, crew.tint[c]) + rim
    items.push({
      z: t === undefined ? seat.z : pos.y,
      svg: shadow + (isBusy ? sprite : `<g class="idle" style="animation-delay:-${(phase + i * 0.5) % 2}s">${sprite}</g>`),
    })
  })
  items.sort((a, b) => a.z - b.z)
  // The tags are slates standing on the counter, over the heads of the crabs at the bar. They hold words:
  // drawn outside the mirror, at the mirrored spot.
  // shortcut: tags that do not fit along the counter are left off; the head and the alt text still count them.
  const s = tr()
  let tx = 43
  const tags: string[] = []
  for (const c of SEATS) {
    const n = crew.out[c] ?? 0
    if (n < 2) continue
    const label = `×${n} ${s.out}`
    const w = Math.round(textWidth(label, 9) + 14)
    if (tx + w > L.barEnd - 4) break
    tags.push(`<rect x="${mx(W, tx, w)}" y="46" width="${w}" height="11" fill="#1d140e" stroke="${WOOD[2]}" stroke-width="1"/>
<rect x="${mx(W, tx + 3, 4)}" y="49" width="4" height="5" fill="${TIER_COLOR[c] ?? '#E2C46A'}"/>
<text x="${mx(W, tx + 9, w - 11) + (w - 11) / 2}" y="55" text-anchor="middle"${rtl ? ' direction="rtl"' : ''} font-family="${FONT}" font-size="9" font-weight="600" fill="#f2e6c8">${xml(label)}</text>`)
    tx += w + 3
  }
  // The frame is the scene's own: rounded as the cards are, a 1 px line of the darkest wood over the vignette.
  const out = svg(
    W,
    SCENE_H,
    `${TAVERN_CSS}<defs><clipPath id="tvc"><rect width="${W}" height="${SCENE_H}" rx="8"/></clipPath></defs><g clip-path="url(#tvc)"><g${rtl ? ` transform="matrix(-1 0 0 1 ${W} 0)"` : ''} shape-rendering="crispEdges">${bg.under}${items.map(it => it.svg).join('')}${bg.over}</g>${tags.join('')}</g><rect x=".5" y=".5" width="${W - 1}" height="${SCENE_H - 1}" rx="7.5" fill="none" stroke="${WOOD[0]}" stroke-width="1"/>`,
  )
  tavernMemo.set(key, out)
  return out
}

// Enabled plugins from settings: { "name@marketplace": true }.
const enabledPlugins = async ($: EngineInterface): Promise<string[]> => {
  try {
    const st = (await $.settings.read()) as { enabledPlugins?: Record<string, unknown> }
    return Object.entries(st.enabledPlugins ?? {})
      .filter(([, on]) => on === true)
      .map(([k]) => k.split('@')[0] ?? k)
      .filter(n => n !== 'hideout')
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

// What a subagent's tool call worked on, as one line of the panel.
export const workOf = (tool: string, e: Record<string, unknown>): [WorkKind, string] | null => {
  const tail = (path: string): string => path.replace(/\\/g, '/').split('/').filter(Boolean).slice(-2).join('/')
  switch (tool) {
    case 'Read':
      return ['read', tail(str(e.file_path))]
    case 'Edit':
    case 'Write':
      return ['edit', tail(str(e.file_path))]
    case 'Bash':
      return ['cli', str(e.description) || str(e.command)]
    case 'Grep':
    case 'Glob':
      return ['search', str(e.pattern)]
    case 'WebFetch':
      return ['web', /^\w+:\/\/([^/]+)/.exec(str(e.url))?.[1] ?? str(e.url)]
    case 'WebSearch':
      return ['web', str(e.query)]
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
// Keeps a step's start and end across plan changes, and stamps `at` on a step that starts or completes now.
const stampTask = (t: Task, old: Task | undefined, at: number): Task => {
  const { startedAt: _s, endedAt: _e, ...rest } = t
  const startedAt = old?.startedAt ?? (t.status === 'pending' ? undefined : at)
  const endedAt = t.status === 'completed' ? (old?.endedAt ?? at) : undefined
  return { ...rest, ...(startedAt !== undefined ? { startedAt } : {}), ...(endedAt !== undefined ? { endedAt } : {}) }
}

export const applyPlan = (list: Task[], e: Record<string, unknown>, at = 0): Task[] =>
  movePlan(list, e).map((t, i) => stampTask(t, Array.isArray(e.items) ? list.find(o => o.content === t.content) : list[i], at))

const movePlan = (list: Task[], e: Record<string, unknown>): Task[] => {
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

async function track($: EngineInterface, id: string, kind: BgTask['kind'], label: string, lastsMs = BG_MAX_MS): Promise<void> {
  const at = await $.clock.now()
  await update($, bg, list =>
    [...list.filter(t => t.id !== id), { id, kind, label: label.slice(0, 120), status: 'running' as const, startedAt: at, endsBy: at + lastsMs }].slice(-100),
  )
  await update($, now, () => at)
}
// A background task whose end notice never came stops counting as running after this, so the
// 1s clock (which redraws the whole panel) goes quiet. Monitors use their own timeout.
const BG_MAX_MS = 60 * 60_000
export const isOverdue = (t: BgTask, at: number): boolean => t.status === 'running' && at > (t.endsBy ?? t.startedAt + BG_MAX_MS)

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
        const [at, bgNow, agentList, workList, idleAt] = await Promise.all([$.clock.now(), read($, bg), read($, agents), read($, work), read($, mainIdleAt)])
        const bgList = bgNow.some(t => isOverdue(t, at))
          ? await update($, bg, list => list.map((t): BgTask => (isOverdue(t, at) ? { ...t, status: 'done', endedAt: t.endsBy ?? at } : t)))
          : bgNow
        const isRunning = agentList.some(a => a.status === 'running') || bgList.some(t => t.status === 'running')
        // The main row is lit by its last call after its last turn ended, until LIVE_MS (and a tick to spare) has passed.
        const lastMain = [...workList].reverse().find(w => w.who === 'main')?.at ?? 0
        const isLit = lastMain > idleAt && at - lastMain < LIVE_MS + 2000
        // A crab walks back into the hideout for WALK_MS after its agent ends, the king after the main session stops:
        // placed by the clock, so it ticks till then (and one to spare).
        const mainUntil = mainSpan(workList, idleAt, at)?.until
        const isWalkingIn =
          agentList.some(a => a.endedAt !== undefined && at - a.endedAt < WALK_MS + 2000) || (mainUntil !== undefined && at - mainUntil < WALK_MS + 2000)
        if (!isRunning && !isLit && !isWalkingIn) return
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
    const at = await $.clock.now()
    await update($, tasks, list => applyPlan(list, e as Record<string, unknown>, at))
    return next(e)
  }).catch(($, e, next) => next(e))
  on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' }, async ($, e, next) => {
    const at = await $.clock.now()
    await update($, tasks, list => list.map(t => stampTask({ ...t, status: 'completed' }, t, at)))
    return next(e)
  }).catch(($, e, next) => next(e))
  on('tool.call', async ($, e, next) => {
    const k = kitOf(e.tool)
    if (k) {
      const at = await $.clock.now()
      await update($, kit, list => useKit(list, k[0], k[1], e.agentId ?? 'main', at))
    }
    return next(e)
  })
  // Modes a plugin's hook turns on (caveman, ponytail, ...) never call a tool: their added context is the use.
  on('classic.SessionStart', async ($, e, next) => {
    const r = await next(e)
    const names = await enabledPlugins($)
    await update($, enabled, () => names)
    const found = pluginsIn(r.additionalContext ?? [], names)
    await update($, modes, prev => [...new Set([...(e.source === 'compact' || e.source === 'resume' ? prev : []), ...found])])
    if (found.length) {
      const at = await $.clock.now()
      await update($, kit, list => found.reduce((l, n) => useKit(l, 'plugin', n, 'main', at), list))
    }
    return r
  }).catch(($, e, next) => next(e))
  on('classic.UserPromptSubmit', async ($, e, next) => {
    const r = await next(e)
    const names = await enabledPlugins($)
    await update($, enabled, () => names)
    const found = [...new Set([...pluginsIn(r.additionalContext ?? [], names), ...(await read($, modes))])]
    if (found.length) {
      const at = await $.clock.now()
      await update($, kit, list => found.reduce((l, n) => useKit(l, 'plugin', n, 'main', at), list))
    }
    return r
  }).catch(($, e, next) => next(e))
  on('skill.prompt', async ($, e, next) => {
    const at = await $.clock.now()
    await update($, kit, list => useKit(list, 'skill', e.skill, 'main', at))
    return next(e)
  })
  on('tool.call', { tool: 'Monitor' }, async ($, e, next) => {
    const r = await next(e)
    const id = (r as { result?: { taskId?: string } }).result?.taskId
    const lasts = Math.min(3_600_000, Number((e as { timeout_ms?: unknown }).timeout_ms) || 300_000) + 5000
    if (id) await track($, id, 'monitor', String(e.description || 'monitor'), lasts)
    return r
  })
  // A background task's notification names the task and how it ended.
  on('prompt.submit', async ($, e, next) => {
    if (e.origin?.kind === 'task-notification') {
      const id = /<task-id>([^<]+)<\/task-id>/.exec(e.text)?.[1]
      // A Monitor's expiry notice has no <status>, only "[Monitor expired …]" in its event.
      const state = /<status>([^<]+)<\/status>/.exec(e.text)?.[1] ?? (/\[Monitor (expired|timed out|stopped)/i.test(e.text) ? 'completed' : undefined)
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
    if (isNewFlow(prev, input) && typeof input.title === 'string') {
      // A new flow starts with a clean list; agents still running stay.
      await update($, agents, list => list.filter(a => a.status === 'running'))
    }
    const next = await update($, flow, p => merge(p, input))
    if (next && Array.isArray(input.tasks) && input.tasks.length) await autoOpen($, next.title)
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
        const total = Math.max(0, Math.round(num(input.total) ?? a.stepTotal ?? 0))
        const done = Math.max(0, Math.round(num(input.done) ?? a.stepDone ?? 0))
        return { ...a, stepTotal: total, stepDone: total ? Math.min(total, done) : done, stepNote: str(input.note).trim() || undefined }
      }),
    )
    return { result: matched ? 'ok' : `ignored: no panel row for agent ${agentId}` }
  })

  // Safety net: a worker launch moves the flow to delegate even if the orchestrator forgets to report.
  // The band's running count is not kept here: it is read from the agents list.
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const type = String(e.subagent_type ?? '')
    if (!type.startsWith('savvy-')) return next(e)

    await update($, flow, prev => {
      const base = prev && !prev.isFinished ? { ...blank(), ...prev } : blank()
      return { ...base, phase: base.phase === 'plan' ? 'delegate' : base.phase }
    })
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const isUnbriefed = e.subagentType.startsWith('savvy-') && !e.prompt.includes(STEP_TOOL)
    const started = await next(routeModel(isUnbriefed ? { ...e, prompt: e.prompt + STEP_BRIEF } : e))
    // Denied, or no agentId to match its steps and end by: no row.
    const agentId = started.agentId
    if (started.deny !== undefined || !agentId) return started

    const at = await $.clock.now()
    await update($, agents, list => {
      const round = 1 + list.filter(a => norm(a.description) === norm(e.description) && e.description).length
      const run: AgentRun = {
        id: agentId,
        agentId,
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
    if (!usage) return result
    const model = usage.model || e.model
    if (!agentId) {
      await update($, mainSplit, s => addRequest(s, model, usage))
      return result
    }
    await update($, subSplit, s => addRequest(s, model, usage))

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
      // The model of a run priced from the turn's own sum, which the session's subagent split takes too.
      let summed = undefined as string | undefined
      await update($, agents, list =>
        list.map((a): AgentRun => {
          if (a.agentId !== agentId) return a
          // A run whose steps went unseen still gets the turn's own sum.
          const fallback = a.steps === 0 && e.usage
          if (fallback && e.usage) summed = e.usage.model || a.model
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
      const usage = e.usage
      const model = summed
      if (model && usage) await update($, subSplit, s => addRequest(s, model, usage, false))
      await update($, now, () => at)
    }
    return next(e)
  })

  // The wheel over a card scrolls that card, not the pane: the pane is sized to fit.
  on('ui.scroll', { requestId: PANE }, async ($, e, next) => {
    if (!paneParked) return next(e)
    // The window's top row is paneRow; the cards start one row down, under the slack row.
    // The scroll keys carry no pointer: they scroll the first card that can.
    const r = e.origin.kind !== 'person' ? undefined : e.pointer ? cardAt(cardRects, e.pointer.column, e.pointer.row + paneRow - 1) : cardRects.find(c => c.max > 0)
    if (r && r.max > 0) await scrollCard($, r.key, Math.sign(e.by) * Math.max(1, Math.abs(e.by)) * r.step, r.max)
    // Park the window on row 1, so the next tick, up or down, has a row to scroll and reaches this hook.
    const res = await next({ ...e, offset: 1 })
    if (!res.deny) paneRow = 1
    return res
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const s = tr()
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    // Every read at once, the clock among them, read once.
    const [list, bgStored, nowAt, workList, idleAt, taskList, kitList, enabledList, f, p, usage, split, subs] = await Promise.all([
      read($, agents),
      read($, bg),
      read($, now),
      read($, work),
      read($, mainIdleAt),
      read($, tasks),
      read($, kit),
      read($, enabled),
      read($, flow),
      read($, panel),
      $.session.usage().catch(() => null),
      read($, mainSplit),
      read($, subSplit),
    ])
    const bgList = bgStored.slice().reverse()
    const mainItem = [...workList].reverse().find(w => w.who === 'main')
    const doneCount = taskList.filter(t => t.status === 'completed').length
    const mainStep =
      taskList.find(t => t.status === 'in_progress')?.content ??
      (taskList.length ? (doneCount === taskList.length ? `all ${taskList.length} tasks done` : `${doneCount}/${taskList.length} tasks done`) : '')
    const mainWork = mainSpan(workList, idleAt, nowAt)
    const isMainWorking = !!mainWork && mainWork.until === undefined
    const kitRows = kitRowsOf(kitList, enabledList, idleAt)
    const kitActive = kitRows.filter(k => k.state === 'active').length
    // Only skills in use get a full card; the rest, used earlier or not yet, sit in the chip grid.
    const kitLive = kitRows.filter(k => k.state === 'active')
    const kitShown = kitLive.slice(0, SKILL_MAX)
    const kitMore = kitLive.length - kitShown.length
    const kitIdle = kitRows.filter(k => k.state !== 'active')
    const at = Math.max(nowAt, ...list.map(a => a.startedAt), 0)

    const running = list.filter(a => a.status === 'running').reverse()
    const finished = list.filter(a => a.status !== 'running').reverse()
    const planned = plannedOf(f, list)
    const t = totals(list, at, { costUsd: usage?.cost?.usd, startedAt: usage?.startedAt, tokens: sum(split.tokens) }, subs)
    // The pane's title says "Agents"; inside, only the flow's own name.
    const title = f && !f.isFinished ? f.title : ''

    const isEmpty = list.length === 0 && planned.length === 0 && bgList.length === 0 && taskList.length === 0

    if (e.surface === 'desktop' && 'Svg' in ui) {
      const { Svg } = ui
      const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))
      // In Hebrew the column hugs the right edge: section heads and buttons right-aligned.
      const align = isRtl() ? 'flex-end' : undefined
      // Row 2 is two columns once the pane is wide enough: the crew (main session, subagents,
      // tasks, background) on the left, skills and plugins on the right.
      const isTwoCol = W >= 560
      // Each section is a bordered card with a header; rows inside are inset by its border and padding.
      const CARD_IN = 24
      // A card's header row, its top and bottom border, its inner top and bottom padding, and its one-row bottom margin.
      const CARD_PAD = 8
      const CARD_CHROME = ROW_PX + 12 + CARD_PAD * 2 + ROW_PX
      const colW = (isTwoCol ? Math.floor(W / 2) - 18 : W) - CARD_IN

      // A section header hides or shows all of its rows; each card scrolls on its own under the wheel.
      const folded = (k: string) => (k === 'done' ? p.isDoneCollapsed : !!p.collapsed?.[k])
      const fold = (k: string) =>
        update($, panel, prev =>
          k === 'done' ? { ...prev, isDoneCollapsed: !prev.isDoneCollapsed } : { ...prev, collapsed: { ...prev.collapsed, [k]: !prev.collapsed?.[k] } },
        )
      // `node` draws the item, and runs only for the items a card shows: rows scrolled away build no drawing.
      type Item = { key: string; h: number; node: () => unknown }
      // A row with tool calls gets a toggle on its title line; pressed, its calls list under it.
      type Row = { key: string; node: () => unknown; extra: Item[] }
      const sectionHead = (k: string, label: string, count: string): Item => ({
        key: `h-${k}`,
        // An 8px gap above each head, so folded heads do not stack flush.
        h: ROW_PX + 8,
        node: () => (
          <Box key={`h-${k}`} flexDirection="column">
            {spacer(`h-${k}-gap`, colW, 8)}
            <Button key={`fold-${k}`} label={`${folded(k) ? (isRtl() ? '◂' : '▸') : '▾'} ${label} · ${count}`} plain onPress={() => fold(k)} />
          </Box>
        ),
      })
      // A section's rows, each followed by its open call list.
      const rowItems = (k: string, list: Row[]): Item[] => (folded(k) ? [] : list.flatMap(r => [{ key: r.key, h: ROW_H, node: r.node }, ...r.extra]))

      const CALLS_SHOWN = 20
      const isOpen = (k: string) => !!p.openRows?.includes(k)
      const toggleRow = (k: string) =>
        update($, panel, prev => ({ ...prev, openRows: prev.openRows?.includes(k) ? prev.openRows.filter(x => x !== k) : [...(prev.openRows ?? []), k].slice(-20) }))
      // `src` draws the row's picture when the row is shown.
      const row = (key: string, src: () => string, alt: string, calls: WorkItem[] = []): Row => {
        const art = () => <Svg key={key} source={src()} alt={alt} width={colW} height={ROW_H} />
        if (!calls.length) return { key, node: art, extra: [] }
        const open = isOpen(key)
        const shown = calls.slice(-CALLS_SHOWN)
        // Call lines sit about 5 columns in, under the row's title.
        const callLine = (w: WorkItem, i: number): Item => ({
          key: `${key}-c${i}`,
          h: ROW_PX,
          node: () => (
            <Text key={`${key}-c${i}`} wrap="truncate-end">
              <Text color={KIND[w.kind][1]}>{`     ${KIND[w.kind][0]} `}</Text>
              <Text dimColor>{w.label}</Text>
            </Text>
          ),
        })
        return {
          key,
          node: () => (
            <Box key={`${key}-box`} flexDirection="column">
              {art()}
              <Box key={`${key}-tog`} position="absolute" top={0} left={isRtl() ? 2 : undefined} right={isRtl() ? undefined : 2}>
                {/* The label names the control; the glyph and count are what it draws. */}
                <Button key={`calls-${key}`} label={`${calls.length} ${calls.length === 1 ? 'tool call' : 'tool calls'}`} plain dimColor onPress={() => toggleRow(key)}>
                  {`${open ? '▾' : isRtl() ? '◂' : '▸'} ${calls.length}`}
                </Button>
              </Box>
            </Box>
          ),
          extra: !open
            ? []
            : [
                ...(calls.length > shown.length
                  ? [{ key: `${key}-more`, h: ROW_PX, node: () => <Text key={`${key}-more`} dimColor>{`     +${calls.length - shown.length} ${s.more}`}</Text> }]
                  : []),
                ...shown.map(callLine),
              ],
        }
      }
      // The calls grouped by who made them, once a draw; a task's are the main session's made while it was in progress.
      const byWho = new Map<string, WorkItem[]>()
      for (const w of workList) {
        const mine = byWho.get(w.who)
        if (mine) mine.push(w)
        else byWho.set(w.who, [w])
      }
      const agentCalls = (a: AgentRun) => callsOf(byWho.get(a.agentId ?? '') ?? [], a.agentId)
      const taskCalls = (t: Task) => (t.startedAt === undefined ? [] : callsOf(byWho.get('main') ?? [], 'main', t.startedAt, t.endedAt))
      const agentRow = (a: AgentRun) => {
        const calls = agentCalls(a)
        return row(a.id, () => agentSvg(colW, a, at, calls.length > 0), `${a.description || a.type}: ${modelName(a.model)}, ${statusWord(a.status)}`, calls)
      }
      const bgRow = (t: BgTask) => row(`bg-${t.id}`, () => bgSvg(colW, t, nowAt), `${t.kind}: ${t.label}, ${statusWord(t.status)}`)
      const taskRow = (t: Task, i: number) => {
        const calls = taskCalls(t)
        return row(`task-${i}`, () => taskSvg(colW, t, i + 1, taskList.length, calls.length > 0), `Task ${i + 1}: ${t.content}, ${statusWord(t.status)}`, calls)
      }
      // A step handed to a subagent whose description is the step's text shows as that agent's row (its type and model), not twice.
      const handed = new Set([...running, ...finished].map(a => norm(a.description)))
      const tasksAt = (st: TaskStatus) =>
        taskList.map((t, i) => ({ t, i })).filter(x => x.t.status === st && !handed.has(norm(x.t.content))).map(x => taskRow(x.t, x.i))
      const runAll: Row[] = [...running.map(agentRow), ...bgList.filter(t => t.status === 'running').map(bgRow), ...tasksAt('in_progress')]
      const planAll: Row[] = [
        ...planned.map(pl => row(`plan-${pl.n}`, () => plannedSvg(colW, pl), `${pl.n}. ${pl.title}: ${s.isPlanned}`)),
        ...tasksAt('pending'),
      ]
      const doneAll: Row[] = [...finished.map(agentRow), ...bgList.filter(t => t.status !== 'running').map(bgRow), ...tasksAt('completed')]

      const mainAlt = [`${s.mainSession}${split.model ? `, ${modelName(split.model)}` : ''}`, mainStep].filter(Boolean).join(': ')
      const crewItems: Item[] = [
        { key: 'main', h: MAIN_ROW_H, node: () => <Svg key="main" source={mainRowSvg(colW, mainStep, mainItem, isMainWorking, split.model)} alt={mainAlt} width={colW} height={MAIN_ROW_H} /> },
        ...(isEmpty ? [{ key: 'empty', h: ROW_PX, node: () => <Text key="empty" dimColor>{s.empty}</Text> }] : []),
        // Subagents, background jobs and tasks share the sections: only running or not sets them apart.
        ...(runAll.length ? [sectionHead('run', s.running, String(runAll.length))] : []),
        ...rowItems('run', runAll),
        ...(planAll.length ? [sectionHead('plan', s.planned, String(planAll.length))] : []),
        ...rowItems('plan', planAll),
        ...(doneAll.length ? [sectionHead('done', s.finished, String(doneAll.length))] : []),
        ...rowItems('done', doneAll),
      ]
      const kitItems: Item[] = [
        ...(kitRows.length === 0 ? [{ key: 'kit-none', h: ROW_PX, node: () => <Text key="kit-none" dimColor>{s.kitEmpty}</Text> }] : []),
        ...kitShown.map(r => ({ key: `kit-${r.name}`, h: SKILL_ROW_H, node: () => <Svg key={`kit-${r.name}`} source={kitRowSvg(colW, r, list)} alt={`${r.kind} ${r.name}: ${s.active}`} width={colW} height={SKILL_ROW_H} /> })),
        ...(kitMore > 0 ? [{ key: 'kit-more', h: ROW_PX, node: () => <Text key="kit-more" dimColor>+{kitMore} more in use</Text> }] : []),
        ...Array.from({ length: Math.ceil(kitIdle.length / 2) }, (_, j): Item => {
          const pair = kitIdle.slice(j * 2, j * 2 + 2)
          const top = j ? 0 : CHIP_TOP
          return {
            key: `kit-idle-${j}`,
            h: top + CHIP_H,
            node: () => <Svg key={`kit-idle-${j}`} source={kitIdleSvg(colW, pair, top)} alt={`${s.notActive}: ${pair.map(k => k.name).join(', ')}`} width={colW} height={top + CHIP_H} />,
          }
        }),
      ]
      const heightOf = (items: Item[]) => items.reduce((n, i) => n + i.h, 0)

      // Card heights: the pane is shared out so the cards fill it and only their insides scroll.
      // shortcut: assumes a desktop row is ROW_PX px; with no bodyRows the cards take their natural height.
      const bodyRows = e.props.scroll?.bodyRows || 0
      const paneH = bodyRows * ROW_PX
      // The flow's name, one row, while a flow runs.
      const titleH = title ? ROW_PX : 0
      // The tavern spans the pane at a fixed height: its head row, the scene and a one-row margin,
      // taken out of what the cards below share.
      const tavernH = ROW_PX + SCENE_H + ROW_PX
      const crewNat = CARD_CHROME + heightOf(crewItems)
      const kitNat = CARD_CHROME + heightOf(kitItems)
      const row2Nat = isTwoCol ? Math.max(crewNat, kitNat) : crewNat + kitNat
      const avail = paneH - titleH - tavernH - 8
      const fill = paneH > 0 && avail > 200
      const row2H = fill ? avail : row2Nat
      const crewH = !fill ? crewNat : isTwoCol ? row2H : Math.min(crewNat, Math.max(Math.floor(row2H * 0.6), row2H - kitNat))
      const kitH = !fill ? kitNat : isTwoCol ? row2H : row2H - crewH

      // Where each card sits, in pane px, so a wheel tick over a card scrolls that card (the ui.scroll hook reads it).
      const rects: CardRect[] = []
      // The last first-item that still fills the card: scrolling stops there.
      const lastStart = (items: Item[], bodyH: number) => {
        let h = 0
        for (let i = items.length - 1; i >= 0; i--) {
          h += items[i].h
          // Never past the last item: an item taller than the card still shows from its top.
          if (h > bodyH) return Math.min(i + 1, items.length - 1)
        }
        return 0
      }
      const spacer = (key: string, w: number, ht: number) => (ht > 0 ? <Svg key={key} source={svg(w, ht, '')} alt="" width={w} height={ht} /> : null)
      const listCard = (k: string, head: string, count: string, items: Item[], H: number, w: number, x: number, y: number) => {
        const bodyH = H - CARD_CHROME
        const max = fill ? lastStart(items, bodyH) : 0
        const off = Math.min(p.offsets?.[k] ?? 0, max)
        const shown: Item[] = []
        let used = 0
        for (const it of items.slice(off)) {
          if (fill && used + it.h > bodyH && shown.length) break
          shown.push(it)
          used += it.h
        }
        rects.push({ key: k, x, y, w: w + CARD_IN, h: H, max, step: 1 })
        return (
          <Box key={`card-${k}`} flexDirection="column" flexGrow={fill ? 1 : 0} overflow="hidden" borderStyle="round" borderColor={EDGE} paddingX={1} marginBottom={k === "crew" && !isTwoCol ? 1 : 0}>
            {spacer(`${k}-top`, w, CARD_PAD)}
            <Box key={`card-${k}-head`} flexDirection="row" gap={2} alignItems="center">
              <Text bold>{head}</Text>
              {count && <Text dimColor>{count}</Text>}
            </Box>
            {shown.map(it => it.node() as never)}
            {/* Filling, the card stretches to the window in rows; a px pad from the guessed row height fell short. */}
            {fill && <Box key={`${k}-pad`} flexGrow={1} />}
            {spacer(`${k}-bottom`, w, CARD_PAD)}
          </Box>
        )
      }
      const colX = isTwoCol ? Math.floor(W / 2) : 0
      // A card's count is the sum of its sections; a card with none shows no count.
      const crewCount = runAll.length + planAll.length + doneAll.length
      const left = (
        <Box key="col-crew" flexDirection="column" width={isTwoCol ? '50%' : undefined} flexGrow={fill ? 1 : 0} flexShrink={0} alignItems={align} paddingRight={isTwoCol ? 1 : 0}>
          {listCard('crew', s.pane, crewCount ? String(crewCount) : '', crewItems, crewH, colW, isRtl() && isTwoCol ? colX : 0, titleH + tavernH)}
        </Box>
      )
      const right = (
        <Box key="col-kit" flexDirection="column" width={isTwoCol ? '50%' : undefined} flexGrow={fill && isTwoCol ? 1 : 0} flexShrink={0} alignItems={align} paddingLeft={isTwoCol ? 1 : 0}>
          {listCard('kit', s.kit, kitRows.length ? `${kitActive} ${s.active} · ${kitIdle.length} ${s.notActive}` : '', kitItems, kitH, colW, isTwoCol ? (isRtl() ? 0 : colX) : 0, titleH + tavernH + (isTwoCol ? 0 : crewH))}
        </Box>
      )
      // The Hideout: a head with who is home and who is out, over the tavern scene, which spans the pane edge
      // to edge in its own frame. It never grows: the Agents card below takes the fill.
      const crew = crewOf(list, at, mainWork, split.model)
      const outN = sum(Object.values(crew.out))
      const homeN = SEATS.length - Object.keys(crew.out).length
      const who = (c: string) => (c === 'king' ? s.mainSession : tierWord(c))
      const tavernAlt = [
        `${s.hideout} · ${s.home}: ${SEATS.filter(c => !crew.out[c]).map(who).join(', ')}`,
        ...(outN ? [`${s.out}: ${SEATS.filter(c => crew.out[c]).map(c => `${who(c)} ×${crew.out[c]}`).join(', ')}`] : []),
      ].join(' · ')
      const tavern = (
        <Box key="card-tavern" flexDirection="column" flexShrink={0} alignItems={align} marginBottom={1}>
          <Box key="tavern-head" flexDirection="row" gap={2} paddingX={1}>
            <Text bold>{s.hideout}</Text>
            <Text dimColor>{`${homeN} ${s.home} · ${outN} ${s.out}`}</Text>
          </Box>
          <Svg key="tavern" source={hideoutSvg(W, crew, at)} alt={tavernAlt} width={W} height={SCENE_H} />
        </Box>
      )

      cardRects = rects
      // Every row sits in the absolute overlay, so all of them must size the grid or they are clipped.
      const contentH = titleH + tavernH + row2H + 8
      // A pane with a card to scroll is parked (see paneParked): two rows of slack, the content one row down.
      // With nothing to scroll it fits its window exactly, so the desktop shows no scrollbar.
      paneParked = fill && rects.some(r => r.max > 0)
      paneRow = e.props.scroll?.offset ?? paneRow
      // Filling, the box is clipped to its rows, so the grid errs tall: 32 px a row outruns any code font's line height.
      const gridH = fill ? (bodyRows + 3) * 32 : Math.max(contentH, paneH)
      return (
        <Box flexDirection="column" height={paneParked ? bodyRows + 2 : fill ? bodyRows : undefined} overflow={fill ? 'hidden' : 'visible'}>
          {/* The grid sizes the pane; the content is placed over it, as an
              absolute Box paints over the siblings before it. */}
          {gridTiles(gridH).map((tileH, i) => (
            <Svg key={`grid-${i}`} source={gridSvg(W, tileH)} alt="" width={W} height={tileH} />
          ))}
          {/* Filling, the overlay spans the window's rows (parked: rows 1 to bodyRows), so row 2 can stretch. */}
          <Box flexDirection="column" position="absolute" top={paneParked ? 1 : 0} bottom={fill ? (paneParked ? 1 : 0) : undefined} left={0} right={0} alignItems={align}>
            {/* The flow's name, while a flow runs. */}
            {title ? (
              <Box key="title" paddingX={1}>
                <Text bold wrap="truncate-end">
                  {title}
                </Text>
              </Box>
            ) : null}
            {/* The Hideout, full width even in two columns. */}
            {tavern}
            {/* Row 2: the crew beside the skills and plugins. */}
            <Box flexDirection={isTwoCol ? (isRtl() ? 'row-reverse' : 'row') : 'column'} flexGrow={fill ? 1 : 0}>
              {left}
              {right}
            </Box>
          </Box>
        </Box>
      )
    }

    // Terminal: the same content in text rows.
    const toggleCompact = (
      <Button
        key="compact"
        label={p.isCompact ? `▾ ${s.expand}` : `▴ ${s.collapse}`}
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
    const bgRows = bgList.map(t => (
      <Text key={`bg-${t.id}`} wrap="truncate-end">
        <Text color={tintOf(t.id)}>▪</Text>{' '}
        <Text color={t.status === 'failed' ? 'red' : t.status === 'done' ? 'green' : undefined}>{STATUS_GLYPH[t.status]}</Text> {t.kind} · {t.label}
      </Text>
    ))
    // Every state, not only active ones, so the list matches its "N active of M" head.
    const kitText = kitRows.slice(0, SKILL_MAX).map(k => (
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
    const taskRows = taskList.map((t, i) => (
      <Text key={`task-${i}`} wrap="truncate-end">
        <Text color={TASK_COLOR[t.status]} dimColor={t.status === 'pending'}>
          {TASK_GLYPH[t.status]}
        </Text>{' '}
        <Text dimColor={t.status !== 'in_progress'} bold={t.status === 'in_progress'}>
          {t.content}
        </Text>
      </Text>
    ))
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
            <Text wrap="truncate-end">
              <Text color={CLAY}>▣</Text> <Text bold>{s.mainSession}</Text>
              {split.model ? <Text dimColor>{` · ${modelName(split.model)}`}</Text> : null} <Text dimColor>{mainStep || (mainItem ? `${KIND[mainItem.kind][0]} ${mainItem.label}` : '')}</Text>
            </Text>
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
            {taskList.length > 0 && <Text dimColor>{s.tasks} · {doneCount}/{taskList.length}</Text>}
            {taskRows}
            {bgList.length > 0 && <Text dimColor>Background · {bgList.length}</Text>}
            {bgRows}
            <Text dimColor>{s.kit} · {kitActive} active of {kitRows.length}</Text>
            {kitText}
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
    const beneath = new Set(next.trace.filter(t => t.outcome !== 'skipped' && t.plugin !== 'engine').map(t => t.plugin))
    const stored = await read($, flow)
    const ws = beneath.has('ribbon') ? await read($, windows) : []
    // This band stands in for ribbon's and ponytail's rows; any other band is kept.
    const isOurs = [...beneath].every(p => p === 'ribbon' || p === 'ponytail')
    // Nothing to draw yet (no plan, ribbon's windows not read): still hide their rows.
    if (stored === null && ws.length === 0) {
      if (beneath.size === 0 || !isOurs) return drawn ?? next(e)
      const { Box } = $.ui.resolve(e)
      return <Box />
    }
    const rest = isOurs ? null : below

    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const list = await read($, agents)
    // Workers running now, from the agents list: the bar's faint layer and the label's count.
    const f = stored && { ...stored, running: list.filter(a => a.status === 'running' && tierOf(a.type) !== 'other').length }
    const crew = list.length + (f ? plannedOf(f, list).length : 0)
    const isWorking = list.some(a => a.status === 'running')
    // The clock is read only for the usage resets: a band without them needs no clock.
    const at = ws.length ? await $.clock.now() : 0
    const crewButton = <Button key="hideout-agents" label={`${crew} ${tr().agentsCount}`} plain onPress={() => void togglePane($)} />
    const dismiss = f && <Button key="hideout-dismiss" label="✕" plain role="dismiss" onPress={() => update($, flow, () => null)} />
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
