import { expect, mock, test } from 'claude-code/testing'
import type { AgentRun, WorkItem } from '../types'
import { crewOf, mainSpan, modelTint } from './register'

const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } as const

test('desktop: a running agent and the working main session leave the hideout, and the head counts them out', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.env(on, { LANG: 'en_US.UTF-8' })
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
  const scene = String((await ui.findAll({ type: 'Svg' })).find(el => String(el.props.alt).startsWith('Hideout'))?.props.source)
  expect(scene).not.toContain('class="c-king')
  expect(scene).not.toContain('class="c-explore')
  // The medium crab, home, in Sonnet blue before any run of its own (the crab CSS names every costume, so match a drawn one).
  expect(scene).toContain('class="c-medium')
  expect(scene).toContain('fill="#7B7BF0"')
  expect(scene.length).toBeLessThan(131072)
  expect(await ui.find({ type: 'Text', text: '6 home · 2 out' })).toBeTruthy()
  // The tavern no longer folds.
  expect(await ui.find({ key: 'fold-tavern' })).toBeFalsy()
})

test('the king walks out while the main session works and back after; each crab wears its model', () => {
  const calls = [10_000, 12_000].map((at): WorkItem => ({ who: 'main', kind: 'read', label: 'x', at }) as WorkItem)
  // Working since its first call: halfway to the door 2 s in (a walk is 4 s), then out.
  const main = mainSpan(calls, 0, 12_000)
  expect(main).toEqual({ since: 10_000 })
  expect(crewOf([], 12_000, main).walk.king).toBe(0.5)
  const later = crewOf([], 20_000, mainSpan(calls, 0, 20_000))
  expect(later.out.king).toBe(1)
  expect(later.walk.king).toBeUndefined()
  // Idle at 30 s: home, a quarter of the way back in at 31 s.
  const back = crewOf([], 31_000, mainSpan(calls, 30_000, 31_000))
  expect(back.out.king).toBeUndefined()
  expect(back.walk.king).toBe(0.75)
  // Shells: the newest run's model, else the costume's usual one; the king wears the main session's.
  const run = { id: 't1', agentId: 'a1', type: 'Explore', description: 'Find it', model: 'claude-sonnet-5-5', status: 'done', startedAt: 1, endedAt: 2, contextTokens: 0, contextMax: 1, tokens: 0, costUsd: 0, steps: 1, round: 1 } as AgentRun
  const tint = crewOf([run], 99_999, undefined, 'claude-opus-5-5').tint
  expect(tint.king).toBe(modelTint('claude-opus-5-5'))
  expect(tint.explore).toBe(modelTint('sonnet'))
  expect(tint.light).toBe(modelTint('haiku'))
  expect(tint.other).toBeUndefined()
})
