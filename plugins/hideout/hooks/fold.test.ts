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
})
