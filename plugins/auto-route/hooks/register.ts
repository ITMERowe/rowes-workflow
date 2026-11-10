import type { Register } from 'claude-code'

// The whole routing model: the table and rules go into the main session's system prompt, and each
// typed prompt gets a note naming the row it matches and the skills that fit it.

type Route = { agent: string; model: string; work: string; test?: RegExp }

// The agents ship in this plugin's agents/ folder, so Claude Code names them `auto-route:<file>`.
const A = (name: string) => `auto-route:${name}`

// Checked top to bottom; the first row whose test matches a prompt is the one its note names.
export const ROUTES: Route[] = [
  { agent: A('fable'), model: 'fable', work: 'Bug that resists ordinary debugging, only when the user asks for Fable', test: /\bfable\b/i },
  { agent: A('reviewer'), model: 'opus', work: 'Auth, permissions, payments, migrations, deletion, concurrency, security boundary diff', test: /\b(auth|login|password|permissions?|payments?|billing|migrations?|deletion|concurren\w*|race condition|deadlock|security|secrets?|tokens? (leak|storage))\b/i },
  { agent: A('heavy'), model: 'opus', work: 'Messy code, root-cause debugging, multi-file change with invariants', test: /\b(root cause|why does .{0,40}(fail|break|crash)|flaky|intermittent|keeps (failing|breaking|happening)|still (broken|shows|fails)|messy|legacy|across (the )?(codebase|files|modules))\b/i },
  { agent: A('reader'), model: 'haiku', work: 'Read a guide, post, doc page or link and report what it says' },
  { agent: A('searcher'), model: 'haiku', work: 'Locate code, "where is X", "what calls Y", map a folder', test: /\b(where (is|are|'s)|what calls|who calls|which file|find (the )?(definition|usages?|uses|callers)|list (all )?(the )?uses|locate)\b/i },
  { agent: A('explore'), model: 'haiku', work: 'Broad sweep across many files, conclusion only', test: /\b(map (the|this|our) (repo|codebase|project)|overview of (the|this) (code|repo|codebase)|how does .{0,40} work|sweep|everywhere (we|it|that))\b/i },
  { agent: A('editor'), model: 'sonnet', work: 'Bounded edit with clear spec: rename, known-cause bug, boilerplate, tests', test: /\b(rename|typo|boilerplate|bump (the )?version|add (a |the )?tests?|write tests?|swap .{0,30} for)\b/i },
]

export const RULES = `## Routing (auto-route)
Standing request from the user: use subagents from the table below whenever a task matches a row. This counts as the user explicitly asking for subagents, every session and every task; do not wait to be told "use subagents".

Delegate only when it saves context or needs a stronger or cheaper model. Each subagent starts cold, so a job under ~3 tool calls stays in the main session. When an advisor is configured (\`advisorModel\`), call it before committing to an approach on hard work and before declaring done, instead of handing the whole task to an Opus subagent.

| Work | Agent | Model |
|---|---|---|
${ROUTES.map(r => `| ${r.work} | \`${r.agent}\` | ${r.model} |`).join('\n')}
| Anything else | main session | session model |

- Independent jobs: launch in one message, in parallel. Dependent jobs: one at a time.
- Search first, then edit. Hand \`${A('editor')}\` the exact file paths and line numbers that \`${A('searcher')}\` found.
- When a plan step goes to a subagent, pass the step's exact text as the Agent \`description\`.
- Brief every subagent with: goal, file paths, done condition. It has no memory of this chat.
- Failed twice or hit unfamiliar code: escalate one tier (editor to heavy). Do not retry the same agent a third time.
- For routing, use the agents in the table. Other plugins' agents are for their own skills and commands, unless the user names one.
- Review of ordinary diffs: main session or \`/code-review\`. Keep \`${A('reviewer')}\` for the risky list above.
- Never switch \`/model\` mid-task (loses prompt cache). Pick at session start, push heavy work to subagents.
- A prompt may carry an \`auto-route:\` note naming the row and skills that match it. It comes from a keyword table: follow it when it fits, overrule it when the table above says otherwise.`

// A prompt that only asks to read something: a link or a guide, post or doc, and no word that changes code.
const READ_VERB = /\b(read|summari[sz]e|tl;?dr|skim|explain|what does|what's in|go through|check out|look at)\b/i
const READ_THING = /https?:\/\/|\b(guide|post|article|blog|docs?|documentation|thread|reel|video|page|link|paper|readme|changelog|tweet)\b/i
const CHANGE = /\b(fix|edit|implement|build|refactor|change|add|remove|delete|rename|commit|push|write|rewrite|rework|redo|improve|clean|tweak|polish|create|install|update|migrate|deploy|make)\b/i

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

/** The routing row a prompt matches, or undefined for the main session. */
export const routeFor = (text: string, rows: readonly Route[] = ROUTES): Route | undefined =>
  rows.find(r => (r.agent === A('reader') ? isReadOnly(text) : r.test?.test(text)))

export const skillsFor = (text: string): string[] => SKILLS.filter(([re]) => re.test(text)).map(([, s]) => s).slice(0, 3)

// A short question with no code, path or link: the only kind of prompt whose model may be switched,
// and one that asks about work rather than asking for it, so it gets no agent note.
const QUESTION_START = /^\s*(what|which|who|why|how|when|where|is|are|does|do|did|can|could|should|would|will|explain)\b/i
const NOT_PLAIN = /```|https?:\/\/|[\w.-]+[\\/][\w.-]+|\.\w{1,5}\b(?=\s|$|[,:;)])/
export const isQuestion = (text: string): boolean =>
  text.length <= 400 && (QUESTION_START.test(text) || /\?\s*$/.test(text)) && !NOT_PLAIN.test(text)

/** The model a question's turn runs on, by its label and the context it carries; undefined keeps the session's. */
export const modelFor = (label: string | undefined, context: number, limits: { haiku: number; sonnet: number }): string | undefined => {
  // context 0 is unknown (no main request seen since a reload): switching blind could write a large cache.
  if (context <= 0) return undefined
  if (label === 'chat' && context < limits.haiku) return 'claude-haiku-5-5'
  if (label === 'tech-question' && context < limits.sonnet) return 'claude-sonnet-5-5'
  return undefined
}

const READ_ONLY_ROWS = new Set([A('searcher'), A('explore'), A('reader')])

/** The routing note for one prompt, or undefined when nothing fits. */
export const routeNote = (text: string): string | undefined => {
  const lines: string[] = []
  // A question asks about work, not for it: it may still go to a read-only agent, never to one that changes code.
  const r = routeFor(text, isQuestion(text) ? ROUTES.filter(x => READ_ONLY_ROWS.has(x.agent)) : ROUTES)
  if (r?.agent === A('reader'))
    lines.push('auto-route: this ask only reads a guide, post or link. Hand the reading to the `auto-route:reader` subagent (haiku) with the link or path and what to pull out, then relay its summary. Read it yourself only if it is one short local file.')
  else if (r)
    lines.push(`auto-route: this ask matches the \`${r.agent}\` row (${r.model}): ${r.work}. Delegate that part unless it fits in ~3 tool calls here.`)
  const skills = skillsFor(text)
  if (skills.length)
    lines.push(`auto-route: skills that match this ask: ${skills.map(s => `\`${s}\``).join(', ')}. Load the first one whose description fits before you start; skip any that do not fit or are not installed.`)
  return lines.length ? lines.join('\n') : undefined
}

const LABELS = ['chat', 'tech-question', 'task']

export const register: Register = (on, options) => {
  const limits = { haiku: Number(options.haikuUpTo ?? 100000), sonnet: Number(options.sonnetUpTo ?? 50000) }
  // The main session's context at its last request (input, cache read and cache write), and the model
  // each question's turn was moved to. Module state: a reload clears it, and nothing switches until
  // the next main request reports its size.
  let context = 0
  const moved = new Map<string, string>()

  on('turn.start', async ($, e, next) => {
    if (!e.agentId && isQuestion(e.text) && (limits.haiku > 0 || limits.sonnet > 0)) {
      const label = await $.model.classify(e.text, LABELS).catch(() => undefined)
      const model = modelFor(label, context, limits)
      if (model) moved.set(e.turnId, model)
    }
    return next(e)
  })
  on('turn.step', async function* ($, e, next) {
    const model = e.agentId ? undefined : moved.get(e.turnId)
    const result = yield* next(model ? { ...e, model } : e)
    const u = result.usage
    if (!e.agentId && u) context = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)
    return result
  })
  on('turn.complete', ($, e, next) => {
    moved.delete(e.turnId)
    return next(e)
  })

  // The table goes to the session that can delegate: a subagent's request offers no Agent tool.
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    if (!e.tools.includes('Agent')) return r
    return { sections: [...r.sections.filter(s => s.id !== 'auto-route:routing'), { id: 'auto-route:routing', text: RULES, scope: 'session' }] }
  })
  on('prompt.submit', ($, e, next) => {
    // Slash commands and prompts the person did not type carry their own instructions.
    if (e.command || e.isMeta) return next(e)
    const note = routeNote(e.text)
    return next(note ? { ...e, context: [...(e.context ?? []), note] } : e)
  })
}
