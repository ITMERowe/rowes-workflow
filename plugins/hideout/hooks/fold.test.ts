import { expect, mock, test } from 'claude-code/testing'

const PROGRESS = 'mcp__hideout__progress'
const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const

test('desktop: a section header hides its rows, and shows them again', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  await $.tool.call({ tool: PROGRESS, title: 'Fold', phase: 'delegate', tasks: [{ title: 'One', tier: 'light' }, { title: 'Two', tier: 'light' }] } as never)
  const ui = await $.ui.mount({ plugin: 'hideout', surface: 'desktop', component: 'Pane', requestId: 'hideout-agents', props: pane })
  const planRows = async () => (await ui.findAll({ type: 'Svg' })).filter(el => String(el.props.alt).includes(': planned')).length
  expect(await planRows()).toBe(2)
  await ui.press({ key: 'fold-plan' })
  expect((await ui.find({ key: 'fold-plan' }))?.props.label).toBe('▸ Planned · 2')
  expect(await planRows()).toBe(0)
  await ui.press({ key: 'fold-plan' })
  expect(await planRows()).toBe(2)
})

test('desktop: the Finished section draws its newest 30 rows and counts the rest', async ($, on) => {
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: `a${++n}` }))
  on('turn.complete', () => ({ text: '' }) as never)
  for (let i = 1; i <= 32; i++) {
    await $.agent.spawn({ tool_use_id: `t${i}`, prompt: 'p', description: `Job ${i}`, subagentType: 'general-purpose', provider: 'engine', parentModel: 'claude-opus-5-5', background: false, fork: false } as never)
    await ($.turn.complete as (e: unknown) => Promise<unknown>)({ agentId: `a${i}`, reason: 'answer', answer: 'ok' })
  }
  const ui = await $.ui.mount({ plugin: 'hideout', surface: 'desktop', component: 'Pane', requestId: 'hideout-agents', props: pane })
  expect((await ui.find({ key: 'fold-done' }))?.props.label).toBe('▾ Finished · 32')
  const alts = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.alt))
  expect(alts.filter(a => a.startsWith('Job ')).length).toBe(30)
  expect(alts).toContain('+2 more')
  // The two oldest are the ones left out.
  expect(alts.some(a => a.startsWith('Job 1:') || a.startsWith('Job 2:'))).toBe(false)
})

test('desktop: a task row with tool calls lists them when its toggle is pressed', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  mock.clock(on)
  on('tool.call', () => ({ result: 'ok' }) as never)
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', items: [{ content: 'Read the code', status: 'in_progress' }, { content: 'Later', status: 'pending' }] } as never)
  await $.tool.call({ tool: 'Read', file_path: '/repo/hooks/register.tsx' } as never)
  const ui = await $.ui.mount({ plugin: 'hideout', surface: 'desktop', component: 'Pane', requestId: 'hideout-agents', props: pane })
  // The running task has one call; the pending one has none, so no toggle.
  // The toggle draws its glyph and count; its label names it for a screen reader.
  const toggle = async () => await ui.find({ key: 'calls-task-0' })
  expect((await toggle())?.props.label).toBe('1 tool call')
  expect(String((await toggle())?.children)).toBe('▸ 1')
  expect(await ui.find({ key: 'calls-task-1' })).toBeFalsy()
  // Call lines are one-line drawings; their alt text names the call.
  const callShown = async () => (await ui.findAll({ type: 'Svg' })).some(el => /hooks\/register\.tsx/.test(String(el.props.alt)))
  expect(await callShown()).toBe(false)
  await ui.press({ key: 'calls-task-0' })
  expect(String((await toggle())?.children)).toBe('▾ 1')
  expect(await callShown()).toBe(true)
})

test('desktop: no drawing runs in an interactive frame', async ($, on) => {
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const ui = await $.ui.mount({ plugin: 'hideout', surface: 'desktop', component: 'Pane', requestId: 'hideout-agents', props: pane })
  // No Svg runs in a frame: a frame reloads, and flickers, on every redraw.
  expect((await ui.findAll({ type: 'Svg' })).some(el => el.props.isInteractive)).toBe(false)
})

test('desktop: the main session row shows even before any task or tool call', async ($, on) => {
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const ui = await $.ui.mount({ plugin: 'hideout', surface: 'desktop', component: 'Pane', requestId: 'hideout-agents', props: pane })
  expect((await ui.findAll({ type: 'Svg' })).some(el => String(el.props.alt).startsWith('Main session'))).toBe(true)
  // What fits fills the window exactly: the pane is the window's height, with no rows over to scroll.
  expect((await ui.find({ type: 'Box' }))?.props.height).toBe(pane.scroll.bodyRows)
})
