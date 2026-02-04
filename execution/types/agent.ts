export type State = 'PLAN' | 'IMPLEMENT' | 'VERIFY' | 'DONE' | 'FAIL'

export interface Execution {
  id: string
  state: State
  agent: string
  startedAt: Date
  completedAt?: Date
  error?: Error
}

export interface ExecutionLock {
  acquired: boolean
  acquiredAt?: Date
  processId: number
}
