import { expect, test } from 'claude-code/testing'
import { HOUSE_RULES } from './register'

test('the code-change rules reach only the main session, once', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'hi', scope: 'shared' }] }))
  const base = { model: 'claude-sonnet-5-5', promptModel: 'claude-sonnet-5-5', surfaces: [], outputStyle: null, traits: [] }
  const main = await $.prompt.compose({ ...base, tools: ['Agent', 'Edit'] } as never)
  expect(main.sections.filter(s => s.id === 'hideout:rules').map(s => [s.text, s.scope])).toEqual([[HOUSE_RULES, 'session']])
  const sub = await $.prompt.compose({ ...base, tools: ['Edit'] } as never)
  expect(sub.sections.map(s => s.id)).toEqual(['intro'])
})
