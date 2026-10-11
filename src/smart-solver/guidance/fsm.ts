import { applyMoves, invertMoves, isSolved } from '../core/cubie'
import type { CubieState, Move } from '../core/types'

export type GuidePhase =
  | 'IDLE'
  | 'SCANNING' // reading the cube with the camera
  | 'REVIEWING' // scan shown on the 3D cube; the user compares it with the real cube before solving
  | 'SOLVING' // waiting for the first solution
  | 'GUIDING' // showing the next move
  | 'RECOVERING' // user deviated: a fallback solution is shown while a better one is computed
  | 'VERIFYING' // model says solved: ask for a confirmation scan
  | 'COMPLETED'
  | 'ERROR'

export type ScanPurpose = 'initial' | 'verify'

export interface GuideState {
  phase: GuidePhase
  /** Bumped whenever the believed cube changes; solver results from older epochs are ignored. */
  epoch: number
  scanPurpose: ScanPurpose
  /** Identifies one scan; going back from review keeps it so the scanned faces survive. */
  scanId: number
  /** The state we believe the physical cube is in. */
  cube: CubieState | null
  solution: Move[]
  /** Index of the next move in `solution`. */
  index: number
  /**
   * The remaining moves are a proven shortest path. Stays true while the user follows it,
   * since every tail of a shortest path is itself a shortest path.
   */
  optimal: boolean
  /** Every move the user reported, in order. */
  history: Move[]
  solveMs: number | null
  error: string | null
}

export type GuideEvent =
  | { type: 'START_SCAN'; purpose: ScanPurpose }
  | { type: 'SCANNED'; cube: CubieState }
  | { type: 'CONFIRM_REVIEW' }
  | { type: 'BACK_TO_SCAN' }
  | { type: 'SOLVED'; epoch: number; moves: Move[]; ms: number }
  | { type: 'SOLVE_FAILED'; epoch: number; message: string }
  /** Proven shortest path from the cube as it was at (epoch, index). */
  | { type: 'OPTIMAL_FOUND'; epoch: number; index: number; moves: Move[] }
  /** The user turned these moves on the real cube (button, picker or 3D drag). */
  | { type: 'MOVES_DONE'; moves: Move[] }
  | { type: 'SKIP_VERIFY' }
  | { type: 'RESET' }

export const INITIAL_GUIDE_STATE: GuideState = {
  phase: 'IDLE',
  epoch: 0,
  scanPurpose: 'initial',
  scanId: 0,
  cube: null,
  solution: [],
  index: 0,
  optimal: false,
  history: [],
  solveMs: null,
  error: null
}

export function expectedMove(s: GuideState): Move | null {
  return s.phase === 'GUIDING' || s.phase === 'RECOVERING' ? (s.solution[s.index] ?? null) : null
}

/** True while a solver job should be running for the current epoch. */
export function needsSolve(s: GuideState): boolean {
  return (s.phase === 'SOLVING' || s.phase === 'RECOVERING') && s.cube !== null
}

/** Remaining distance at which a proven-shortest search is worth trying (measured browser limit ~11–14). */
export const OPTIMAL_SEARCH_MAX_REMAINING = 14

/** True when an optimal search from the current step could improve or certify the remaining path. */
export function wantsOptimal(s: GuideState): boolean {
  if (!(s.phase === 'GUIDING' || s.phase === 'RECOVERING') || !s.cube || s.optimal) return false
  return s.index === 0 || s.solution.length - s.index <= OPTIMAL_SEARCH_MAX_REMAINING
}

export function guideReducer(s: GuideState, e: GuideEvent): GuideState {
  switch (e.type) {
    case 'RESET':
      return { ...INITIAL_GUIDE_STATE, epoch: s.epoch + 1 }

    case 'START_SCAN':
      return { ...s, phase: 'SCANNING', scanPurpose: e.purpose, scanId: s.scanId + 1, error: null, epoch: s.epoch + 1 }

    case 'SCANNED': {
      if (s.phase !== 'SCANNING') return s
      const base = { ...s, cube: e.cube, epoch: s.epoch + 1, index: 0, solution: [], optimal: false, error: null }
      if (s.scanPurpose === 'initial') return { ...base, phase: 'REVIEWING', history: [] }
      if (isSolved(e.cube)) return { ...base, phase: 'COMPLETED' }
      // Verification scan found an unsolved cube: recover from what was actually seen.
      return { ...base, phase: 'RECOVERING' }
    }

    case 'BACK_TO_SCAN':
      return s.phase === 'REVIEWING' ? { ...s, phase: 'SCANNING', epoch: s.epoch + 1 } : s

    case 'CONFIRM_REVIEW':
      if (s.phase !== 'REVIEWING' || !s.cube) return s
      if (isSolved(s.cube)) return { ...s, phase: 'COMPLETED' }
      return { ...s, phase: 'SOLVING', epoch: s.epoch + 1 }

    case 'SOLVED': {
      if (e.epoch !== s.epoch || !(s.phase === 'SOLVING' || s.phase === 'RECOVERING')) return s
      const remaining = s.solution.length - s.index
      // In recovery a fallback is already shown; only switch if the new solution is not longer.
      if (s.phase === 'RECOVERING' && s.solution.length && e.moves.length > remaining) {
        return { ...s, phase: 'GUIDING', solveMs: e.ms }
      }
      if (!e.moves.length) return { ...s, phase: 'VERIFYING', solution: [], index: 0, solveMs: e.ms }
      return { ...s, phase: 'GUIDING', solution: e.moves, index: 0, optimal: false, solveMs: e.ms }
    }

    case 'OPTIMAL_FOUND': {
      // Only valid if the user is still at the step the search started from.
      if (e.epoch !== s.epoch || e.index !== s.index || !(s.phase === 'GUIDING' || s.phase === 'RECOVERING')) return s
      if (e.moves.length > s.solution.length - s.index) return s
      return { ...s, phase: 'GUIDING', solution: [...s.solution.slice(0, s.index), ...e.moves], optimal: true }
    }

    case 'SOLVE_FAILED':
      if (e.epoch !== s.epoch) return s
      return { ...s, phase: 'ERROR', error: e.message }

    case 'MOVES_DONE': {
      if (!(s.phase === 'GUIDING' || s.phase === 'RECOVERING') || !s.cube || !e.moves.length) return s
      const cube = applyMoves(s.cube, e.moves)
      const history = [...s.history, ...e.moves]
      const expected = s.solution[s.index]
      const onTrack = e.moves.length === 1 && e.moves[0] === expected
      if (isSolved(cube)) return { ...s, cube, history, phase: 'VERIFYING', solution: [], index: 0, epoch: s.epoch + 1 }
      if (onTrack) {
        // Following a fallback still invalidates the pending solve (it was for an older cube).
        return s.phase === 'RECOVERING'
          ? { ...s, cube, history, index: s.index + 1, epoch: s.epoch + 1 }
          : { ...s, cube, history, index: s.index + 1 }
      }
      // Deviation: undoing it then resuming is always valid; search for something shorter meanwhile.
      return {
        ...s,
        cube,
        history,
        phase: 'RECOVERING',
        solution: [...invertMoves(e.moves), ...s.solution.slice(s.index)],
        index: 0,
        optimal: false,
        epoch: s.epoch + 1
      }
    }

    case 'SKIP_VERIFY':
      return s.phase === 'VERIFYING' ? { ...s, phase: 'COMPLETED' } : s
  }
}
