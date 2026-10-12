/// <reference lib="webworker" />
import { buildTables, type Tables } from './coords'
import { buildOptimalTables, solveOptimal, type OptimalTables } from './optimal'
import type { FromSolverWorker, ToSolverWorker } from './protocol'
import { solve } from './twophase'

declare const self: DedicatedWorkerGlobalScope

let tables: Tables | null = null
// Built on the first optimal request (~1 s, ~30 MB), not at startup.
let optimalTables: OptimalTables | null = null

function post(message: FromSolverWorker) {
  self.postMessage(message)
}

self.onmessage = (event: MessageEvent<ToSolverWorker>) => {
  const msg = event.data
  try {
    if (msg.type === 'init') {
      const t0 = performance.now()
      tables ??= buildTables()
      post({ type: 'ready', buildMs: performance.now() - t0 })
      return
    }
    if (msg.type === 'solve') {
      tables ??= buildTables()
      const r = solve(msg.state, tables, msg.options)
      post({ type: 'solution', jobId: msg.jobId, moves: r.moves, ms: r.ms, timedOut: r.timedOut })
    }
    if (msg.type === 'solveOptimal') {
      optimalTables ??= buildOptimalTables()
      const r = solveOptimal(msg.state, optimalTables, msg.options)
      post({ type: 'optimal', jobId: msg.jobId, moves: r.moves, provenLowerBound: r.provenLowerBound, ms: r.ms })
    }
  } catch (err) {
    post({
      type: 'error',
      jobId: msg.type === 'init' ? undefined : msg.jobId,
      message: err instanceof Error ? err.message : String(err)
    })
  }
}
