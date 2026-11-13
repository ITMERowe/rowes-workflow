import { expect, mock, test } from 'claude-code/testing'
import type { AgentRun, WorkItem } from '../types'
import { addWork, crewOf, hideoutSvg, mainSpan, modelTint, walkKeyframes } from './register'
import { roomShift, SEAT_AT } from './tavern-scene'

// An Explore run from `startedAt`, done at `endedAt`, or running without one.
const explore = (startedAt: number, endedAt?: number): AgentRun =>
  ({ id: `r${startedAt}`, agentId: `a${startedAt}`, type: 'Explore', description: 'x', model: '', status: endedAt === undefined ? 'running' : 'done', startedAt, endedAt, contextTokens: 0, contextMax: 1, tokens: 0, costUsd: 0, steps: 1, round: 1 }) as AgentRun
const mainCalls = (...ats: number[]): WorkItem[] => ats.map((at): WorkItem => ({ who: 'main', kind: 'read', label: 'x', at }))

test('a walk glides from the seat to the front aisle, to the doorway and out of the door, fading as it goes through', () => {
  const careful = SEAT_AT.careful
  if (!careful) throw new Error('no careful seat')
  const k = walkKeyframes('wk-x', careful)
  expect(k).toBe(
    '@keyframes wk-x{0%{transform:translate(110px,123px);opacity:1}45.2%{transform:translate(75px,139.5px);opacity:1}92.2%{transform:translate(39px,121.5px);opacity:1}100%{transform:translate(33px,118.5px);opacity:0}}',
  )
  // Turned round halfway: back from where it got to, ending at its seat.
  const back = walkKeyframes('wk-y', careful, 0.5, 0)
  expect(back.startsWith('@keyframes wk-y{0%{transform:translate(71.3px,137.7px);opacity:1}')).toBe(true)
  expect(back.endsWith('100%{transform:translate(110px,123px);opacity:1}}')).toBe(true)
})

test('every seat and the doorway stay in the frame from a narrow pane to a wide one', () => {
  // The pane's width is clamped to 240..900.
  for (const W of [240, 320, 480, 900]) {
    const dx = roomShift(W)
    for (const seat of Object.values(SEAT_AT)) {
      // A crab is 30 wide, centred on its seat.
      expect(seat.at.x + dx - 15).toBeGreaterThanOrEqual(0)
      expect(seat.at.x + dx + 15).toBeLessThanOrEqual(W)
      // Below about 260 the door and the king's chair no longer both fit, and the seats win.
      if (W >= 260) expect((seat.path[seat.door]?.x ?? -1) + dx).toBeGreaterThanOrEqual(0)
    }
  }
})

test('the tavern with all eight crabs drawn, seated or walking, stays under the Svg source cap at every width', () => {
  const all = Object.keys(SEAT_AT)
  const tint = { explore: '#C8C8C0', medium: '#7B7BF0', careful: '#D97757', fable: '#C27A2E' }
  for (const W of [240, 320, 480, 900]) {
    const seated = hideoutSvg(W, { out: {}, go: {}, tint }, 0)
    const walking = hideoutSvg(W, { out: {}, go: Object.fromEntries(all.map(c => [c, { from: 0, to: 1, start: 0 }])), tint }, 2000)
    // Seven idling and one walking: both kinds of motion at once.
    const mixed = hideoutSvg(W, { out: {}, go: { explore: { from: 0, to: 1, start: 0 } }, tint }, 2000)
    for (const s of [seated, walking, mixed]) {
      // Margin under 131072 for the slates and the crab CSS growing.
      expect(s.length).toBeLessThan(120_000)
      expect(s).not.toMatch(/NaN|undefined|\[object/)
    }
    expect(seated.match(/class="c-/g)?.length).toBe(8)
    expect(walking.match(/@keyframes wk-/g)?.length).toBe(8)
  }
})

test('every crab at home idles on a cycle of its own; a walking crab does not', () => {
  const seated = hideoutSvg(480, { out: {}, go: {}, tint: {} }, 0)
  for (const k of ['sp', 'lk', 'nd', 'tp', 'sh', 'sr', 'ml', 'wp', 'bm', 'dr', 'sl']) expect(seated).toContain(`@keyframes ${k}{`)
  // Each seat's wrapper and rules, all eight at a different length and point of their cycle.
  const cycles = new Set<string>()
  for (let i = 0; i < 8; i++) {
    expect(seated).toContain(`<g class="idle i${i}"`)
    const rule = seated.match(new RegExp(`\\.i${i} \\.[a-z0-9]+\\{animation:[a-z]+ (\\d+s) steps\\(1\\) (-?[\\d.]+s) infinite\\}`))
    expect(rule).not.toBeNull()
    cycles.add(`${rule?.[1]} ${rule?.[2]}`)
  }
  expect(cycles.size).toBe(8)
  // Reduced motion stops it with the rest.
  expect(seated).toContain('.idle *')
  // Explore walks out: no idle of its own, while the others keep theirs.
  const out = hideoutSvg(480, { out: {}, go: { explore: { from: 0, to: 1, start: 0 } }, tint: {} }, 1000)
  expect(out).not.toContain('class="idle i1"')
  expect(out).not.toContain('.i1 ')
  expect(out).toContain('class="idle i0"')
})

test('a crab sent out by a short job finishes its walk out, then walks back in from the door', () => {
  const run = explore(10_000, 11_000)
  // The job ended 1 s in; the crab still walks on to the door, reached at 14 s.
  expect(crewOf([run], 12_000).go.explore).toEqual({ from: 0, to: 1, start: 10_000 })
  // Then back in from the door over the next 4 s.
  expect(crewOf([run], 15_000).go.explore).toEqual({ from: 1, to: 0, start: 14_000 })
  expect(crewOf([run], 18_100).go.explore).toBeUndefined()
})

test('a crab already out stays out when a run that overlapped a newer one ends', () => {
  const crew = crewOf([explore(0, 60_000), explore(58_000)], 60_100)
  expect(crew.go.explore).toBeUndefined()
  expect(crew.out.explore).toBe(1)
  // A job started while the crab still walks out of a short one: the same walk goes on.
  expect(crewOf([explore(0, 1000), explore(2000)], 2500).go.explore).toEqual({ from: 0, to: 1, start: 0 })
})

test('a crab sent out again on its way home turns round where it is', () => {
  // Walking in since 10 s, a quarter of the way home at 11 s: out again from there.
  expect(crewOf([explore(0, 10_000), explore(11_000)], 11_100).go.explore).toEqual({ from: 0.75, to: 1, start: 11_000 })
  // The king alike: idle at 11 s after a spell from 10 s, so walking in from 14 s; a new turn's call at 15 s.
  const main = mainSpan(mainCalls(10_000, 15_000), 11_000, 15_100)
  expect(main).toEqual({ since: 15_000, prev: { since: 10_000, until: 11_000 } })
  expect(crewOf([], 15_100, main).go.king).toEqual({ from: 0.75, to: 1, start: 15_000 })
})

test("each author keeps its newest 100 calls, so a busy subagent never drops the main session's", () => {
  let list: WorkItem[] = []
  for (let at = 0; at <= 100; at++) list = addWork(list, { who: 'main', kind: 'read', label: 'x', at })
  list = addWork(list, { who: 'a1', kind: 'read', label: 'y', at: 101 })
  const mine = list.filter(w => w.who === 'main')
  expect(mine.length).toBe(100)
  expect(mine[0]?.at).toBe(1)
  expect(list.filter(w => w.who === 'a1').length).toBe(1)
  // 600 in all.
  for (let a = 2; a <= 7; a++) for (let at = 0; at < 100; at++) list = addWork(list, { who: `a${a}`, kind: 'read', label: 'z', at: 200 + at })
  expect(list.length).toBe(600)
})

const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const

test('desktop: a running agent and the working main session leave the hideout, named in its alt text', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  on('settings.read', async () => ({ value: {} }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.register', (_$, e) => ({ value: { tool: e.name } }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('tool.call', () => ({ result: 'ok' }) as never)
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'a1' }))
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description: 'Find the config', subagentType: 'Explore', provider: 'engine', parentModel: 'claude-opus-5-5', background: false, fork: false } as never)
  // A call of the main session's own: it works, so the king is out too.
  await $.tool.call({ tool: 'Read', file_path: '/repo/hooks/register.tsx' } as never)
  // Past their walks to the door: the 1 s clock moves the panel's time while they work.
  await clock.advance(5000)
  const ui = await $.ui.mount({ plugin: 'hideout', surface: 'desktop', component: 'Pane', requestId: 'hideout-agents', props: pane })
  const tavern = (await ui.findAll({ type: 'Svg' })).find(el => String(el.props.alt).startsWith('Hideout'))
  const scene = String(tavern?.props.source)
  expect(scene).not.toContain('class="c-king')
  expect(scene).not.toContain('class="c-explore')
  // The medium crab, home, in Sonnet blue before any run of its own (the crab CSS names every costume, so match a drawn one).
  expect(scene).toContain('class="c-medium')
  expect(scene).toContain('fill="#7B7BF0"')
  expect(scene.length).toBeLessThan(131072)
  expect(String(tavern?.props.alt)).toContain('out: Main session ×1')
})

test('the king walks out while the main session works and back after; each crab wears its model', () => {
  const calls = mainCalls(10_000, 12_000)
  // Working since its first call: halfway to the door 2 s in (a walk is 4 s), then out.
  const main = mainSpan(calls, 0, 12_000)
  expect(main).toEqual({ since: 10_000 })
  expect(crewOf([], 12_000, main).go.king).toEqual({ from: 0, to: 1, start: 10_000 })
  const later = crewOf([], 20_000, mainSpan(calls, 0, 20_000))
  expect(later.out.king).toBe(1)
  expect(later.go.king).toBeUndefined()
  // Idle at 30 s: home, walking in from the door since then.
  const back = crewOf([], 31_000, mainSpan(calls, 30_000, 31_000))
  expect(back.out.king).toBeUndefined()
  expect(back.go.king).toEqual({ from: 1, to: 0, start: 30_000 })
  // Shells: the newest run's model, else the costume's usual one; the king wears the main session's.
  const run = { ...explore(1, 2), model: 'claude-sonnet-5-5' }
  const tint = crewOf([run], 99_999, undefined, 'claude-opus-5-5').tint
  expect(tint.king).toBe(modelTint('claude-opus-5-5'))
  expect(tint.explore).toBe(modelTint('sonnet'))
  expect(tint.light).toBe(modelTint('haiku'))
  expect(tint.other).toBeUndefined()
})
