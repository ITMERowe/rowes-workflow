import { expect, test } from 'claude-code/testing'
import { isQuestion, isReadOnly, modelFor, routeFor, routeNote, RULES, skillsFor } from './register.ts'

test('reading a guide or link routes to the reader; changing code does not', () => {
  expect(isReadOnly('read this guide https://example.com/post and tell me the gist')).toBe(true)
  expect(isReadOnly('summarize the blog post')).toBe(true)
  expect(isReadOnly('read the docs then fix the bug')).toBe(false)
  expect(isReadOnly('fix the login page')).toBe(false)
})

test('every routing row is picked by its kind of ask', () => {
  const pick = (t: string) => routeFor(t)?.agent.replace('auto-route:', '')
  expect(pick('use fable on this bug')).toBe('fable')
  expect(pick('add a permission check to the login route')).toBe('reviewer')
  expect(pick('find the root cause of the crash')).toBe('heavy')
  expect(pick('summarize this post https://example.com')).toBe('reader')
  expect(pick('where is the band drawn?')).toBe('searcher')
  expect(pick('map the repo for me')).toBe('explore')
  expect(pick('rename crab to sprite')).toBe('editor')
  expect(pick('hello there')).toBeUndefined()
})

test('the rules hold the whole table', () => {
  for (const a of ['fable', 'reviewer', 'heavy', 'reader', 'searcher', 'explore', 'editor'].map(a => 'auto-route:' + a).concat('main session')) expect(RULES).toContain(a)
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
  expect(seen[0]?.join('\n')).toContain('`auto-route:reader` subagent')
})

test('the routing table reaches only a prompt that can delegate', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'hi', scope: 'shared' }] }))
  const base = { model: 'claude-sonnet-5-5', promptModel: 'claude-sonnet-5-5', surfaces: [], outputStyle: null, traits: [] }
  const main = await $.prompt.compose({ ...base, tools: ['Agent', 'Read'] } as never)
  expect(main.sections.map(s => s.id)).toEqual(['intro', 'auto-route:routing'])
  const sub = await $.prompt.compose({ ...base, tools: ['Read'] } as never)
  expect(sub.sections.map(s => s.id)).toEqual(['intro'])
})

test('a question gets no agent note, and only a plain one may change model', () => {
  expect(routeNote('does this project tell claude what model to use when i rename a lot of files?') ?? '').not.toContain('row')
  expect(isQuestion('what model do you use?')).toBe(true)
  expect(isQuestion('rename these files')).toBe(false)
  expect(isQuestion('why does src/app.ts crash?')).toBe(false)
  const limits = { haiku: 100000, sonnet: 50000 }
  expect(modelFor('chat', 30000, limits)).toBe('claude-haiku-5-5')
  expect(modelFor('chat', 150000, limits)).toBeUndefined()
  expect(modelFor('tech-question', 30000, limits)).toBe('claude-sonnet-5-5')
  expect(modelFor('tech-question', 80000, limits)).toBeUndefined()
  expect(modelFor('chat', 0, limits)).toBeUndefined()
  expect(modelFor('task', 1000, limits)).toBeUndefined()
})

test('a chat question runs its turn on Haiku once the context size is known', async ($, on) => {
  const models: string[] = []
  on('model.classify', () => ({ value: 'chat' }) as never)
  on('turn.start', (_, e) => ({ turnId: e.turnId }) as never)
  on('turn.complete', (_, e) => ({ turnId: e.turnId }) as never)
  on('turn.step', async function* (_, e) {
    models.push(e.model)
    return { turnId: e.turnId, index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: e.model, input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 20000, cache_creation_input_tokens: 0 } } as never
  })
  const step = async (turnId: string) => {
    for await (const _ of ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId, index: 0, model: 'caveman-auto', messageCount: 1 })) void _
  }
  // The first question comes before any request reported a size: it stays put.
  await $.turn.start({ text: 'what model do you use?', turnId: 't1' } as never)
  await step('t1')
  await $.turn.start({ text: 'what model do you use?', turnId: 't2' } as never)
  await step('t2')
  await $.turn.start({ text: 'rename these files', turnId: 't3' } as never)
  await step('t3')
  expect(models).toEqual(['caveman-auto', 'claude-haiku-5-5', 'caveman-auto'])
})

test('the README examples route where it says', () => {
  const note = (t: string) => routeNote(t) ?? ''
  expect(note('where is the login handler?')).toContain('auto-route:searcher')
  expect(note('summarize this post')).toContain('auto-route:reader')
  expect(note('rename these 40 files')).toContain('auto-route:editor')
  expect(note('review the payment migration')).toContain('auto-route:reviewer')
  expect(note('find the root cause of the flaky build')).toContain('auto-route:heavy')
  expect(note('rework the readme so it is easier to read')).not.toContain('auto-route:reader')
})
