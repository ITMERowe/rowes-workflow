import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Task, TaskStatus } from '../types'

// One band above the prompt in one look: FLOW (savvy-progress), TASKS (the app's task
// list), SESSION (ponytail) and USAGE (ribbon). The three plugins each draw their own
// row and stack the rest beneath through next(e). Cockpit calls next(e), reads which of
// them ran beneath it (next.trace), drops their rows and redraws those from their state.
// A plugin seated above cockpit still draws its own row, so nothing ever shows twice.

const tasks = atom({ plugin: 'cockpit', key: 'tasks' } as const, [] as Task[])
const isTasksOpen = atom({ plugin: 'cockpit', key: 'isTasksOpen' } as const, false)

// Other plugins' values, read only; the defaults stand in until each has written one.
const flow = atom({ plugin: 'savvy-progress', key: 'flow' } as const, null)
const agents = atom({ plugin: 'savvy-progress', key: 'agents' } as const, [])
const ponyBand = atom({ plugin: 'ponytail', key: 'band' } as const, null as never)
const windows = atom({ plugin: 'ribbon', key: 'windows' } as const, [])
const cache = atom({ plugin: 'ribbon', key: 'cache' } as const, null)

const BG = '#211f1b'
const TEXT = '#ece6d6'
const MUTED = '#8d8775'
const ACCENT = '#8f8cf4'
const OK = '#5fbf8f'
const SEVEN = '#ff6b1a'
const FIVE = '#f5a623'
const WARM = '#cc6363'
const COLD = '#6aaabd'
const TTL_MS = 60 * 60 * 1000
const TICK_MS = 30_000
const MAX_TASKS = 12
const STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'completed']

const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

const fmtReset = (iso: string | undefined, now: number): string => {
  const ms = iso ? Date.parse(iso) - now : NaN
  if (Number.isNaN(ms)) return ''
  if (ms <= 0) return 'resetting'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  return h < 24 ? `${h}h ${mins % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`
}

const bar = (ratio: number, cells: number, on = '▰', off = '▱') => {
  const n = Math.max(0, Math.min(cells, Math.round(ratio * cells)))
  return { on: on.repeat(n), off: off.repeat(cells - n) }
}

// The app's task list as update_plan changes it: a whole new list, or a step moved on.
export const applyPlan = (list: Task[], e: Record<string, unknown>): Task[] => {
  if (Array.isArray(e.items)) {
    return e.items
      .filter((t): t is { content: string; status?: unknown } => typeof t === 'object' && t !== null && typeof (t as { content?: unknown }).content === 'string')
      .slice(0, MAX_TASKS)
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

const run = ($: EngineInterface, command: string) => $.command.run({ command, args: '' })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    $.clock.every(TICK_MS, () => $.ui.invalidate('ui.render'))
    return next(e)
  })

  on('tool.call', { tool: 'mcp__ccd_turn__update_plan' }, async ($, e, next) => {
    await update($, tasks, list => applyPlan(list, e as Record<string, unknown>))
    return next(e)
  }).catch(($, e, next) => next(e))

  // wrap_up checks the list off.
  on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' }, async ($, e, next) => {
    await update($, tasks, list => list.map(t => ({ ...t, status: 'completed' as const })))
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const below = await next(e)
    const beneath = new Set(next.trace.filter(t => t.outcome !== 'skipped').map(t => t.plugin))

    const { Box, Text, Button } = $.ui.resolve(e)
    const now = await $.clock.now()
    const rows: unknown[] = []
    const label = (k: string, text: string) => (
      <Text key={k} color={MUTED} bold>
        {text}
      </Text>
    )

    // FLOW: the savvy-flow plan.
    const f = beneath.has('savvy-progress') ? await read($, flow) : null
    if (f) {
      const list = await read($, agents)
      const ratio = f.isFinished ? 1 : f.total ? f.done / f.total : 0
      const b = bar(ratio, 12)
      const crew = list.length
      const working = list.filter(a => a.status === 'running').length
      rows.push(
        <Box key="flow" flexDirection="row" gap={1} alignItems="center">
          {label('flow-l', 'FLOW   ')}
          <Text color={f.isFinished ? OK : ACCENT}>◆</Text>
          <Text color={TEXT} bold wrap="truncate-end">
            {f.title}
          </Text>
          <Text>
            <Text color={f.isFinished ? OK : ACCENT}>{b.on}</Text>
            <Text color={MUTED}>{b.off}</Text>
          </Text>
          <Text color={TEXT}>
            {f.total ? `${f.done}/${f.total}` : `${f.running} busy`}
          </Text>
          <Text color={MUTED}>· {f.isFinished ? 'done' : f.phase}</Text>
          <Box flexGrow={1} />
          <Button key="cockpit-agents" plain onPress={() => void run($, 'agents-info')}>
            <Text color={working ? ACCENT : MUTED}>{working ? '●' : '○'}</Text> <Text color={TEXT}>×{crew} agents</Text>
          </Button>
        </Box>,
      )
    }

    // TASKS: the app's checklist.
    const list = await read($, tasks)
    if (list.length > 0) {
      const isOpen = await read($, isTasksOpen)
      const done = list.filter(t => t.status === 'completed').length
      const cur = list.find(t => t.status === 'in_progress')
      const b = bar(done / list.length, 12)
      const glyph = (s: TaskStatus) => (s === 'completed' ? '✓' : s === 'in_progress' ? '◐' : '○')
      const tone = (s: TaskStatus) => (s === 'completed' ? OK : s === 'in_progress' ? ACCENT : MUTED)
      rows.push(
        <Box key="tasks" flexDirection="row" gap={1} alignItems="center">
          {label('tasks-l', 'TASKS  ')}
          <Text>
            <Text color={done === list.length ? OK : ACCENT}>{b.on}</Text>
            <Text color={MUTED}>{b.off}</Text>
          </Text>
          <Text color={TEXT}>
            {done}/{list.length}
          </Text>
          {!isOpen && cur && (
            <Text color={MUTED} wrap="truncate-end">
              · now <Text color={TEXT}>{cur.content}</Text>
            </Text>
          )}
          <Box flexGrow={1} />
          <Button key="cockpit-tasks" plain label={isOpen ? 'Hide' : 'Show'} onPress={() => update($, isTasksOpen, v => !v)} />
        </Box>,
      )
      if (isOpen) {
        list.forEach((t, i) =>
          rows.push(
            <Text key={`task-${i}`} wrap="truncate-end">
              {'         '}
              <Text color={tone(t.status)}>{glyph(t.status)}</Text>{' '}
              <Text color={t.status === 'pending' ? MUTED : TEXT} bold={t.status === 'in_progress'} strikethrough={t.status === 'completed'}>
                {t.content}
              </Text>
            </Text>,
          ),
        )
      }
    }

    // SESSION: ponytail's cost and time.
    const p = beneath.has('ponytail') ? await read($, ponyBand) : null
    if (p) {
      const last = p.turnCosts[p.turnCosts.length - 1]
      rows.push(
        <Box key="session" flexDirection="row" gap={1} alignItems="center">
          {label('session-l', 'SESSION')}
          <Text color={p.level === 'off' ? MUTED : OK}>●</Text>
          <Text color={TEXT}>{p.level}</Text>
          <Text color={TEXT} bold>
            ${p.spent.toFixed(2)}
          </Text>
          {last !== undefined && <Text color={MUTED}>last ${last.toFixed(2)}</Text>}
          <Text color={MUTED}>· {fmtTime(p.busyMs)}</Text>
          <Box flexGrow={1} />
          <Button key="cockpit-review" plain label="Review" onPress={() => void run($, 'ponytail:ponytail-review')} />
          <Button key="cockpit-audit" plain label="Audit" onPress={() => void run($, 'ponytail:ponytail-audit')} />
        </Box>,
      )
    }

    // USAGE: ribbon's windows and the prompt cache.
    if (beneath.has('ribbon')) {
      const ws = await read($, windows)
      const c = await read($, cache)
      const idle = c && c.lastAt > 0 ? Math.max(0, now - c.lastAt) : null
      const isWarm = idle !== null && idle < TTL_MS
      if (ws.length > 0 || idle !== null) {
        rows.push(
          <Box key="usage" flexDirection="row" gap={1} alignItems="center">
            {label('usage-l', 'USAGE  ')}
            {ws.map(w => {
              const left = Math.max(0, Math.round(100 - w.percentUsed))
              const color = w.kind === 'seven_day' ? SEVEN : FIVE
              const d = bar(left / 100, 6, '●', '·')
              const name = w.kind === 'seven_day' ? '7D' : w.kind === 'five_hour' ? '5H' : w.kind.toUpperCase()
              return (
                <Text key={`w-${w.kind}`}>
                  <Text color={MUTED}>{name} </Text>
                  <Text color={color}>{d.on}</Text>
                  <Text color={MUTED}>{d.off} </Text>
                  <Text color={color} bold>
                    {left}%
                  </Text>
                  <Text color={MUTED}> {fmtReset(w.resetsAt, now)}  </Text>
                </Text>
              )
            })}
            <Box flexGrow={1} />
            {idle !== null && (
              <Text>
                <Text color={isWarm ? WARM : COLD} bold>
                  {isWarm ? '● WARM' : '❄ COLD'}
                </Text>
                <Text color={MUTED}>{isWarm ? ` ${Math.ceil((TTL_MS - idle) / 60000)}m left` : ` re-cache ${Math.round((c?.tokens ?? 0) / 1000)}k tok`}</Text>
              </Text>
            )}
          </Box>,
        )
      }
    }

    if (rows.length === 0) return below
    return (
      <Box flexDirection="column" backgroundColor={BG} paddingX={1}>
        {rows as never}
      </Box>
    )
  }).catch(($, e, next) => next(e))
}
