import { layerTurnToToken, tokenToLayerTurn } from '../adapter/nxnModel'
import { getEngine, invertToken, isSolvedState } from '../nxn/engine'
import type { SolveResult } from '../nxn/solveRubik'

/**
 * Step-by-step guidance for any size with n×n engine tokens in the scene frame.
 * A wrong turn is undone first (its inverse is inserted before the next step); no re-solve,
 * so the beginner's step list stays the one the solver chose.
 */
export type NxnPhase = 'SCANNING' | 'REVIEWING' | 'SOLVING' | 'GUIDING' | 'COMPLETED' | 'ERROR'

export interface NxnStage {
  title: string
  algorithms: string[]
  /** Range of `solution` indices, end exclusive. */
  start: number
  end: number
}

export interface NxnGuideState {
  phase: NxnPhase
  size: number
  epoch: number
  scanId: number
  /** The state we believe the physical cube is in (labels 0..5, URFDLB). */
  stickers: Uint8Array | null
  solution: string[]
  stages: NxnStage[]
  index: number
  /** Dragged single-layer turns that are part of the current step so far (a quarter of R2, a layer of Rw). */
  partial: string[]
  history: string[]
  algorithm: string | null
  solveMs: number | null
  error: string | null
  errorKind: 'invalid' | 'timeout' | 'failed' | null
}

export type NxnGuideEvent =
  /** New size: forget everything. */
  | { type: 'RESET'; size: number }
  /** The 3D cube was reset to solved: whatever was being solved is over. */
  | { type: 'RESET_SOLVED' }
  | { type: 'START_SCAN' }
  | { type: 'SCANNED'; stickers: Uint8Array }
  | { type: 'BACK_TO_SCAN' }
  | { type: 'CONFIRM_REVIEW' }
  | { type: 'SOLVED'; epoch: number; result: SolveResult }
  | { type: 'SOLVE_FAILED'; epoch: number; kind: 'invalid' | 'timeout' | 'failed'; message: string }
  /** One turn on the real cube: the "done" button (the whole step) or a dragged layer. */
  | { type: 'TURNED'; token: string }

export function initialNxnGuide(size: number): NxnGuideState {
  return {
    phase: 'SCANNING',
    size,
    epoch: 0,
    scanId: 0,
    stickers: null,
    solution: [],
    stages: [],
    index: 0,
    partial: [],
    history: [],
    algorithm: null,
    solveMs: null,
    error: null,
    errorKind: null
  }
}

export function expectedTurn(s: NxnGuideState): string | null {
  return s.phase === 'GUIDING' ? (s.solution[s.index] ?? null) : null
}

export function currentStage(s: NxnGuideState): NxnStage | null {
  return s.stages.find((st) => s.index >= st.start && s.index < st.end) ?? null
}

/** A single inner layer named from the nearer face (4R on a 5x5 → 2L'), easier to find. */
function readable(token: string, n: number): string {
  const turn = tokenToLayerTurn(token, n)
  const single = turn.layers.length === 1 && !/w|^[a-z]/.test(token)
  return single ? (layerTurnToToken({ axis: turn.axis, layer: turn.layers[0] as number, steps: turn.steps }, n) ?? token) : token
}

const norm = (x: number) => ((x % 4) + 4) % 4

/**
 * Quarter turns made so far on each layer of `step` by the dragged single-layer `turns`, or
 * null when they are not on the way to it. A half turn accepts either direction (R R or R' R'
 * for R2); a quarter turn only its own direction. Turns on one axis commute, so order is free.
 */
function progress(step: string, turns: readonly string[], n: number): Map<number, number> | null {
  const target = tokenToLayerTurn(step, n)
  const done = new Map(target.layers.map((l) => [l, 0]))
  for (const t of turns) {
    const turn = tokenToLayerTurn(t, n)
    const layer = turn.layers[0] as number
    if (turn.axis !== target.axis || turn.layers.length !== 1 || !done.has(layer)) return null
    done.set(layer, norm((done.get(layer) as number) + turn.steps))
  }
  const goal = norm(target.steps)
  if (goal !== 2 && [...done.values()].some((v) => v !== 0 && v !== goal)) return null
  return done
}

/** Single-layer turns still missing from the step after the dragged `partial` ones. */
export function remainingParts(step: string, partial: readonly string[], n: number): string[] {
  const done = partial.length ? progress(step, partial, n) : null
  if (!done) return [step]
  const target = tokenToLayerTurn(step, n)
  return target.layers
    .map((layer) => {
      const left = norm(target.steps - (done.get(layer) as number))
      return layerTurnToToken({ axis: target.axis, layer, steps: left === 3 ? -1 : left }, n)
    })
    .filter((t): t is string => t !== null)
}

function sameState(a: Uint8Array, b: Uint8Array): boolean {
  return a.every((v, i) => v === b[i])
}

export function nxnGuideReducer(s: NxnGuideState, e: NxnGuideEvent): NxnGuideState {
  switch (e.type) {
    case 'RESET':
      return { ...initialNxnGuide(e.size), epoch: s.epoch + 1, scanId: s.scanId + 1 }

    case 'START_SCAN':
      return { ...initialNxnGuide(s.size), epoch: s.epoch + 1, scanId: s.scanId + 1 }

    case 'RESET_SOLVED':
      return { ...initialNxnGuide(s.size), phase: 'COMPLETED', stickers: getEngine(s.size).solved(), epoch: s.epoch + 1, scanId: s.scanId + 1 }

    case 'SCANNED':
      if (s.phase !== 'SCANNING') return s
      return { ...s, phase: 'REVIEWING', stickers: e.stickers, epoch: s.epoch + 1, error: null, errorKind: null }

    case 'BACK_TO_SCAN':
      return s.phase === 'REVIEWING' || s.phase === 'ERROR' ? { ...s, phase: 'SCANNING', epoch: s.epoch + 1 } : s

    case 'CONFIRM_REVIEW':
      if (s.phase !== 'REVIEWING' || !s.stickers) return s
      if (isSolvedState(s.stickers, s.size)) return { ...s, phase: 'COMPLETED' }
      return { ...s, phase: 'SOLVING', epoch: s.epoch + 1 }

    case 'SOLVED': {
      if (e.epoch !== s.epoch || s.phase !== 'SOLVING') return s
      let at = 0
      const stages = e.result.steps.map((st) => {
        const stage = { title: st.title, algorithms: st.algorithms, start: at, end: at + st.moves.length }
        at = stage.end
        return stage
      })
      const base = { ...s, solution: e.result.moves.map((t) => readable(t, s.size)), stages, index: 0, partial: [], algorithm: e.result.algorithm, solveMs: e.result.executionTimeMs }
      return e.result.moves.length ? { ...base, phase: 'GUIDING' } : { ...base, phase: 'COMPLETED' }
    }

    case 'SOLVE_FAILED':
      if (e.epoch !== s.epoch) return s
      return { ...s, phase: 'ERROR', error: e.message, errorKind: e.kind }

    case 'TURNED': {
      if (s.phase !== 'GUIDING' || !s.stickers) return s
      const engine = getEngine(s.size)
      const stickers = engine.apply(s.stickers, e.token)
      const history = [...s.history, e.token]
      if (isSolvedState(stickers, s.size)) return { ...s, stickers, history, phase: 'COMPLETED', partial: [] }
      const step = s.solution[s.index] as string
      const before = s.partial.reduce((x, t) => engine.apply(x, invertToken(t)), s.stickers)
      if (sameState(stickers, engine.apply(before, step))) return { ...s, stickers, history, index: s.index + 1, partial: [] }
      const tried = [...s.partial, e.token]
      const done = progress(step, tried, s.size)
      // On the way to the step (a quarter of a half turn, one layer of a wide turn) or back at its start.
      if (done) return { ...s, stickers, history, partial: [...done.values()].every((v) => v === 0) ? [] : tried }
      // Wrong turn: undo what was turned since the last finished step, then carry on.
      const undo = tried.reverse().map(invertToken)
      const shift = (x: number) => (x > s.index ? x + undo.length : x)
      return {
        ...s,
        stickers,
        history,
        partial: [],
        solution: [...s.solution.slice(0, s.index), ...undo, ...s.solution.slice(s.index)],
        stages: s.stages.map((st) => ({ ...st, start: shift(st.start), end: shift(st.end) }))
      }
    }
  }
}
