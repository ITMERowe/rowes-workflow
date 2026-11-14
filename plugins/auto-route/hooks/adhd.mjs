// SessionStart: puts rules/adhd.md into the session's context, replacing the i-have-adhd plugin.
// The word-level rules (terse, 5 lines) are left out when the caveman plugin is on: it already says the same, and a repeat only costs input tokens.
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rules = join(dirname(fileURLToPath(import.meta.url)), '..', 'rules')
const read = f => readFileSync(join(rules, f), 'utf8')

const cavemanOn = () => {
  try {
    const { enabledPlugins = {} } = JSON.parse(readFileSync(join(homedir(), '.claude', 'settings.json'), 'utf8'))
    return Object.entries(enabledPlugins).some(([id, on]) => on && id.startsWith('caveman@'))
  } catch {
    return false
  }
}

const text = read('adhd.md') + (cavemanOn() ? '' : '\n' + read('adhd-words.md'))
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }))
