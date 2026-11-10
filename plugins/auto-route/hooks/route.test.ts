import { expect, test } from 'claude-code/testing'
import { isReadOnly, routeNote, skillsFor } from './register.ts'

test('reading a guide or link routes to the reader; changing code does not', () => {
  expect(isReadOnly('read this guide https://example.com/post and tell me the gist')).toBe(true)
  expect(isReadOnly('summarize the blog post')).toBe(true)
  expect(isReadOnly('read the docs then fix the bug')).toBe(false)
  expect(isReadOnly('fix the login page')).toBe(false)
})

test('skills are picked from the ask, at most three', () => {
  expect(skillsFor('the band still shows, its broken')).toEqual(['superpowers:systematic-debugging'])
  expect(skillsFor('make a chart of my usage')).toEqual(['dataviz'])
  expect(skillsFor('hello')).toEqual([])
  expect(routeNote('hello')).toBeUndefined()
})

test('the note rides along as context; slash commands are left alone', async ($, on) => {
  const seen: (readonly string[] | undefined)[] = []
  on('prompt.submit', (_, e) => { seen.push(e.context); return { text: e.text, context: e.context } })
  await $.prompt.submit({ text: 'summarize this post https://example.com', wait: false } as never)
  expect(seen[0]?.join('\n')).toContain('`reader` subagent')
})
