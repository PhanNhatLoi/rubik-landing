import { applyMove } from '../core/cubie'
import { validateState } from '../core/facelets'
import { MOVES, type CubieState, type Move } from '../core/types'
import {
  N_SLICE,
  N_SPERM,
  PHASE2_MOVES,
  getCornerPerm,
  getFlip,
  getSlice,
  getSlicePerm,
  getTwist,
  getUDEdgePerm,
  type Tables
} from './coords'

export interface SolveOptions {
  /** Stop as soon as a solution this short is found (0 = keep shortening until timeout). */
  targetLength: number
  /** Give up improving after this long (a first solution is always returned if one exists within maxLength). */
  timeoutMs: number
  maxLength: number
}

const DEFAULTS: SolveOptions = { targetLength: 0, timeoutMs: 1000, maxLength: 24 }

export interface SolveResult {
  moves: Move[]
  /** Nodes expanded, for benchmarking. */
  nodes: number
  ms: number
  /** True when the search ended because of the time limit rather than reaching targetLength. */
  timedOut: boolean
}

const face = (m: number) => Math.floor(m / 3)
const IS_PHASE2 = MOVES.map((_, i) => PHASE2_MOVES.includes(i))

/** Rejects redundant sequences: same face twice, or opposite faces in the "wrong" order (D then U). */
function allowedAfter(last: number, m: number): boolean {
  if (last < 0) return true
  const f = face(m)
  const lf = face(last)
  if (f === lf) return false
  return !(f % 3 === lf % 3 && f < lf)
}

export function solve(start: CubieState, tables: Tables, options: Partial<SolveOptions> = {}): SolveResult {
  const opts = { ...DEFAULTS, ...options }
  if (validateState(start).length) throw new Error('invalid cube state')
  const t0 = performance.now()
  const T = tables
  let nodes = 0
  let best: number[] | null = null
  let timedOut = false
  const path1: number[] = []
  const path2: number[] = []

  const h1 = (twist: number, flip: number, slice: number) =>
    Math.max(T.twistSlicePrune[twist * N_SLICE + slice] as number, T.flipSlicePrune[flip * N_SLICE + slice] as number)
  const h2 = (cperm: number, udperm: number, sperm: number) =>
    Math.max(T.cpermSpermPrune[cperm * N_SPERM + sperm] as number, T.udpermSpermPrune[udperm * N_SPERM + sperm] as number)

  const outOfTime = () => {
    if ((nodes & 1023) === 0 && performance.now() - t0 > opts.timeoutMs && best) timedOut = true
    return timedOut
  }

  function search2(cperm: number, udperm: number, sperm: number, depth: number, last: number): boolean {
    nodes += 1
    if (depth === 0) return cperm === 0 && udperm === 0 && sperm === 0
    for (const m of PHASE2_MOVES) {
      if (!allowedAfter(last, m)) continue
      const c = T.cpermMove[cperm * 18 + m] as number
      const u = T.udpermMove[udperm * 18 + m] as number
      const s = T.spermMove[sperm * 18 + m] as number
      if (h2(c, u, s) >= depth) continue
      path2.push(m)
      if (search2(c, u, s, depth - 1, m)) return true
      path2.pop()
    }
    return false
  }

  function phase2() {
    let s = start
    for (const m of path1) s = applyMove(s, MOVES[m] as Move)
    const cperm = getCornerPerm(s)
    const udperm = getUDEdgePerm(s)
    const sperm = getSlicePerm(s)
    const limit = (best ? best.length - 1 : opts.maxLength) - path1.length
    const last = path1.length ? (path1[path1.length - 1] as number) : -1
    for (let d2 = h2(cperm, udperm, sperm); d2 <= limit; d2 += 1) {
      path2.length = 0
      if (search2(cperm, udperm, sperm, d2, last)) {
        best = [...path1, ...path2]
        return
      }
    }
  }

  function search1(twist: number, flip: number, slice: number, depth: number, last: number): boolean {
    nodes += 1
    if (depth === 0) {
      // A phase-1 solution ending in a phase-2 move is a longer copy of a shorter one.
      if (twist === 0 && flip === 0 && slice === 0 && (last < 0 || !IS_PHASE2[last])) {
        phase2()
        if (best && best.length <= opts.targetLength) return true
      }
      return outOfTime()
    }
    for (let m = 0; m < 18; m += 1) {
      if (!allowedAfter(last, m)) continue
      const t = T.twistMove[twist * 18 + m] as number
      const f = T.flipMove[flip * 18 + m] as number
      const s = T.sliceMove[slice * 18 + m] as number
      if (h1(t, f, s) >= depth) continue
      path1.push(m)
      if (search1(t, f, s, depth - 1, m)) return true
      path1.pop()
      if (timedOut) return true
    }
    return false
  }

  const twist = getTwist(start)
  const flip = getFlip(start)
  const slice = getSlice(start)
  for (let d1 = h1(twist, flip, slice); d1 <= opts.maxLength; d1 += 1) {
    const currentBest: number[] | null = best
    if (currentBest !== null && d1 >= (currentBest as number[]).length) break
    path1.length = 0
    if (search1(twist, flip, slice, d1, -1)) break
  }

  const solution: number[] = best ?? []
  return {
    moves: solution.map((m) => MOVES[m] as Move),
    nodes,
    ms: performance.now() - t0,
    timedOut
  }
}
