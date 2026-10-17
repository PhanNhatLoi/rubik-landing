import { solveLearning3 } from '../../learn/engine/solveLearning'
import { fromFacelets } from '../core/facelets'
import { buildTables, type Tables } from '../solver/coords'
import { solve as solveTwoPhase } from '../solver/twophase'
import { solveBeginner2, solveBeginner3 } from './beginner'
import { FACE_ORDER, getEngine, isSolvedState, type CubeSize, type FaceName } from './engine'
import { solveOptimal2 } from './optimal2'
import { reduce, SolveTimeoutError, StuckError } from './reduction'
import { InvalidCubeError, cornersToCubie, normalize, type CubeState } from './state'

export { InvalidCubeError, SolveTimeoutError, StuckError }
export type { CubeSize, CubeState }

/**
 * 'beginner': the layer-by-layer / reduction method of the booklet, step by step (all sizes).
 * 'fast': shortest solutions the app can compute — proven optimal for 2x2, two-phase for 3x3.
 * 4x4 and 5x5 only have the beginner (reduction) method.
 */
export type SolveMode = 'beginner' | 'fast'

export interface SolveOptions {
  mode?: SolveMode
  timeoutMs?: number
}

export interface SolveStep {
  stage: string
  /** Vietnamese title of the step. */
  title: string
  moves: string[]
  /** Booklet techniques used in this step. */
  algorithms: string[]
}

export interface SolveResult {
  size: CubeSize
  moves: string[]
  moveCount: number
  /** True only when the solution is proven shortest (2x2 fast mode). */
  optimal: boolean
  algorithm: string
  executionTimeMs: number
  steps: SolveStep[]
}

/** The solver produced moves that do not solve the cube: a bug, never shown as a solution. */
export class VerificationError extends Error {
  constructor() {
    super('lời giải không đưa khối về trạng thái đã giải')
    this.name = 'VerificationError'
  }
}

let twoPhaseTables: Tables | null = null

export function supportedModes(size: CubeSize): SolveMode[] {
  return size === 2 || size === 3 ? ['beginner', 'fast'] : ['beginner']
}

export async function solveRubik(size: CubeSize, state: CubeState, options: SolveOptions = {}): Promise<SolveResult> {
  const t0 = performance.now()
  const mode = options.mode ?? 'beginner'
  const deadline = t0 + (options.timeoutMs ?? 60000)
  const norm = normalize(size, state)
  const { n, stickers, scheme } = norm
  const target = FACE_ORDER.map((f) => scheme[f])
  const e = getEngine(n)

  let steps: SolveStep[]
  let algorithm: string
  let optimal = false

  if (n === 2) {
    const cubie = cornersToCubie(stickers, n, scheme)
    if (mode === 'fast') {
      const moves = solveOptimal2(cubie)
      steps = moves.length ? [{ stage: 'optimal', title: 'Lời giải ngắn nhất', moves, algorithms: [] }] : []
      algorithm = '2x2 optimal (BFS)'
      optimal = true
    } else {
      steps = solveBeginner2(cubie)
      algorithm = '2x2 beginner (Cresta)'
    }
  } else if (n === 3) {
    const labelOf = new Map(FACE_ORDER.map((f) => [scheme[f], f]))
    const facelets = Array.from(stickers, (c) => labelOf.get(c) as FaceName).join('')
    const parsed = fromFacelets(facelets)
    if (!parsed.ok) throw new InvalidCubeError('unsolvable', `Trạng thái không thể có trên khối thật (${parsed.errors.map((x) => x.kind).join(', ')}).`)
    if (mode === 'fast') {
      twoPhaseTables ??= buildTables()
      const r = solveTwoPhase(parsed.state, twoPhaseTables, { timeoutMs: Math.max(200, Math.min(1000, deadline - performance.now())) })
      steps = r.moves.length ? [{ stage: 'twoPhase', title: 'Lời giải gần tối ưu', moves: r.moves, algorithms: [] }] : []
      algorithm = 'Kociemba two-phase'
    } else {
      steps = solveLearning3(parsed.state)
      algorithm = '3x3 beginner (Cresta)'
    }
  } else {
    const reduced = reduce(stickers, n, target, deadline)
    // After reduction the cube turns like a 3x3 with outer moves only.
    const finish = solveBeginner3(reduced.virtual).map((st) => ({ ...st, moves: st.moves as string[] }))
    steps = [...reduced.steps, ...finish]
    algorithm = `${n}x${n} reduction (Cresta)`
  }

  const moves = steps.flatMap((s) => s.moves)
  // Verify on the real n×n stickers, not on a model.
  if (!isSolvedState(e.applyAll(stickers, moves), n)) throw new VerificationError()
  return { size, moves, moveCount: moves.length, optimal, algorithm, executionTimeMs: performance.now() - t0, steps }
}

