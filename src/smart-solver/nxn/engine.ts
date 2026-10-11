/**
 * Facelet move engine for N×N cubes (N = 2..5).
 *
 * State: one byte per sticker, 6·N² stickers, faces in URFDLB order, each face row-major as
 * seen from outside (same layout as the 3x3 facelet strings of core/facelets.ts).
 * Every turn is a sticker permutation derived from 3D geometry, so it is a physical turn.
 *
 * Notation (outer face X ∈ U R F D L B):
 *   X, X', X2   outer layer
 *   kX          only layer k counted from X (inner slice), e.g. 2R
 *   Xw, kXw     layers 1..2 (or 1..k) together (wide), e.g. Rw, 3Rw
 *   x, y, z     whole-cube rotations (following R, U, F)
 * Lowercase r u f d l b (as in the Cresta booklet) means a wide turn: r = Rw. "MR" = 2R.
 */

export type CubeSize = 2 | 3 | 4 | 5
export type FaceName = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'
export const FACE_ORDER: readonly FaceName[] = ['U', 'R', 'F', 'D', 'L', 'B']

type Axis = 0 | 1 | 2
type Vec = [number, number, number]

const FACE_NORMAL: Record<FaceName, Vec> = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1]
}

/** A parsed turn: layers [from, to] counted from `face` (1 = outer), clockwise quarter turns 1..3. */
export interface Turn {
  face: FaceName
  from: number
  to: number
  turns: 1 | 2 | 3
}

export interface Engine {
  n: number
  stickers: number
  /** Grid position (0..n-1 per axis) and outward normal of every sticker. */
  position: readonly Vec[]
  normal: readonly Vec[]
  /** Sticker permutation of a move: next[i] = state[perm[i]]. Cached. */
  permOf(move: string): Int16Array
  apply(state: Uint8Array, move: string): Uint8Array
  applyAll(state: Uint8Array, moves: readonly string[]): Uint8Array
  solved(): Uint8Array
}

/** Grid position of sticker (row, col) on a face, viewed from outside. */
function stickerGrid(face: FaceName, r: number, c: number, n: number): Vec {
  const m = n - 1
  switch (face) {
    case 'U':
      return [c, m, r]
    case 'R':
      return [m, m - r, m - c]
    case 'F':
      return [c, m - r, m]
    case 'D':
      return [c, 0, m - r]
    case 'L':
      return [0, m - r, c]
    case 'B':
      return [m - c, m - r, 0]
  }
}

/** +90° about +axis (right-hand rule), on centred doubled coordinates. */
function rotate(v: Vec, axis: Axis): Vec {
  const [x, y, z] = v
  if (axis === 0) return [x, -z, y]
  if (axis === 1) return [z, y, -x]
  return [-y, x, z]
}

export function parseTurn(token: string, n: number): Turn | { rotation: Axis; turns: 1 | 2 | 3 } {
  const m = /^(\d*)(MR|[URFDLBurfdlbxyz])(w?)(2|'|)$/.exec(token)
  if (!m) throw new Error(`invalid move "${token}"`)
  const [, depthStr, letter, wide, suffix] = m as unknown as [string, string, string, string, string]
  const turns = (suffix === '2' ? 2 : suffix === "'" ? 3 : 1) as 1 | 2 | 3
  if (letter === 'x' || letter === 'y' || letter === 'z') return { rotation: 'xyz'.indexOf(letter) as Axis, turns }
  if (letter === 'MR') return { face: 'R', from: 2, to: 2, turns }
  const lower = letter === letter.toLowerCase()
  const face = letter.toUpperCase() as FaceName
  const depth = depthStr ? Number(depthStr) : lower ? 2 : 1
  if (depth < 1 || depth > n) throw new Error(`layer ${depth} does not exist on a ${n}x${n} cube`)
  const isWide = wide === 'w' || lower
  return isWide ? { face, from: 1, to: Math.max(depth, 2), turns } : { face, from: depth, to: depth, turns }
}

const engines = new Map<number, Engine>()

export function getEngine(n: number): Engine {
  const cached = engines.get(n)
  if (cached) return cached

  const position: Vec[] = []
  const normal: Vec[] = []
  const index = new Map<string, number>()
  FACE_ORDER.forEach((face) => {
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        const g = stickerGrid(face, r, c, n)
        index.set(`${g.join(',')}|${FACE_NORMAL[face].join(',')}`, position.length)
        position.push(g)
        normal.push(FACE_NORMAL[face])
      }
    }
  })
  const count = position.length

  // Single layer +90° about +axis at grid coordinate `layer`.
  const layerPerm = (axis: Axis, layer: number): Int16Array => {
    const perm = new Int16Array(count)
    for (let i = 0; i < count; i += 1) perm[i] = i
    for (let i = 0; i < count; i += 1) {
      const p = position[i] as Vec
      if (p[axis] !== layer) continue
      const centred: Vec = [2 * p[0] - (n - 1), 2 * p[1] - (n - 1), 2 * p[2] - (n - 1)]
      const q = rotate(centred, axis)
      const g: Vec = [(q[0] + n - 1) / 2, (q[1] + n - 1) / 2, (q[2] + n - 1) / 2]
      const nn = rotate(normal[i] as Vec, axis)
      const j = index.get(`${g.join(',')}|${nn.join(',')}`) as number
      perm[j] = i
    }
    return perm
  }

  const compose = (a: Int16Array, b: Int16Array): Int16Array => {
    // Apply a, then b: next[i] = afterA[b[i]] = state[a[b[i]]].
    const out = new Int16Array(count)
    for (let i = 0; i < count; i += 1) out[i] = a[b[i] as number] as number
    return out
  }

  const identity = new Int16Array(count).map((_, i) => i)
  const cache = new Map<string, Int16Array>()

  const turnPerm = (t: Turn): Int16Array => {
    const nrm = FACE_NORMAL[t.face]
    const axis = nrm.findIndex((v) => v !== 0) as Axis
    const positive = (nrm[axis] as number) > 0
    // Clockwise seen from the face = -90° about its outward normal.
    const quarters = ((positive ? 4 - t.turns : t.turns) % 4) as number
    let perm: Int16Array = identity
    for (let d = t.from; d <= t.to; d += 1) {
      const layer = positive ? n - d : d - 1
      const single = layerPerm(axis, layer)
      for (let k = 0; k < quarters; k += 1) perm = compose(perm, single)
    }
    return perm
  }

  const permOf = (move: string): Int16Array => {
    const hit = cache.get(move)
    if (hit) return hit
    const parsed = parseTurn(move, n)
    let perm: Int16Array
    if ('rotation' in parsed) {
      const face: FaceName = (['R', 'U', 'F'] as const)[parsed.rotation]
      perm = turnPerm({ face, from: 1, to: n, turns: parsed.turns })
    } else {
      perm = turnPerm(parsed)
    }
    cache.set(move, perm)
    return perm
  }

  const apply = (state: Uint8Array, move: string): Uint8Array => {
    const perm = permOf(move)
    const out = new Uint8Array(count)
    for (let i = 0; i < count; i += 1) out[i] = state[perm[i] as number] as number
    return out
  }

  const engine: Engine = {
    n,
    stickers: count,
    position,
    normal,
    permOf,
    apply,
    applyAll: (state, moves) => moves.reduce(apply, state),
    solved: () => {
      const s = new Uint8Array(count)
      for (let f = 0; f < 6; f += 1) s.fill(f, f * n * n, (f + 1) * n * n)
      return s
    }
  }
  engines.set(n, engine)
  return engine
}

export function splitMoves(alg: string): string[] {
  return alg.trim().split(/\s+/).filter(Boolean)
}

/** Inverse of a move token (R → R', R' → R, R2 → R2). */
export function invertToken(move: string): string {
  if (move.endsWith('2')) return move
  return move.endsWith("'") ? move.slice(0, -1) : `${move}'`
}

export function invertSequence(moves: readonly string[]): string[] {
  return [...moves].reverse().map(invertToken)
}

/** Every face a single color (any colors: even cubes have no fixed orientation). */
export function isSolvedState(state: Uint8Array, n: number): boolean {
  const per = n * n
  for (let f = 0; f < 6; f += 1) {
    const c = state[f * per]
    for (let i = 1; i < per; i += 1) if (state[f * per + i] !== c) return false
  }
  return true
}
