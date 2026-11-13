// SessionStart: puts rules/adhd.md into the session's context, replacing the i-have-adhd plugin.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const text = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'rules', 'adhd.md'), 'utf8')
console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }))
