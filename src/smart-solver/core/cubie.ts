import { FACES, type CubieState, type Face, type Move } from './types'

export const SOLVED: CubieState = {
  cp: [0, 1, 2, 3, 4, 5, 6, 7],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
}

// Clockwise quarter turns, from Kociemba's two-phase definitions.
const BASIC: Record<Face, CubieState> = {
  U: {
    cp: [3, 0, 1, 2, 4, 5, 6, 7],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  R: {
    cp: [4, 1, 2, 0, 7, 5, 6, 3],
    co: [2, 0, 0, 1, 1, 0, 0, 2],
    ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  F: {
    cp: [1, 5, 2, 3, 0, 4, 6, 7],
    co: [1, 2, 0, 0, 2, 1, 0, 0],
    ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11],
    eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0]
  },
  D: {
    cp: [0, 1, 2, 3, 5, 6, 7, 4],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  L: {
    cp: [0, 2, 6, 3, 4, 1, 5, 7],
    co: [0, 1, 2, 0, 0, 2, 1, 0],
    ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  B: {
    cp: [0, 1, 3, 7, 4, 5, 2, 6],
    co: [0, 0, 1, 2, 0, 0, 2, 1],
    ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7],
    eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1]
  }
}

function at(arr: readonly number[], i: number): number {
  const v = arr[i]
  if (v === undefined) throw new RangeError(`index ${i} out of range`)
  return v
}

/** Composition a·b: apply a, then b. */
export function multiply(a: CubieState, b: CubieState): CubieState {
  const cp = b.cp.map((p) => at(a.cp, p))
  const co = b.cp.map((p, i) => (at(a.co, p) + at(b.co, i)) % 3)
  const ep = b.ep.map((p) => at(a.ep, p))
  const eo = b.ep.map((p, i) => (at(a.eo, p) + at(b.eo, i)) % 2)
  return { cp, co, ep, eo }
}

export function parseMove(move: Move): { face: Face; turns: 1 | 2 | 3 } {
  const face = move[0] as Face
  const suffix = move.slice(1)
  return { face, turns: suffix === '2' ? 2 : suffix === "'" ? 3 : 1 }
}

export function formatMove(face: Face, turns: number): Move | null {
  const t = ((turns % 4) + 4) % 4
  if (t === 0) return null
  return `${face}${t === 1 ? '' : t === 2 ? '2' : "'"}` as Move
}

const MOVE_TABLE = new Map<Move, CubieState>()
for (const face of FACES) {
  let s = SOLVED
  for (let t = 1; t <= 3; t += 1) {
    s = multiply(s, BASIC[face])
    MOVE_TABLE.set(formatMove(face, t) as Move, s)
  }
}

export function moveState(move: Move): CubieState {
  const s = MOVE_TABLE.get(move)
  if (!s) throw new Error(`unknown move ${move}`)
  return s
}

export function applyMove(state: CubieState, move: Move): CubieState {
  return multiply(state, moveState(move))
}

export function applyMoves(state: CubieState, moves: readonly Move[]): CubieState {
  return moves.reduce(applyMove, state)
}

export function invertMove(move: Move): Move {
  const { face, turns } = parseMove(move)
  return formatMove(face, 4 - turns) as Move
}

export function invertMoves(moves: readonly Move[]): Move[] {
  return [...moves].reverse().map(invertMove)
}

export function parseAlgorithm(alg: string): Move[] {
  const tokens = alg.trim().split(/\s+/).filter(Boolean)
  return tokens.map((t) => {
    if (!/^[URFDLB](2|'|)$/.test(t)) throw new Error(`invalid move "${t}"`)
    return t as Move
  })
}

export function equals(a: CubieState, b: CubieState): boolean {
  const same = (x: readonly number[], y: readonly number[]) => x.every((v, i) => v === y[i])
  return same(a.cp, b.cp) && same(a.co, b.co) && same(a.ep, b.ep) && same(a.eo, b.eo)
}

export function isSolved(state: CubieState): boolean {
  return equals(state, SOLVED)
}

export function permutationParity(perm: readonly number[]): 0 | 1 {
  let swaps = 0
  const seen = new Array<boolean>(perm.length).fill(false)
  for (let i = 0; i < perm.length; i += 1) {
    if (seen[i]) continue
    let len = 0
    for (let j = i; !seen[j]; j = at(perm, j)) {
      seen[j] = true
      len += 1
    }
    swaps += len - 1
  }
  return (swaps % 2) as 0 | 1
}
