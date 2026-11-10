import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { addRequest, costTip, tokensTip, totals } from './register'

const PLUGIN = 'hideout'
const pane = { title: '', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as const

type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

// One worker on `model`, known to the panel before any usage arrives; `request` is
// what each of its model requests reports.
const worker = async ($: Engine, on: On, model: string, request?: Usage) => {
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.spawn', () => ({ model, agentId: 'a1' }))
  on('turn.complete', () => ({ text: '' }) as never)
  on('turn.step', async function* () {
    return { turnId: 'turn', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: request ? { model, ...request } : null } as never
  })
  await $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description: 'Priced work', subagentType: 'general-purpose', provider: 'engine', parentModel: model, background: false, fork: false } as never)
}

// One model request of the worker, as `turn.step` reports it.
const step = async ($: Engine, model: string) => {
  const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model, messageCount: 1, agentId: 'a1' })
  for await (const _ of stream) void _
}

const shows = async ($: Engine, text: RegExp) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'hideout-agents', props: pane })
  return ui.find({ type: 'Text', text })
}

// List prices in USD per million tokens, cache writes at the 1-hour rate: a turn of
// 1M input, 1M output, 2M cache read and 1M cache write costs input + output + 2 × read + write.
const TURN: Usage = { input_tokens: 1e6, output_tokens: 1e6, cache_read_input_tokens: 2e6, cache_creation_input_tokens: 1e6 }
const PRICED: readonly (readonly [model: string, shown: string])[] = [
  ['claude-fable-5-1', '$80.5'], // 10 + 50 + 2 × 0.25 + 20
  ['claude-fable-5', '$82.0'], // 10 + 50 + 2 × 1 + 20
  ['claude-opus-5-5', '$32.4'], // 4 + 20 + 2 × 0.20 + 8
  ['claude-opus-5', '$41.0'], // 5 + 25 + 2 × 0.50 + 10
  ['claude-opus-4-8', '$41.0'],
  ['claude-sonnet-5-5', '$16.2'], // 2 + 10 + 2 × 0.10 + 4
  ['claude-sonnet-5', '$16.4'], // 2 + 10 + 2 × 0.20 + 4
  ['claude-sonnet-4-6', '$24.6'], // 3 + 15 + 2 × 0.30 + 6
  ['claude-haiku-5-5', '$0.82'], // 0.10 + 0.50 + 2 × 0.01 + 0.20
  ['claude-haiku-4-5', '$8.20'], // 1 + 5 + 2 × 0.10 + 2
]

for (const [model, shown] of PRICED) {
  test(`cost: a turn on ${model} shows ≈${shown}`, async ($, on) => {
    await worker($, on, model)
    await ($.turn.complete as (e: unknown) => Promise<unknown>)({ agentId: 'a1', reason: 'answer', answer: 'ok', usage: { model, ...TURN } })

    expect(await shows($, new RegExp(`≈\\${shown} `))).toBeDefined()
  })
}

// Haiku 5.5 is priced by prompt length, per request: 120K of prompt is over the 100K line.
const LONG: Usage = { input_tokens: 20_000, output_tokens: 10_000, cache_read_input_tokens: 50_000, cache_creation_input_tokens: 50_000 }

test('cost: a Haiku 5.5 request over 100K prompt tokens pays the long-prompt prices', async ($, on) => {
  await worker($, on, 'claude-haiku-5-5', LONG)
  await step($, 'claude-haiku-5-5')
  // (20K × 0.50 + 10K × 2.50 + 50K × 0.05 + 50K × 1.00) / 1M = 0.0875; at the short-prompt prices it is 0.0175.
  expect(await shows($, /≈\$0\.09 /)).toBeDefined()
})

test('cost: Haiku 4.5 has one price whatever the prompt length', async ($, on) => {
  await worker($, on, 'claude-haiku-4-5', LONG)
  await step($, 'claude-haiku-4-5')
  // (20K × 1 + 10K × 5 + 50K × 0.10 + 50K × 2) / 1M = 0.175
  expect(await shows($, /≈\$0\.1[78] /)).toBeDefined()
})

// The context bar: 130K tokens are 13% of Haiku 5.5's 1M window and 65% of Haiku 4.5's 200K.
for (const [model, percent] of [['claude-haiku-5-5', 13], ['claude-haiku-4-5', 65]] as const) {
  test(`context: ${model} fills to ${percent}% at 130K tokens`, async ($, on) => {
    await worker($, on, model, LONG)
    await step($, model)
    expect(await shows($, new RegExp(`ctx ${percent}%`))).toBeDefined()
  })
}

test('the header counts the main session too, not only subagents', () => {
  const a = { id: 't1', agentId: 'a1', type: 'editor', description: 'x', model: 'claude-sonnet-5-5', status: 'done' as const, startedAt: 5_000, endedAt: 6_000, contextTokens: 0, contextMax: 1, tokens: 100, costUsd: 0.5, steps: 1, round: 1 }
  // No subagents: the session's own cost, tokens and time.
  expect(totals([], 10_000, { costUsd: 1.25, startedAt: 4_000, tokens: 900 })).toEqual({ cost: 1.25, tokens: 900, time: 6_000 })
  // With one: tokens add up, cost is the session's (it holds the subagent's), time runs from the session's start.
  expect(totals([a], 10_000, { costUsd: 2, startedAt: 4_000, tokens: 900 })).toEqual({ cost: 2, tokens: 1000, time: 6_000 })
  // No session figures: the subagents alone, as before.
  expect(totals([a], 10_000)).toEqual({ cost: 0.5, tokens: 100, time: 1_000 })
})

test('tooltips: main session split by token kind, then subagents', () => {
  const none = { requests: 0, tokens: [0, 0, 0, 0], usd: [0, 0, 0, 0] } as const
  // Sonnet 5.5: input 2, output 10, cache read 0.1, cache write 4 USD per million.
  const s = addRequest({ ...none, tokens: [...none.tokens], usd: [...none.usd] }, 'claude-sonnet-5-5', { input_tokens: 0, output_tokens: 1000, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 0 })
  expect(s.requests).toBe(1)
  expect(Math.round((s.usd[2] ?? 0) * 1000)).toBe(100)
  const a = { id: 't1', agentId: 'a1', type: 'editor', description: 'Fix bug', model: 'claude-haiku-5-5', status: 'done' as const, startedAt: 0, contextTokens: 0, contextMax: 1, tokens: 5000, costUsd: 0.02, steps: 1, round: 1 }
  const cost = costTip(0.13, 0.12, s, [a])
  expect(cost).toContain('cache reads: 1.0M · ≈$0.10')
  expect(cost).toContain('Fix bug · Haiku 5.5: ≈$0.02')
  expect(cost).toContain('$0.12')
  // Sorted by tokens: cache reads first, output after.
  const tokens = tokensTip(1_006_000, s, [a])
  expect(tokens.indexOf('cache reads')).toBeLessThan(tokens.indexOf('output'))
  expect(tokens).toContain('1 requests')
})
