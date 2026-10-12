import { SOLVED, moveState, multiply } from '../core/cubie'
import type { CubieState, Move } from '../core/types'

/**
 * Exact 2x2 solver: breadth-first search over every state with the DBL corner fixed
 * (7! · 3⁶ = 3,674,160 states) using U, R and F turns. On a 2x2, L/D/B turns equal R/U/F
 * turns plus a whole-cube rotation, so these distances are the true half-turn-metric optimum.
 * The table (3.6 MB) is built once per worker.
 */

const MOVES_2X2: Move[] = ['U', "U'", 'U2', 'R', "R'", 'R2', 'F', "F'", 'F2']
const N_PERM = 5040
const N_TWIST = 729
export const N_STATES_2X2 = N_PERM * N_TWIST
const FACT = [1, 1, 2, 6, 24, 120, 720]
// Corner positions other than DBL (index 6).
const POS = [0, 1, 2, 3, 4, 5, 7]

function rankPerm(cp: readonly number[]): number {
  const p = POS.map((i) => cp[i] as number).map((v) => (v === 7 ? 6 : v))
  let r = 0
  for (let i = 0; i < 7; i += 1) {
    let smaller = 0
    for (let j = i + 1; j < 7; j += 1) if ((p[j] as number) < (p[i] as number)) smaller += 1
    r += smaller * (FACT[6 - i] as number)
  }
  return r
}

function unrankPerm(r: number): number[] {
  const pool = [0, 1, 2, 3, 4, 5, 6]
  const p: number[] = []
  for (let i = 0; i < 7; i += 1) {
    const f = FACT[6 - i] as number
    p.push(pool.splice(Math.floor(r / f), 1)[0] as number)
    r %= f
  }
  const cp = [0, 1, 2, 3, 4, 5, 6, 7]
  POS.forEach((pos, i) => (cp[pos] = (p[i] as number) === 6 ? 7 : (p[i] as number)))
  return cp
}

function twistOf(co: readonly number[]): number {
  return [0, 1, 2, 3, 4, 5].reduce((t, i) => t * 3 + (co[POS[i] as number] as number), 0)
}

function fromTwist(t: number): number[] {
  const co = [0, 0, 0, 0, 0, 0, 0, 0]
  let sum = 0
  for (let i = 5; i >= 0; i -= 1) {
    co[POS[i] as number] = t % 3
    sum += t % 3
    t = Math.floor(t / 3)
  }
  co[7] = (3 - (sum % 3)) % 3
  return co
}

interface Tables {
  permMove: Int32Array
  twistMove: Int32Array
  dist: Uint8Array
}

let tables: Tables | null = null

function build(): Tables {
  const moveStates = MOVES_2X2.map(moveState)
  const permMove = new Int32Array(N_PERM * 9)
  const twistMove = new Int32Array(N_TWIST * 9)
  for (let r = 0; r < N_PERM; r += 1) {
    const s: CubieState = { ...SOLVED, cp: unrankPerm(r) }
    moveStates.forEach((m, k) => (permMove[r * 9 + k] = rankPerm(multiply(s, m).cp)))
  }
  for (let t = 0; t < N_TWIST; t += 1) {
    const s: CubieState = { ...SOLVED, co: fromTwist(t) }
    moveStates.forEach((m, k) => (twistMove[t * 9 + k] = twistOf(multiply(s, m).co)))
  }
  const dist = new Uint8Array(N_STATES_2X2).fill(255)
  const queue = new Int32Array(N_STATES_2X2)
  dist[0] = 0
  let head = 0
  let tail = 1
  while (head < tail) {
    const idx = queue[head++] as number
    const p = Math.floor(idx / N_TWIST)
    const t = idx % N_TWIST
    for (let k = 0; k < 9; k += 1) {
      const next = (permMove[p * 9 + k] as number) * N_TWIST + (twistMove[t * 9 + k] as number)
      if (dist[next] === 255) {
        dist[next] = (dist[idx] as number) + 1
        queue[tail++] = next
      }
    }
  }
  return { permMove, twistMove, dist }
}

export function optimal2Tables(): Tables {
  tables ??= build()
  return tables
}

/** Shortest solution of a 2x2 corner state whose DBL corner is home (see state.cornersToCubie). */
export function solveOptimal2(start: CubieState): Move[] {
  const { permMove, twistMove, dist } = optimal2Tables()
  let p = rankPerm(start.cp)
  let t = twistOf(start.co)
  const moves: Move[] = []
  while (dist[p * N_TWIST + t] !== 0) {
    const d = dist[p * N_TWIST + t] as number
    if (d === 255) throw new Error('2x2 state outside the table (DBL corner not home)')
    for (let k = 0; k < 9; k += 1) {
      const np = permMove[p * 9 + k] as number
      const nt = twistMove[t * 9 + k] as number
      if ((dist[np * N_TWIST + nt] as number) === d - 1) {
        moves.push(MOVES_2X2[k] as Move)
        p = np
        t = nt
        break
      }
    }
  }
  return moves
}

/** Number of states at each distance (for checking against the published 2x2 distribution). */
export function distanceHistogram(): number[] {
  const { dist } = optimal2Tables()
  const h: number[] = []
  dist.forEach((d) => (h[d] = (h[d] ?? 0) + 1))
  return h
}
