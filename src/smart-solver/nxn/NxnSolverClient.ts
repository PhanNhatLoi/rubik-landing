import type { CubeSize } from './engine'
import type { FromNxnWorker, NxnErrorKind, ToNxnWorker } from './nxn.worker'
import type { SolveOptions, SolveResult } from './solveRubik'
import type { CubeState } from './state'

export class NxnSolveError extends Error {
  constructor(
    readonly kind: NxnErrorKind,
    message: string
  ) {
    super(message)
    this.name = 'NxnSolveError'
  }
}

/** Runs solveRubik in a worker so 4x4/5x5 searches never block the 3D view. */
export class NxnSolverClient {
  private readonly worker: Worker
  private readonly pending = new Map<number, { resolve: (r: SolveResult) => void; reject: (e: Error) => void }>()
  private nextJob = 1

  constructor() {
    this.worker = new Worker(new URL('./nxn.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<FromNxnWorker>) => {
      const msg = event.data
      const job = this.pending.get(msg.jobId)
      if (!job) return
      this.pending.delete(msg.jobId)
      if (msg.type === 'result') job.resolve(msg.result)
      else job.reject(new NxnSolveError(msg.kind, msg.message))
    }
    this.worker.onerror = (event) => {
      const error = new NxnSolveError('failed', event.message || 'solver worker failed')
      this.pending.forEach((p) => p.reject(error))
      this.pending.clear()
    }
  }

  solve(size: CubeSize, state: CubeState, options?: SolveOptions): Promise<SolveResult> {
    const jobId = this.nextJob++
    return new Promise((resolve, reject) => {
      this.pending.set(jobId, { resolve, reject })
      this.worker.postMessage({ type: 'solve', jobId, size, state, options } satisfies ToNxnWorker)
    })
  }

  dispose() {
    this.pending.forEach((p) => p.reject(new NxnSolveError('failed', 'solver disposed')))
    this.pending.clear()
    this.worker.terminate()
  }
}
