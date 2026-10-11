import { SOLVED, moveState, multiply } from '../core/cubie'
import { MOVES, type CubieState } from '../core/types'

/**
 * Coordinates and tables for Kociemba's two-phase algorithm (no symmetry reduction).
 * Move ids are indices into MOVES (U U' U2 R R' R2 F F' F2 D D' D2 L L' L2 B B' B2).
 */

export const N_TWIST = 2187 // 3^7 corner orientations
export const N_FLIP = 2048 // 2^11 edge orientations
export const N_SLICE = 495 // C(12,4) positions of the FR FL BL BR edges
export const N_CPERM = 40320 // 8! corner permutations
export const N_UDPERM = 40320 // 8! permutations of the U/D-layer edges (phase 2)
export const N_SPERM = 24 // 4! permutations of the slice edges (phase 2)

/** Phase-2 move ids: U*, D* and half turns of R, F, L, B. */
export const PHASE2_MOVES: readonly number[] = MOVES.flatMap((m, i) => (/^[UD]/.test(m) || m.endsWith('2') ? [i] : []))

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 0; i < k; i += 1) r = (r * (n - i)) / (i + 1)
  return Math.round(r)
}

const FACTORIAL = [1, 1, 2, 6, 24, 120, 720, 5040, 40320]

/** Lehmer rank of a permutation of 0..n-1. */
export function rankPerm(perm: readonly number[]): number {
  const n = perm.length
  let rank = 0
  for (let i = 0; i < n; i += 1) {
    let smaller = 0
    for (let j = i + 1; j < n; j += 1) if ((perm[j] as number) < (perm[i] as number)) smaller += 1
    rank += smaller * (FACTORIAL[n - 1 - i] as number)
  }
  return rank
}

export function unrankPerm(rank: number, n: number): number[] {
  const pool = Array.from({ length: n }, (_, i) => i)
  const out: number[] = []
  let r = rank
  for (let i = 0; i < n; i += 1) {
    const f = FACTORIAL[n - 1 - i] as number
    const idx = Math.floor(r / f)
    r %= f
    out.push(pool.splice(idx, 1)[0] as number)
  }
  return out
}

export function getTwist(s: CubieState): number {
  let t = 0
  for (let i = 0; i < 7; i += 1) t = t * 3 + (s.co[i] as number)
  return t
}

export function getFlip(s: CubieState): number {
  let f = 0
  for (let i = 0; i < 11; i += 1) f = f * 2 + (s.eo[i] as number)
  return f
}

/** 0 when the four slice edges (ids 8..11) sit in slice positions, in any order. */
export function getSlice(s: CubieState): number {
  let a = 0
  let x = 0
  for (let j = 11; j >= 0; j -= 1) {
    if ((s.ep[j] as number) >= 8) {
      a += binomial(11 - j, x + 1)
      x += 1
    }
  }
  return a
}

export function getCornerPerm(s: CubieState): number {
  return rankPerm(s.cp)
}

/** Only meaningful in G1, where positions 0..7 hold edges 0..7. */
export function getUDEdgePerm(s: CubieState): number {
  return rankPerm(s.ep.slice(0, 8))
}

/** Only meaningful in G1, where positions 8..11 hold edges 8..11. */
export function getSlicePerm(s: CubieState): number {
  return rankPerm(s.ep.slice(8).map((e) => e - 8))
}

function withTwist(t: number): CubieState {
  const co = new Array<number>(8).fill(0)
  let sum = 0
  for (let i = 6; i >= 0; i -= 1) {
    co[i] = t % 3
    sum += co[i] as number
    t = Math.floor(t / 3)
  }
  co[7] = (3 - (sum % 3)) % 3
  return { ...SOLVED, co }
}

function withFlip(f: number): CubieState {
  const eo = new Array<number>(12).fill(0)
  let sum = 0
  for (let i = 10; i >= 0; i -= 1) {
    eo[i] = f % 2
    sum += eo[i] as number
    f = Math.floor(f / 2)
  }
  eo[11] = sum % 2
  return { ...SOLVED, eo }
}

function withSlice(a: number): CubieState {
  const ep = new Array<number>(12).fill(-1)
  let x = 4
  for (let j = 0; j < 12; j += 1) {
    const c = binomial(11 - j, x)
    if (x > 0 && a - c >= 0) {
      ep[j] = 12 - x
      a -= c
      x -= 1
    }
  }
  let other = 0
  for (let j = 0; j < 12; j += 1) if (ep[j] === -1) ep[j] = other++
  return { ...SOLVED, ep }
}

function withCornerPerm(r: number): CubieState {
  return { ...SOLVED, cp: unrankPerm(r, 8) }
}

function withUDEdgePerm(r: number): CubieState {
  return { ...SOLVED, ep: [...unrankPerm(r, 8), 8, 9, 10, 11] }
}

function withSlicePerm(r: number): CubieState {
  return { ...SOLVED, ep: [0, 1, 2, 3, 4, 5, 6, 7, ...unrankPerm(r, 4).map((e) => e + 8)] }
}

/** table[coord * 18 + move] = coordinate after the move (-1 for moves not used with this coordinate). */
function moveTable(
  size: number,
  build: (c: number) => CubieState,
  read: (s: CubieState) => number,
  moves: readonly number[] = MOVES.map((_, i) => i)
): Int32Array {
  const table = new Int32Array(size * 18).fill(-1)
  const moveStates = MOVES.map((m) => moveState(m))
  for (let c = 0; c < size; c += 1) {
    const s = build(c)
    for (const m of moves) table[c * 18 + m] = read(multiply(s, moveStates[m] as CubieState))
  }
  return table
}

/** BFS distance table over the product of two coordinates (Int8, -1 = unreached). */
function pruneTable(
  sizeA: number,
  sizeB: number,
  moveA: Int32Array,
  moveB: Int32Array,
  moves: readonly number[]
): Int8Array {
  const n = sizeA * sizeB
  const dist = new Int8Array(n).fill(-1)
  const queue = new Int32Array(n)
  let head = 0
  let tail = 0
  dist[0] = 0
  queue[tail++] = 0
  while (head < tail) {
    const idx = queue[head++] as number
    const a = Math.floor(idx / sizeB)
    const b = idx % sizeB
    const d = (dist[idx] as number) + 1
    for (const m of moves) {
      const next = (moveA[a * 18 + m] as number) * sizeB + (moveB[b * 18 + m] as number)
      if (dist[next] === -1) {
        dist[next] = d
        queue[tail++] = next
      }
    }
  }
  return dist
}

export interface Tables {
  twistMove: Int32Array
  flipMove: Int32Array
  sliceMove: Int32Array
  cpermMove: Int32Array
  udpermMove: Int32Array
  spermMove: Int32Array
  twistSlicePrune: Int8Array
  flipSlicePrune: Int8Array
  cpermSpermPrune: Int8Array
  udpermSpermPrune: Int8Array
}

export function buildTables(): Tables {
  const all = MOVES.map((_, i) => i)
  const twistMove = moveTable(N_TWIST, withTwist, getTwist)
  const flipMove = moveTable(N_FLIP, withFlip, getFlip)
  const sliceMove = moveTable(N_SLICE, withSlice, getSlice)
  const cpermMove = moveTable(N_CPERM, withCornerPerm, getCornerPerm, PHASE2_MOVES)
  const udpermMove = moveTable(N_UDPERM, withUDEdgePerm, getUDEdgePerm, PHASE2_MOVES)
  const spermMove = moveTable(N_SPERM, withSlicePerm, getSlicePerm, PHASE2_MOVES)
  return {
    twistMove,
    flipMove,
    sliceMove,
    cpermMove,
    udpermMove,
    spermMove,
    twistSlicePrune: pruneTable(N_TWIST, N_SLICE, twistMove, sliceMove, all),
    flipSlicePrune: pruneTable(N_FLIP, N_SLICE, flipMove, sliceMove, all),
    cpermSpermPrune: pruneTable(N_CPERM, N_SPERM, cpermMove, spermMove, PHASE2_MOVES),
    udpermSpermPrune: pruneTable(N_UDPERM, N_SPERM, udpermMove, spermMove, PHASE2_MOVES)
  }
}

export const coordBuilders = { withTwist, withFlip, withSlice, withCornerPerm, withUDEdgePerm, withSlicePerm }
