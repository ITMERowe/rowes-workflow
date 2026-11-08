import { expect, test } from 'claude-code/testing'

import { bandSvg, crewOf, kitOf, kitRowsOf, mapHeight, mapSvg, OFF_CODE, placeCrew, projectOf, usageSvg, useKit, workOf, zoomOf } from './register'

test('a tool call becomes one map line', () => {
  expect(workOf('Edit', { file_path: 'C:\\repo\\src\\app.ts' })).toEqual(['edit', 'src/app.ts'])
  expect(workOf('Read', { file_path: '/home/me/lib/x.ts' })).toEqual(['read', 'lib/x.ts'])
  expect(workOf('Bash', { command: 'npm test', description: 'Run tests' })).toEqual(['cli', 'Run tests'])
  expect(workOf('Grep', { pattern: 'register' })).toEqual(['search', 'register'])
  expect(workOf('WebFetch', { url: 'https://example.com/docs' })).toEqual(['web', 'example.com'])
  expect(workOf('TodoWrite', {})).toBeNull()
})

const graph = JSON.stringify({
  nodes: [
    { id: 'a', community: 0, community_name: 'src/ui', source_file: 'src/ui/pane.tsx' },
    { id: 'b', community: 0, community_name: 'src/ui', source_file: 'src/ui/band.tsx' },
    { id: 'c', community: 1, community_name: 'src/core', source_file: 'src/core/state.ts' },
    { id: 'd', community: 2, community_name: 'docs', source_file: 'README.md' },
  ],
  links: [
    { source: 'a', target: 'c' },
    { source: 'b', target: 'c' },
    { source: 'a', target: 'b' },
  ],
})

test('graph.json becomes community cards, largest first, with cross links', () => {
  const p = projectOf(graph, 5)
  expect(p.total).toBe(3)
  expect(p.communities.map(c => c.id)).toEqual([0, 1, 2])
  expect(p.communities[0]?.files).toEqual(['src/ui/pane.tsx', 'src/ui/band.tsx'])
  expect(p.links).toEqual([[0, 1, 2]])
})

test('each crew member sits on the card of the file it last worked on', () => {
  const p = projectOf(graph, 5)
  const agent = { id: 't1', agentId: 'a1', type: 'editor', description: 'fix band', model: 'claude-sonnet-5-5', status: 'running' as const, startedAt: 1, contextTokens: 0, contextMax: 1, tokens: 0, costUsd: 0, steps: 0, round: 1 }
  const work = [
    { who: 'a1', kind: 'read' as const, label: 'state.ts', at: 2, path: 'C:\\repo\\src\\core\\state.ts' },
    { who: 'a1', kind: 'edit' as const, label: 'band.tsx', at: 3, path: '/repo/src/ui/band.tsx' },
    { who: 'main', kind: 'cli' as const, label: 'npm test', at: 9 },
  ]
  const bg = [{ id: 'b1', kind: 'shell' as const, label: 'npm run dev', status: 'running' as const, startedAt: 5 }]
  const crew = crewOf([agent], bg, work, 10)
  expect(crew.map(m => m.key)).toEqual(['main', 't1', 'b1'])
  const placed = placeCrew(p, crew)
  expect(placed.get(0)?.map(m => m.key)).toEqual(['t1'])
  expect(placed.get(OFF_CODE)?.map(m => m.key)).toEqual(['main', 'b1'])
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
  const rows = kitRowsOf(uses, ['context7', 'ribbon', 'ponytail'], 1_000_060)
  expect(rows.map(r => [r.name, r.state])).toEqual([
    ['context7', 'active'],
    ['graphify', 'used'],
    ['ponytail', 'idle'],
    ['ribbon', 'idle'],
  ])
})

test('the map zooms: smaller cards fit more per row and show more communities', () => {
  const p = projectOf(graph, 5)
  expect(zoomOf(undefined)).toBe(1)
  expect(zoomOf(0)).toBe(0)
  expect(mapHeight(600, 6, 0)).toBeLessThan(mapHeight(600, 6, 2))
  const small = mapSvg(600, p, new Map(), [], 0)
  const big = mapSvg(600, p, new Map(), [], 2)
  expect(small).not.toContain(' sym<')
  expect(big).toContain('2 files · 2 sym')
})

test('the main session goes dark once its turn ends', () => {
  const work = [{ who: 'main', kind: 'cli' as const, label: 'npm test', at: 9 }]
  expect(crewOf([], [], work, 10).map(m => m.key)).toEqual(['main'])
  expect(crewOf([], [], work, 10, 9.5)).toEqual([])
  expect(crewOf([], [], work, 9 + 91_000)).toEqual([])
})
