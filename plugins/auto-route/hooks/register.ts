import type { Register } from 'claude-code'

// The whole routing model: the table and rules go into the main session's system prompt, and each
// typed prompt gets a note naming the row it matches and the skills that fit it.

type Route = { agent: string; model: string; work: string; test?: RegExp }

// The agents ship in this plugin's agents/ folder, so Claude Code names them `auto-route:<file>`.
const A = (name: string) => `auto-route:${name}`

// Checked top to bottom; the first row whose test matches a prompt is the one its note names.
export const ROUTES: Route[] = [
  { agent: A('fable'), model: 'fable', work: 'Bug that resists ordinary debugging, only when the user asks for Fable', test: /\bfable\b/i },
  { agent: A('reviewer'), model: 'opus', work: 'Auth, permissions, payments, migrations, deletion, concurrency, security boundary diff', test: /\b(auth|login|password|permissions?|payments?|billing|migrations?|deletion|concurren\w*|race condition|deadlock|security|secrets?|tokens? (leak|storage)|oauth|jwt|encrypt\w*|sql injection|xss|csrf|rbac|(delete|wipe|purge) (the )?(users?|accounts?|data|database))\b/i },
  { agent: A('heavy'), model: 'opus', work: 'Messy code, root-cause debugging, multi-file change with invariants', test: /\b(root cause|why does .{0,40}(fail|break|crash)|flaky|intermittent|keeps (failing|breaking|happening)|still (broken|shows|fails)|messy|legacy|across (the )?(codebase|files|modules)|memory leak|performance regression|hard to reproduce|heisenbug)\b/i },
  { agent: A('reader'), model: 'haiku', work: 'Read a guide, post, doc page or link and report what it says' },
  { agent: A('searcher'), model: 'haiku', work: 'Locate code, "where is X", "what calls Y", map a folder', test: /\b(where (is|are|'s)|what calls|who calls|which file|find (the )?(definition|usages?|uses|callers)|list (all )?(the )?uses|locate|find all|grep for|which files?|how many (files|places|times)|list (all )?(the )?files)\b/i },
  { agent: A('explore'), model: 'haiku', work: 'Broad sweep across many files, conclusion only', test: /\b(map (the|this|our) (repo|codebase|project)|overview of (the|this) (code|repo|codebase)|how does .{0,40} work|sweep|everywhere (we|it|that)|read through (the )?(repo|code|codebase|project)|get (to know|familiar with) (the )?(repo|code|codebase|project)|trace (the )?(flow|path|call)|compare (the |these |those )?(repos|projects|codebases))\b|github\.com\/[\w-]+|\b(inspect|analy[sz]e|survey|examine|investigate)\b.{0,50}\b(repos?|repositor(y|ies)|profile|codebase)\b/i },
  { agent: A('verifier'), model: 'haiku', work: 'Run a long build, lint, typecheck or test suite and report pass or fail with the error lines', test: /\b(run|rerun|re-run) (the |all |our )?(unit |e2e |integration )?(tests?|test suite|build|lint(ing)?|type-?check(ing)?|checks?)\b|\bverify (the |that )?(build|tests?)\b/i },
  { agent: A('inspector'), model: 'sonnet', work: 'Verify a finished build end to end in a fresh context: build, required checks, packaged app, UI review', test: /\b(verify|inspect|check|review) (the )?(finished|packaged|built|final|whole) (app|build|exe|installer|ui|gui|project)\b/i },
  { agent: A('packager'), model: 'sonnet', work: 'Package a working build: installer, portable build, archive, and an install and uninstall check', test: /\b(build|make|create|produce|package) (the |an? )?(installer|distributable|setup|msi|portable|exe)\b|\bpackag(e|ing) (the )?(app|build|project)\b/i },
  { agent: A('documenter'), model: 'sonnet', work: 'Write or update the README, architecture notes, CHANGELOG entry and HANDOFF from the code', test: /\b(write|update|refresh|draft|add) (the )?(readme|docs|documentation|architecture (doc|notes)|changelog|handoff)\b/i },
  { agent: A('editor'), model: 'sonnet', work: 'Bounded edit with clear spec: rename, known-cause bug, boilerplate, tests', test: /\b(rename|typo|boilerplate|bump (the )?version|add (a |the )?tests?|write tests?|swap .{0,30} for|update (the )?(readme|docs|comments?|changelog)|fix (the )?(lint|formatting|imports?)|convert .{0,30} to|scaffold|add (a |the )?(field|prop|param(eter)?|import|route|page|component))\b/i },
]

export const RULES = `## Routing (auto-route)
Standing request from the user: use the subagents below whenever a task matches a row; do not wait to be told.

Delegate only when it saves context or money, or needs a stronger model. A subagent starts cold, so a job that reads or returns under ~20k tokens (a few files or commands, looped or not) stays here, except a survey of two or more repos, which always goes to subagents. If an advisor is configured (\`advisorModel\`), ask it before hard work and before declaring done, not an Opus subagent.

| Work | Agent | Model |
|---|---|---|
${ROUTES.map(r => `| ${r.work} | \`${r.agent}\` | ${r.model} |`).join('\n')}
| Anything else | main session | session model |

- Independent jobs: one message, in parallel. Dependent jobs: one at a time.
- Search first, then edit: give \`${A('editor')}\` the paths and lines \`${A('searcher')}\` found.
- Brief each subagent with goal, file paths, done condition. Pass a plan step's exact text as the Agent \`description\`.
- Failed twice or unfamiliar code: escalate one tier. Never retry the same agent a third time.
- Route only to these agents. Ordinary diffs: main session or \`/code-review\`; \`${A('reviewer')}\` is for the risky row.
- Never switch \`/model\` mid-task (loses the cache).
- An \`auto-route:\` prompt note comes from a keyword table: follow it when it fits, overrule it when this table says otherwise.`

// The standing part in the system prompt: a session that never delegates pays for these few lines, not the table.
// The full RULES ride along once, with the first note that names a routing row.
export const RULES_LITE = `## Routing (auto-route)
Standing request from the user: use the \`auto-route:*\` subagents when a task matches: searcher, explore, reader (haiku) for finding and reading; editor (sonnet) for bounded edits; verifier (haiku) for long build or test output, inspector, packager and documenter (sonnet) for the late phases of a long build (end-to-end checks, packaging, docs, CHANGELOG, HANDOFF), always passing the row's model as the Agent \`model\`; heavy, reviewer (opus) for hard or risky work. Delegate only when it saves context or money, or needs a stronger model; a job under ~20k tokens of reading or output stays here, and bigger reads go to subagents in parallel; a survey of two or more repos always does, whatever its size. The full table comes with the first prompt note that names a row.`

// A prompt that only asks to read something: a link or a guide, post or doc, and no word that changes code.
const READ_VERB = /\b(read|summari[sz]e|tl;?dr|skim|explain|what does|what's in|go through|check out|look at)\b/i
const READ_THING = /https?:\/\/|\b(guide|post|article|blog|docs?|documentation|thread|reel|video|page|link|paper|readme|changelog|tweet)\b/i
const CHANGE = /\b(fix|edit|implement|build|refactor|change|add|remove|delete|rename|commit|push|write|rewrite|rework|redo|improve|clean|tweak|polish|create|install|update|migrate|deploy|make)\b/i

// shortcut: a fixed keyword table, not the session's live skill list; names a skill that is off are skipped by Claude.
const SKILLS: [RegExp, string][] = [
  [/\b(bug|broken|error|fails?|failing|crash|regression|not working|doesn'?t work|still shows)\b/i, 'superpowers:systematic-debugging'],
  // Judging code gets ponytail's review skills. Plain code work gets no hint: ponytail loads itself at session start.
  [/\b(audit|whole (repo|codebase)|find bloat|what can i delete|dead code)\b/i, 'ponytail:ponytail-audit'],
  [/\b(review|critique)\b.*\b(pr|diff|change|commit|branch|code|this)\b|\bcode review\b|\bover-?engineer/i, 'ponytail:ponytail-review'],
  [/\b(shortcuts?|tech(nical)? debt)\b/i, 'ponytail:ponytail-debt'],
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

// A survey of repos or a profile, as opposed to a targeted question about one codebase: only a survey gets the recon checklist.
const SURVEY = /github\.com\/[\w-]+|\b(inspect|analy[sz]e|survey|examine|investigate)\b.{0,50}\b(repos?|repositor(y|ies)|profile|codebase)\b/i

// A short question, even one that names a URL (isQuestion treats a path-like word as code): it asks about work, it does not order a survey.
const asksOnly = (text: string): boolean => text.length <= 400 && (QUESTION_START.test(text) || /\?\s*$/.test(text))

// A survey of a whole profile or several repos (not one named repo): the main session must not read these itself.
const MANY = /\b(repos|repositories|profile)\b|github\.com\/[\w-]+\/?(?=[\s)\].,"']|$)/i
// Cloning, or fetching repo files over the API: the first step of reading a repo yourself.
const CLONE = /\b(git\s+clone|gh\s+repo\s+clone)\b|raw\.githubusercontent\.com|(api\.github\.com\/|\bgh\s+api\s+\/?)repos\/[^\s"']+\/(contents|git\/trees|readme)/i

/** True when a prompt asks for a survey of several repos, and so gates the main session's own reading. */
export const isSurvey = (text: string): boolean =>
  !asksOnly(text) && routeFor(text)?.agent === A('explore') && SURVEY.test(text) && MANY.test(text)

/** True for a Bash command that clones a repo or fetches its files. */
export const readsRepo = (command: string): boolean => CLONE.test(command)

const READ_ONLY_ROWS = new Set([A('searcher'), A('explore'), A('reader')])

// Late phases. Once the main context is large every call re-reads all of it, so work that is isolated and has a checkable end
// (packaging, end-to-end verification, documentation) is refused in the main session and handed to an agent that starts small.
export const LATE_CONTEXT = 150000
const PACKAGING = /\b(dotnet publish|\.msi\b|wix|inno ?setup|iscc|iexpress|makensis|nsis|pyinstaller|electron-builder|electron-packager|jpackage|cpack|dpkg-deb|rpmbuild|pkgbuild|productbuild|makeappx|msix|flutter build|tauri build|Compress-Archive|gradlew? +(assemble|bundle|installDist|distZip)|npm run (package|dist|make))\b/i
const VERIFY = /\b(dotnet test|npm (run )?(test|verify|e2e)|pnpm (run )?(test|verify)|yarn (run )?(test|verify)|npx (vitest|jest|playwright)|vitest|jest|pytest|go test|cargo test|gradlew? +(test|check)|mvn +(verify|test)|ctest|make +(test|check)|phpunit|rspec|flutter test)\b|\b(verify|smoke|e2e)[-_a-z0-9]*\.(ps1|sh|py|mjs|js|cmd)\b/i
const DOCS = /(^|[\\/])(README|ARCHITECTURE|CONTRIBUTING|USAGE|INSTALL|CHANGELOG|HANDOFF)\.md$|(^|[\\/])docs[\\/].+\.md$/i

// Running the app that was just built, or taking a screenshot of it, is verification too (the V9 build checked itself with `--selftest` and screenshots).
const BUILT_EXE = /^(start-process\b|start\b|call\b|&\s*)?\s*["']?([^\s"']*[\\/])?(bin|publish|dist|out|release|debug|build|target)[\\/][^\s"']*\.(exe|app)\b|--self-?test\b/i
const SCREENSHOT = /CopyFromScreen|\bscreencapture\b|\bscrot\b|Save-?Screenshot|--screenshot\b/i
// A command that only looks at things or runs an inline script: words in its text (a script mentioning "wix", a grep for "jest") say nothing about what it runs.
const ANALYSIS = /^(grep|egrep|rg|ag|cat|head|tail|sed|awk|ls|dir|find|wc|echo|type|printf|git|stat|du|diff|cmp|sort|uniq|cut|tr|file|get-content|get-childitem|get-item|select-string|measure-object|write-output|write-host|test-path|cd|pushd|popd|mkdir|cp|copy|mv|move|rm|del)\b|^(node|nodejs)\s+(-e|--eval|-p|--print)\b|^(python3?|py)\s+(-c\b|-(\s|$))/i

/** The late-phase agent a shell command belongs to, if any. Splits the command into its parts and ignores a heredoc body and analysis-only parts. */
export const phaseOfCommand = (command: string): string | undefined => {
  const head = command.replace(/<<-?\s*['"]?\w+[\s\S]*$/, '')
  for (const part of head.split(/&&|\|\||;|\||\r?\n/)) {
    const s = part.trim()
    if (!s || ANALYSIS.test(s)) continue
    if (PACKAGING.test(s)) return A('packager')
    if (VERIFY.test(s) || BUILT_EXE.test(s) || SCREENSHOT.test(s)) return A('inspector')
  }
  return undefined
}

const IMAGE = /\.(png|jpe?g|webp|gif|bmp)$/i
/** True for an image file path (a screenshot the main session would read into its context). */
export const isImagePath = (path: string): boolean => IMAGE.test(path)

/** True for a documentation path the documenter owns. */
export const isDocPath = (path: string): boolean => DOCS.test(path)

const PHASE_WHAT: Record<string, string> = {
  [A('packager')]: 'the packaging and its install and uninstall check',
  [A('inspector')]: 'the end-to-end checks and UI review',
  [A('documenter')]: 'the README, architecture notes, CHANGELOG and HANDOFF',
}

/** The routing note for one prompt, or undefined when nothing fits. */
export const routeNote = (text: string, hinted: Set<string> = new Set()): string | undefined => {
  const lines: string[] = []
  const question = isQuestion(text)
  // A question asks about work, not for it: it may still go to a read-only agent, never to one that changes code.
  // A long brief names many risky-sounding words in passing (permissions, deletion): a keyword row on it misleads, so only a survey keeps its note.
  const long = text.length > 600 && !(SURVEY.test(text) && MANY.test(text) && !asksOnly(text))
  const r = long ? undefined : routeFor(text, question ? ROUTES.filter(x => READ_ONLY_ROWS.has(x.agent)) : ROUTES)
  const survey = r?.agent === A('explore') && SURVEY.test(text)
  if (r?.agent === A('reader'))
    lines.push('auto-route: this ask only reads a guide, post or link. Hand the reading to the `auto-route:reader` subagent (haiku) with the link or path and what to pull out, then relay its summary. Read it yourself only if it is one short local file.')
  else if (r)
    lines.push(`auto-route: this ask matches the \`${r.agent}\` row (${r.model}): ${r.work}. ${survey ? '' : ' Delegate that part only if it needs over ~20k tokens of reading.'}${survey ? ' For this survey, delegate the reading: clone the repos in one command, then in your next message spawn up to 3 `auto-route:explore` agents with model "haiku" (group small repos) and read no repo file yourself first. Per repo, gather: purpose; stack with versions; structure with wc -l of the main files; tests (framework, file count); CI; docs; commit count and date range (git rev-list --count, git log); notable decisions with file:line; known limits or hygiene problems; asset paths and sizes. Only a single small repo (under ~50 source files) may be read by you; every agent goes in the same message, briefed with this list, "facts as path:line plus quote, no opinions" and a cap of 40 lines per repo, one fact per line (their reports stay in your context for every later call). Every claim you publish carries a file:line or a command count: count, never estimate. While subagents run, keep working on what does not need their results (set up the project, install, write code that does not depend on them); do not end the turn to wait. Before you finish, recheck about five published numbers against the source in one batched command and fix any mismatch. When the build is done, run lint, type, test and build yourself in one batched command; hand them to `auto-route:verifier` only for a long suite (over ~3k tokens of output), and never poll with sleep. You still read each failure and fix it, and you do not claim done on the word of a subagent without its exit lines.' : ''}`)
  // Each skill is hinted once per session, and a plain question gets none: a repeat only adds context tokens.
  if (r && !hinted.has('rules')) {
    hinted.add('rules')
    lines.unshift(RULES)
  }
  // A long brief mentions "errors" or "design" in passing; keyword hints on it load skills the work does not need.
  const skills = question || text.length > 600 ? [] : skillsFor(text).filter(s => !hinted.has(s))
  skills.forEach(s => hinted.add(s))
  if (skills.length)
    lines.push(`auto-route: skills that match this ask: ${skills.map(s => `\`${s}\``).join(', ')}. Load the first one whose description fits before you start; skip any that do not fit or are not installed.`)
  return lines.length ? lines.join('\n') : undefined
}

const LABELS = ['chat', 'tech-question', 'task']

export const register: Register = (on, options) => {
  const limits = { haiku: Number(options.haikuUpTo ?? 100000), sonnet: Number(options.sonnetUpTo ?? 50000) }
  const hinted = new Set<string>()
  // A survey the model answered by cloning and reading every repo itself ran in V3 and V6 despite the note, so the note is enforced:
  // until an explore agent has been spawned, the main session's clone or raw-file fetch is refused. It gives way after 2 refusals.
  let gated = false
  let refused = 0
  // Late-phase agents spawned this session, and how often each one's work was refused in the main session (it gives way after 2).
  const lifted = new Set<string>()
  const lateRefused = new Map<string, number>()
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

  // A plugin agent's own `model:` is not applied to a background run, so a Haiku row ran on Sonnet (the V4 test: explore on Sonnet, 48% of the limit).
  // Set it here from the table, only where the caller named none and only for the cheap rows.
  const CHEAP = new Map(ROUTES.filter(r => r.model === 'haiku' || r.model === 'sonnet').map(r => [r.agent, r.model]))
  on('agent.spawn', (_, e, next) => {
    if (e.subagentType === A('explore')) gated = false
    if (e.subagentType in PHASE_WHAT) lifted.add(e.subagentType)
    const model = CHEAP.get(e.subagentType)
    return next(model && !e.model && !e.fork ? { ...e, model } : e)
  })

  // The table goes to the session that can delegate: a subagent's request offers no Agent tool.
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    if (!e.tools.includes('Agent')) return r
    return { sections: [...r.sections.filter(s => s.id !== 'auto-route:routing'), { id: 'auto-route:routing', text: RULES_LITE, scope: 'session' }] }
  })
  on('prompt.submit', ($, e, next) => {
    // Slash commands and prompts the person did not type carry their own instructions.
    if (e.command || e.isMeta) return next(e)
    gated = isSurvey(e.text)
    refused = 0
    const note = routeNote(e.text, hinted)
    return next(note ? { ...e, context: [...(e.context ?? []), note] } : e)
  })
  // Subagent calls carry an agentId; the main session's do not.
  const DENY = 'auto-route: this is a survey of several repos. Spawn up to 3 `auto-route:explore` agents now, in one message, with model "haiku" and the repo URLs (group small repos); they clone and read, you do not. Then continue with work that does not need their reports.'
  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    if (!gated || e.agentId || !readsRepo(e.command) || ++refused > 2) return next(e)
    return { deny: DENY }
  })
  on('tool.call', { tool: 'WebFetch' }, ($, e, next) => {
    if (!gated || e.agentId || !readsRepo(String(e.url)) || ++refused > 2) return next(e)
    return { deny: DENY }
  })

  // The main session's late phases: past LATE_CONTEXT tokens, packaging, end-to-end checks and documentation go to an agent in a fresh context.
  // Refused until that agent type has been spawned, and the refusal gives way after 2 so it can never trap the model.
  const lateDeny = (agent: string | undefined): { deny: string } | undefined => {
    if (!agent || context < LATE_CONTEXT || lifted.has(agent)) return undefined
    const n = (lateRefused.get(agent) ?? 0) + 1
    lateRefused.set(agent, n)
    if (n > 2) return undefined
    return { deny: `auto-route: the main context is ${Math.round(context / 1000)}k tokens and every call re-reads all of it. Hand ${PHASE_WHAT[agent]} to \`${agent}\`: brief it with the project folder, the commands, the requirements and what is done when it passes. It runs in a fresh context and reports; you fix what it reports and ask again only for what changed.` }
  }
  for (const tool of ['Bash', 'PowerShell'] as const)
    on('tool.call', { tool }, ($, e, next) => (e.agentId ? next(e) : lateDeny(phaseOfCommand(String(e.command))) ?? next(e)))
  for (const tool of ['Write', 'Edit'] as const)
    on('tool.call', { tool }, ($, e, next) => (e.agentId || !isDocPath(String(e.file_path)) ? next(e) : lateDeny(A('documenter')) ?? next(e)))
  // An image read into the main context stays there for every later call. After the second one, in a late session, reviewing screenshots goes to the inspector.
  let imageReads = 0
  on('tool.call', { tool: 'Read' }, ($, e, next) => {
    if (e.agentId || !isImagePath(String(e.file_path))) return next(e)
    imageReads++
    return (imageReads > 2 ? lateDeny(A('inspector')) : undefined) ?? next(e)
  })
}
