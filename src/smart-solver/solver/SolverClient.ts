import type { CubieState, Move } from '../core/types'
import type { FromSolverWorker, ToSolverWorker } from './protocol'
import type { OptimalOptions } from './optimal'
import type { SolveOptions } from './twophase'

export interface Solution {
  moves: Move[]
  ms: number
  timedOut: boolean
}

export interface OptimalSolution {
  /** Proven shortest path, or null when the time budget ran out. */
  moves: Move[] | null
  provenLowerBound: number
  ms: number
}

type Pending = { resolve: (value: never) => void; reject: (e: Error) => void }

/** Main-thread handle to the solver worker; tables are built once per worker. */
export class SolverClient {
  readonly ready: Promise<number>
  private readonly worker: Worker
  private readonly pending = new Map<number, Pending>()
  private nextJob = 1

  constructor() {
    this.worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })
    let onReady: (ms: number) => void = () => {}
    let onFail: (e: Error) => void = () => {}
    this.ready = new Promise<number>((resolve, reject) => {
      onReady = resolve
      onFail = reject
    })
    this.worker.onmessage = (event: MessageEvent<FromSolverWorker>) => {
      const msg = event.data
      if (msg.type === 'ready') onReady(msg.buildMs)
      if (msg.type === 'solution') this.settle(msg.jobId, { moves: msg.moves, ms: msg.ms, timedOut: msg.timedOut })
      if (msg.type === 'optimal') this.settle(msg.jobId, { moves: msg.moves, provenLowerBound: msg.provenLowerBound, ms: msg.ms })
      if (msg.type === 'error') {
        const error = new Error(msg.message)
        if (msg.jobId === undefined) onFail(error)
        else {
          this.pending.get(msg.jobId)?.reject(error)
          this.pending.delete(msg.jobId)
        }
      }
    }
    this.worker.onerror = (event) => {
      const error = new Error(event.message || 'solver worker failed')
      onFail(error)
      this.pending.forEach((p) => p.reject(error))
      this.pending.clear()
    }
    this.send({ type: 'init' })
  }

  /** Near-optimal two-phase solution, typically well under a second. */
  solve(state: CubieState, options?: Partial<SolveOptions>): Promise<Solution> {
    return this.request<Solution>((jobId) => ({ type: 'solve', jobId, state, options }))
  }

  /** Proven shortest solution within the time budget. Jobs run one at a time in the worker. */
  solveOptimal(state: CubieState, options?: Partial<OptimalOptions>): Promise<OptimalSolution> {
    return this.request<OptimalSolution>((jobId) => ({ type: 'solveOptimal', jobId, state, options }))
  }

  private request<T>(build: (jobId: number) => ToSolverWorker): Promise<T> {
    const jobId = this.nextJob++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(jobId, { resolve: resolve as (value: never) => void, reject })
      this.send(build(jobId))
    })
  }

  private settle(jobId: number, value: Solution | OptimalSolution) {
    this.pending.get(jobId)?.resolve(value as never)
    this.pending.delete(jobId)
  }

  dispose() {
    this.pending.forEach((p) => p.reject(new Error('solver disposed')))
    this.pending.clear()
    this.worker.terminate()
  }

  private send(msg: ToSolverWorker) {
    this.worker.postMessage(msg)
  }
}
