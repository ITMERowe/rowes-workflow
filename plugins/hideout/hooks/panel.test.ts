import { expect, test } from 'claude-code/testing'

import { bandSvg, cardAt, crab, isOverdue, kitLabel, kitOf, kitRowsOf, modelTint, pluginsIn, usageSvg, useKit, workOf } from './register'

test('a tool call becomes one work line', () => {
  expect(workOf('Edit', { file_path: 'C:\\repo\\src\\app.ts' })).toEqual(['edit', 'src/app.ts'])
  expect(workOf('Read', { file_path: '/home/me/lib/x.ts' })).toEqual(['read', 'lib/x.ts'])
  expect(workOf('Bash', { command: 'npm test', description: 'Run tests' })).toEqual(['cli', 'Run tests'])
  expect(workOf('Grep', { pattern: 'register' })).toEqual(['search', 'register'])
  expect(workOf('WebFetch', { url: 'https://example.com/docs' })).toEqual(['web', 'example.com'])
  expect(workOf('TodoWrite', {})).toBeNull()
})


test('the band holds its rows in one card and the usage row splits its width', () => {
  const u = usageSvg([{ kind: 'seven_day', percentUsed: 30 }, { kind: 'five_hour', percentUsed: 90, resetsAt: new Date(3_600_000).toISOString() }], 600, 0)
  expect(u).toContain('7D')
  expect(u).toContain('70%')
  expect(u).toContain('#D0453F')
  const b = bandSvg(616, [u, u])
  expect(b).toContain('class="tile ln"')
  expect((b.match(/<svg x=/g) ?? []).length).toBe(2)
})

test('skills and plugins: used ones first, active ones on top, then enabled ones not used yet', () => {
  expect(kitOf('Skill', { skill: 'graphify' })).toEqual(['skill', 'graphify'])
  expect(kitOf('mcp__plugin_claude-mem_mcp-search__search', {})).toEqual(['plugin', 'claude-mem'])
  expect(kitOf('mcp__context7__query-docs', {})).toEqual(['plugin', 'context7'])
  expect(kitOf('mcp__ccd_turn__update_plan', {})).toBeNull()
  expect(kitOf('Read', {})).toBeNull()
  let uses = useKit([], 'skill', 'graphify', 'main', 0)
  uses = useKit(uses, 'plugin', 'context7', 'a1', 1_000_000)
  uses = useKit(uses, 'skill', 'graphify', 'main', 10)
  expect(uses.find(u => u.name === 'graphify')?.count).toBe(2)
  const rows = kitRowsOf(uses, ['context7', 'ribbon', 'ponytail'], 500)
  expect(rows.map(r => [r.name, r.state])).toEqual([
    ['context7', 'active'],
    ['graphify', 'used'],
    ['ponytail', 'idle'],
    ['ribbon', 'idle'],
  ])
  // Once the turn that used it ends, it is idle again.
  expect(kitRowsOf(uses, [], 1_000_001).filter(r => r.state === 'active')).toEqual([])
})

test('a plugin:skill name reads as the skill, its plugin after when different', () => {
  expect(kitLabel('ui-ux-pro-max:ui-ux-pro-max')).toBe('ui-ux-pro-max')
  expect(kitLabel('taste-skill:design-taste-frontend')).toBe('design-taste-frontend · taste-skill')
  expect(kitLabel('graphify')).toBe('graphify')
})

test('a wheel tick scrolls the card under the pointer', () => {
  const rects = [
    { key: 'crew', x: 0, y: 54, w: 300, h: 400, max: 5, step: 1 },
    { key: 'kit', x: 300, y: 54, w: 300, h: 400, max: 0, step: 1 },
    { key: 'map', x: 0, y: 470, w: 600, h: 300, max: 200, step: 48 },
  ]
  expect(cardAt(rects, 2, 10)?.key).toBe('crew')
  expect(cardAt(rects, 50, 10)?.key).toBe('kit')
  expect(cardAt(rects, 10, 30)?.key).toBe('map')
  expect(cardAt(rects, 10, 1)).toBeUndefined()
})

test('a background task whose end notice never came stops counting as running', () => {
  const t = { id: 'm', kind: 'monitor' as const, label: 'watch', status: 'running' as const, startedAt: 0, endsBy: 125_000 }
  expect(isOverdue(t, 100_000)).toBe(false)
  expect(isOverdue(t, 130_000)).toBe(true)
  // Stored before endsBy existed: an hour is the cap.
  expect(isOverdue({ ...t, endsBy: undefined }, 59 * 60_000)).toBe(false)
  expect(isOverdue({ ...t, endsBy: undefined }, 61 * 60_000)).toBe(true)
  expect(isOverdue({ ...t, status: 'done' }, 1e12)).toBe(false)
})

test("a hook's added context marks the plugins it names as in use", () => {
  const enabled = ['caveman', 'ponytail', 'i-have-adhd', 'claude-mem', 'ribbon']
  const texts = ['CAVEMAN MODE ACTIVE (caveman). Respond terse.', 'PONYTAIL MODE ACTIVE: level full', '# i-have-adhd\nThe reader has ADHD.']
  expect(pluginsIn(texts, enabled)).toEqual(['caveman', 'ponytail', 'i-have-adhd'])
  // A name inside a longer word or a path segment is not a match.
  expect(pluginsIn(['cavemanly ribbons', 'savvy-ribbon-x'], enabled)).toEqual([])
  // A name far down a long text (memory notes, a skill list) is a mention, not the hook announcing itself.
  expect(pluginsIn([`# recent context\n${'x'.repeat(500)} used ponytail and claude-mem`], enabled)).toEqual([])
})

test('a crab is tinted by its model: Haiku grey, Sonnet blue, Opus yellow, Fable orange', () => {
  expect(modelTint('claude-opus-5-5')).toBe('#E6CC3E')
  expect(modelTint('claude-sonnet-5-5')).toBe('#7B7BF0')
  expect(modelTint('claude-haiku-5-5')).toBe('#C8C8C0')
  expect(modelTint('claude-fable-5-1')).toBe('#C27A2E')
  expect(modelTint('some-other-model')).toBeUndefined()
})

test('every costume takes any shell: a tint leaves no clay behind, and the working frame shows', () => {
  for (const costume of ['king', 'explore', 'light', 'medium', 'careful', 'heavy', 'fable', 'other']) {
    const svg = crab(0, 0, costume, false, true, 1, false, '#7B7BF0')
    expect(svg.includes('#D97757')).toBe(false)
    expect(svg.includes('fill="#7B7BF0"')).toBe(true)
    expect(/class="(f2|q2)"/.test(svg)).toBe(true)
  }
})

test('casters float with particles; the others stay on the ground', () => {
  for (const costume of ['light', 'heavy', 'fable']) {
    const svg = crab(0, 0, costume, false, true)
    for (const q of ['q1', 'q2', 'q3', 'q4']) expect(svg.includes(`class="${q}"`)).toBe(true)
  }
  expect(crab(0, 0, 'medium', false, true).includes('class="q1"')).toBe(false)
})
