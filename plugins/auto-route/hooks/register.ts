import type { Register } from 'claude-code'

// A prompt that only asks to read something: a link or a guide, post or doc, and no word that changes code.
const READ_VERB = /\b(read|summari[sz]e|tl;?dr|skim|explain|what does|what's in|go through|check out|look at)\b/i
const READ_THING = /https?:\/\/|\b(guide|post|article|blog|docs?|documentation|thread|reel|video|page|link|paper|readme|changelog|tweet)\b/i
const CHANGE = /\b(fix|edit|implement|build|refactor|change|add|remove|delete|rename|commit|push|write|create|install|update|migrate|deploy|make)\b/i

// shortcut: a fixed keyword table, not the session's live skill list; names a skill that is off are skipped by Claude.
const SKILLS: [RegExp, string][] = [
  [/\b(bug|broken|error|fails?|failing|crash|regression|not working|doesn'?t work|still shows)\b/i, 'superpowers:systematic-debugging'],
  [/\b(review|audit)\b.*\b(pr|diff|change|commit|branch|code)\b|\bcode review\b/i, 'code-review'],
  [/\b(research|compare|best practice|best setup|search up|look up)\b/i, 'research'],
  [/\b(chart|graph|plot|dashboard|visuali[sz]e|sparkline)\b/i, 'dataviz'],
  [/\b(ui|ux|design|layout|css|styling|landing page|redesign|polish)\b/i, 'impeccable:impeccable'],
  [/\b(new feature|brainstorm|idea for|let'?s build|plan out)\b/i, 'superpowers:brainstorming'],
  [/\b(tdd|unit tests?|test coverage|write tests?)\b/i, 'superpowers:test-driven-development'],
  [/\b(mod|panel|band above|status line|slash command|plugin hook)\b/i, 'plugin-authoring'],
  [/\b(settings\.json|permission|allow .* commands?|env var|hook config)\b/i, 'update-config'],
  [/\.pdf\b|\bpdf\b/i, 'anthropic-skills:pdf'],
  [/\.docx\b|\bword doc/i, 'anthropic-skills:docx'],
  [/\.pptx\b|\bpowerpoint\b/i, 'anthropic-skills:pptx'],
  [/\.xlsx\b|\.csv\b|\bspreadsheet\b/i, 'anthropic-skills:xlsx'],
  [/\bblender\b|\b3d (model|object)\b/i, 'blender-modeling'],
]

export const isReadOnly = (text: string): boolean => READ_VERB.test(text) && READ_THING.test(text) && !CHANGE.test(text)

export const skillsFor = (text: string): string[] => SKILLS.filter(([re]) => re.test(text)).map(([, s]) => s).slice(0, 3)

/** The routing note for one prompt, or undefined when nothing fits. */
export const routeNote = (text: string): string | undefined => {
  const lines: string[] = []
  if (isReadOnly(text))
    lines.push('auto-route: this ask only reads a guide, post or link. Hand the reading to the `reader` subagent (Haiku) with the link or path and what to pull out, then relay its summary. Read it yourself only if it is one short local file.')
  const skills = skillsFor(text)
  if (skills.length)
    lines.push(`auto-route: skills that match this ask: ${skills.map(s => `\`${s}\``).join(', ')}. Load the first one whose description fits before you start; skip any that do not fit or are not installed.`)
  return lines.length ? lines.join('\n') : undefined
}

export const register: Register = on => {
  on('prompt.submit', ($, e, next) => {
    // Slash commands and prompts the person did not type carry their own instructions.
    if (e.command || e.isMeta) return next(e)
    const note = routeNote(e.text)
    return next(note ? { ...e, context: [...(e.context ?? []), note] } : e)
  })
}
