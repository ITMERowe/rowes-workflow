import { expect, test } from 'claude-code/testing'

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
