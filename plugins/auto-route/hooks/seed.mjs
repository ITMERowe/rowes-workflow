// Copies seed/agents/Explore.md into ~/.claude on session start, only when missing, so a fresh install gets it
// and later edits are never overwritten. Rules do not live in a copied CLAUDE.md: the plugins inject them (adhd.mjs, hideout).
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const seed = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed')
const home = join(homedir(), '.claude')

for (const file of [join('agents', 'Explore.md')]) {
  const to = join(home, file)
  if (existsSync(to)) continue
  mkdirSync(dirname(to), { recursive: true })
  cpSync(join(seed, file), to)
}
