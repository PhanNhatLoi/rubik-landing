/// <reference lib="webworker" />
import { InvalidCubeError, SolveTimeoutError, solveRubik, type SolveOptions, type SolveResult } from './solveRubik'
import type { CubeSize } from './engine'
import type { CubeState } from './state'

declare const self: DedicatedWorkerGlobalScope

export type ToNxnWorker = { type: 'solve'; jobId: number; size: CubeSize; state: CubeState; options?: SolveOptions }

export type NxnErrorKind = 'invalid' | 'timeout' | 'failed'

export type FromNxnWorker =
  | { type: 'result'; jobId: number; result: SolveResult }
  | { type: 'error'; jobId: number; kind: NxnErrorKind; message: string }

self.onmessage = async (event: MessageEvent<ToNxnWorker>) => {
  const msg = event.data
  try {
    const result = await solveRubik(msg.size, msg.state, msg.options)
    self.postMessage({ type: 'result', jobId: msg.jobId, result } satisfies FromNxnWorker)
  } catch (err) {
    const kind: NxnErrorKind = err instanceof InvalidCubeError ? 'invalid' : err instanceof SolveTimeoutError ? 'timeout' : 'failed'
    self.postMessage({ type: 'error', jobId: msg.jobId, kind, message: err instanceof Error ? err.message : String(err) } satisfies FromNxnWorker)
  }
}
