import { expect, test } from 'claude-code/testing'
import { isReadOnly, routeFor, routeNote, RULES, skillsFor } from './register.ts'

test('reading a guide or link routes to the reader; changing code does not', () => {
  expect(isReadOnly('read this guide https://example.com/post and tell me the gist')).toBe(true)
  expect(isReadOnly('summarize the blog post')).toBe(true)
  expect(isReadOnly('read the docs then fix the bug')).toBe(false)
  expect(isReadOnly('fix the login page')).toBe(false)
})

test('every routing row is picked by its kind of ask', () => {
  const pick = (t: string) => routeFor(t)?.agent
  expect(pick('use fable on this bug')).toBe('savvy-fable')
  expect(pick('add a permission check to the login route')).toBe('reviewer')
  expect(pick('find the root cause of the crash')).toBe('savvy-heavy')
  expect(pick('summarize this post https://example.com')).toBe('reader')
  expect(pick('where is the band drawn?')).toBe('searcher')
  expect(pick('map the repo for me')).toBe('Explore')
  expect(pick('rename crab to sprite')).toBe('editor')
  expect(pick('hello there')).toBeUndefined()
})

test('the rules hold the whole table', () => {
  for (const a of ['savvy-fable', 'reviewer', 'savvy-heavy', 'reader', 'searcher', 'Explore', 'editor', 'main session']) expect(RULES).toContain(a)
})

test('skills are picked from the ask, at most three', () => {
  expect(skillsFor('the band still shows, its broken')).toEqual(['superpowers:systematic-debugging'])
  expect(skillsFor('make a chart of my usage')).toEqual(['dataviz'])
  expect(routeNote('hello')).toBeUndefined()
})

test('the note rides along as context', async ($, on) => {
  const seen: (readonly string[] | undefined)[] = []
  on('prompt.submit', (_, e) => { seen.push(e.context); return { text: e.text, context: e.context } })
  await $.prompt.submit({ text: 'summarize this post https://example.com', wait: false } as never)
  expect(seen[0]?.join('\n')).toContain('`reader` subagent')
})

test('the routing table reaches only a prompt that can delegate', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'hi', scope: 'shared' }] }))
  const base = { model: 'claude-sonnet-5-5', promptModel: 'claude-sonnet-5-5', surfaces: [], outputStyle: null, traits: [] }
  const main = await $.prompt.compose({ ...base, tools: ['Agent', 'Read'] } as never)
  expect(main.sections.map(s => s.id)).toEqual(['intro', 'auto-route:routing'])
  const sub = await $.prompt.compose({ ...base, tools: ['Read'] } as never)
  expect(sub.sections.map(s => s.id)).toEqual(['intro'])
})
