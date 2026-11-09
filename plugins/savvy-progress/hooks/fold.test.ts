import { expect, mock, test } from 'claude-code/testing'

const PROGRESS = 'mcp__savvy-progress__progress'
const pane = { title: '', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const

test('desktop: a section header hides its rows, and shows them again', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  await $.tool.call({ tool: PROGRESS, title: 'Fold', phase: 'delegate', tasks: [{ title: 'One', tier: 'light' }, { title: 'Two', tier: 'light' }] } as never)
  const ui = await $.ui.mount({ plugin: 'savvy-progress', surface: 'desktop', component: 'Pane', requestId: 'savvy-agents', props: pane })
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
  const ui = await $.ui.mount({ plugin: 'savvy-progress', surface: 'desktop', component: 'Pane', requestId: 'savvy-agents', props: pane })
  // The running task has one call; the pending one has none, so no toggle.
  expect((await ui.find({ key: 'calls-task-0' }))?.props.label).toBe('▸ 1')
  expect(await ui.find({ key: 'calls-task-1' })).toBeFalsy()
  expect(await ui.find({ type: 'Text', text: /hooks\/register\.tsx/ })).toBeFalsy()
  await ui.press({ key: 'calls-task-0' })
  expect((await ui.find({ key: 'calls-task-0' }))?.props.label).toBe('▾ 1')
  expect(await ui.find({ type: 'Text', text: /hooks\/register\.tsx/ })).toBeTruthy()
})
