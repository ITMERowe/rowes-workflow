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
  /** The Map's zoom: 0 chips, 1 cards (default), 2 detailed cards. */
  mapZoom?: number
  autoOpenedFor: string
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed'

/** One step of the app's task list (update_plan). */
export type Task = { content: string; status: TaskStatus }

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

/** One community of code as graphify grouped it (graphify-out/graph.json). */
export type Community = { id: number; name: string; files: string[]; symbols: number }

/** The project map the panel draws: the largest communities and the links between them. */
export type ProjectMap = {
  mtimeMs: number
  /** How many communities the graph has, shown or not. */
  total: number
  communities: Community[]
  /** [community, community, how many calls and references cross between them] */
  links: [number, number, number][]
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
}

declare module 'claude-code' {
  interface PluginState {
    'savvy-progress': {
      flow: Flow | null
      agents: AgentRun[]
      bg: BgTask[]
      work: WorkItem[]
      tasks: Task[]
      kit: SkillUse[]
      mainIdleAt: number
      panel: Panel
      now: number
    }
  }
}
