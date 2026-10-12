import type { CubieState, Move } from '../core/types'
import type { OptimalOptions } from './optimal'
import type { SolveOptions } from './twophase'

export type ToSolverWorker =
  | { type: 'init' }
  | { type: 'solve'; jobId: number; state: CubieState; options?: Partial<SolveOptions> }
  | { type: 'solveOptimal'; jobId: number; state: CubieState; options?: Partial<OptimalOptions> }

export type FromSolverWorker =
  | { type: 'ready'; buildMs: number }
  | { type: 'solution'; jobId: number; moves: Move[]; ms: number; timedOut: boolean }
  | { type: 'optimal'; jobId: number; moves: Move[] | null; provenLowerBound: number; ms: number }
  | { type: 'error'; jobId?: number; message: string }
