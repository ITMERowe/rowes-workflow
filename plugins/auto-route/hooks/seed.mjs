// Copies seed/CLAUDE.md and seed/agents/Explore.md into ~/.claude on session start, only when missing,
// so a fresh install gets them and later edits in ~/.claude are never overwritten.
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const seed = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed')
const home = join(homedir(), '.claude')

for (const file of ['CLAUDE.md', join('agents', 'Explore.md')]) {
  const to = join(home, file)
  if (existsSync(to)) continue
  mkdirSync(dirname(to), { recursive: true })
  cpSync(join(seed, file), to)
}
