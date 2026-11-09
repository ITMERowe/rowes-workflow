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

test('a step keeps when it started and stamps when it completed', () => {
  const list = applyPlan([], { items: [{ content: 'a', status: 'in_progress' }, { content: 'b', status: 'pending' }] }, 100)
  expect(list[0]?.startedAt).toBe(100)
  expect(list[1]?.startedAt).toBe(undefined)
  const advanced = applyPlan(list, { advance: true }, 200)
  expect([advanced[0]?.startedAt, advanced[0]?.endedAt, advanced[1]?.startedAt]).toEqual([100, 200, 200])
  // A rewritten plan keeps the times of the steps it still holds.
  const rewritten = applyPlan(advanced, { items: [{ content: 'a', status: 'completed' }, { content: 'b', status: 'in_progress' }, { content: 'c', status: 'pending' }] }, 300)
  expect([rewritten[0]?.endedAt, rewritten[1]?.startedAt]).toEqual([200, 200])
})
