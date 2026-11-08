import { expect, test } from 'claude-code/testing'

import { applyPlan } from './register'

test('update_plan items, advance, done and start move the task list', () => {
  const list = applyPlan([], {
    items: [
      { content: 'a', status: 'in_progress' },
      { content: 'b', status: 'pending' },
      { content: 'c', status: 'bogus' },
      { nope: 1 },
    ],
  })
  expect(list.map(t => t.status)).toEqual(['in_progress', 'pending', 'pending'])

  const advanced = applyPlan(list, { advance: true })
  expect(advanced.map(t => t.status)).toEqual(['completed', 'in_progress', 'pending'])

  const moved = applyPlan(advanced, { done: [2], start: 3 })
  expect(moved.map(t => t.status)).toEqual(['completed', 'completed', 'in_progress'])
})
