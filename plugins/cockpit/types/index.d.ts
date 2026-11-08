export type TaskStatus = 'pending' | 'in_progress' | 'completed'

export type Task = { content: string; status: TaskStatus }

declare module 'claude-code' {
  interface PluginState {
    cockpit: {
      /** The app's task list, mirrored from each update_plan / wrap_up call. */
      tasks: Task[]
      /** Whether the TASKS row lists every task or one summary line. */
      isTasksOpen: boolean
    }
  }
}
