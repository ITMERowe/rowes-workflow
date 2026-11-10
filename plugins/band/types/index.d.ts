export type Phase = 'plan' | 'design' | 'delegate' | 'review' | 'close'

export type PlannedTask = {
  title: string
  tier: string
  after: number[]
}

export type Flow = {
  title: string
  total: number
  done: number
  running: number
  phase: Phase
  isFinished: boolean
  tasks: PlannedTask[]
}

/** Input, output, cache read, cache write: the order the price table uses. */
export type Quad = [number, number, number, number]

/** Model requests summed by token kind, with the estimated cost of each kind. */
export type Split = { requests: number; tokens: Quad; usd: Quad; /** The model of the last request. */ model?: string }

export type AgentStatus = 'running' | 'done' | 'failed'

export type AgentRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  effort?: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  contextTokens: number
  contextMax: number
  tokens: number
  costUsd: number
  steps: number
  round: number
  /** Self-reported by the worker through the `step` tool. */
  stepDone?: number
  stepTotal?: number
  stepNote?: string
}

export type Panel = {
  isCompact: boolean
  isDoneCollapsed: boolean
  /** Folded sections, by key: run, plan, tasks, bg. Finished uses isDoneCollapsed. */
  collapsed?: Record<string, boolean>
  /** Each section's own scroll: the first item it shows. */
  offsets?: Record<string, number>
  autoOpenedFor: string
  /** Rows whose tool-call list is shown, by row key. */
  openRows?: string[]
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed'

/** One step of the app's task list (update_plan). */
export type Task = {
  content: string
  status: TaskStatus
  /** When it first went in progress, and when it completed: the window its main-session tool calls fall in. */
  startedAt?: number
  endedAt?: number
}

export type WorkKind = 'read' | 'edit' | 'cli' | 'search' | 'web'

/** One tool call: what the main session or a subagent read, edited, ran or looked up. */
export type WorkItem = {
  /** 'main', or the agentId of the subagent that made the call. */
  who: string
  kind: WorkKind
  label: string
  at: number
  /** The file it read or edited, as the tool was given it. */
  path?: string
}

export type SkillKind = 'skill' | 'plugin'

/** A skill or plugin the session used: its last use, by whom, and how often. */
export type SkillUse = {
  name: string
  kind: SkillKind
  /** 'main', or the agentId of the subagent that used it. */
  who: string
  at: number
  count: number
}

export type BgTask = {
  id: string
  kind: 'shell' | 'monitor'
  label: string
  status: 'running' | 'done' | 'failed'
  startedAt: number
  endedAt?: number
  /** When it is over at the latest (a Monitor's timeout): past it, a lost notice no longer keeps it running. */
  endsBy?: number
}

declare module 'claude-code' {
  interface PluginState {
    'band': {
      flow: Flow | null
      agents: AgentRun[]
      bg: BgTask[]
      work: WorkItem[]
      tasks: Task[]
      kit: SkillUse[]
      /** Plugins whose SessionStart hook added context: on for the whole session. */
      modes: string[]
      mainIdleAt: number
      /** The main session's own model requests, summed by token kind. */
      mainSplit: Split
      panel: Panel
      now: number
    }
  }
}
