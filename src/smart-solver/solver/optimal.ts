import { moveState } from '../core/cubie'
import { validateState } from '../core/facelets'
import { MOVES, type CubieState, type Move } from '../core/types'

/**
 * Optimal (shortest HTM path) solver on the implicit state graph:
 * nodes are cube states, edges are the 18 face turns.
 *
 * - Goal side: an exact distance table of every state within ENDGAME_DEPTH of solved
 *   (the BFS graph of the workbook, extended from depth 2).
 * - Lower bounds: BFS distances in projected graphs that track only a group of pieces
 *   (pattern databases). Distances there never exceed the real distance.
 * - IDA*: deepening bound; the first path found is proven shortest.
 */

// State layout in a 40-byte array: cp[0..7] co[8..15] ep[16..27] eo[28..39].
const CP = 0
const CO = 8
const EP = 16
const EO = 28
const STATE_BYTES = 40

const MCP: Uint8Array[] = []
const MCO: Uint8Array[] = []
const MEP: Uint8Array[] = []
const MEO: Uint8Array[] = []
/** CDEST[m][j]: position that the corner at position j moves to (inverse of MCP). */
const CDEST: Uint8Array[] = []
const EDEST: Uint8Array[] = []
MOVES.forEach((m, i) => {
  const s = moveState(m)
  MCP[i] = Uint8Array.from(s.cp)
  MCO[i] = Uint8Array.from(s.co)
  MEP[i] = Uint8Array.from(s.ep)
  MEO[i] = Uint8Array.from(s.eo)
  CDEST[i] = new Uint8Array(8)
  EDEST[i] = new Uint8Array(12)
  s.cp.forEach((src, dst) => ((CDEST[i] as Uint8Array)[src] = dst))
  s.ep.forEach((src, dst) => ((EDEST[i] as Uint8Array)[src] = dst))
})

function applyInto(src: Uint8Array, m: number, dst: Uint8Array) {
  const cp = MCP[m] as Uint8Array
  const co = MCO[m] as Uint8Array
  const ep = MEP[m] as Uint8Array
  const eo = MEO[m] as Uint8Array
  for (let i = 0; i < 8; i += 1) {
    const from = cp[i] as number
    dst[CP + i] = src[CP + from] as number
    dst[CO + i] = ((src[CO + from] as number) + (co[i] as number)) % 3
  }
  for (let i = 0; i < 12; i += 1) {
    const from = ep[i] as number
    dst[EP + i] = src[EP + from] as number
    dst[EO + i] = ((src[EO + from] as number) + (eo[i] as number)) & 1
  }
}

function pack(s: CubieState): Uint8Array {
  const a = new Uint8Array(STATE_BYTES)
  s.cp.forEach((v, i) => (a[CP + i] = v))
  s.co.forEach((v, i) => (a[CO + i] = v))
  s.ep.forEach((v, i) => (a[EP + i] = v))
  s.eo.forEach((v, i) => (a[EO + i] = v))
  return a
}

function rank(a: Uint8Array, offset: number, n: number): number {
  let r = 0
  for (let i = 0; i < n; i += 1) {
    let smaller = 0
    const v = a[offset + i] as number
    for (let j = i + 1; j < n; j += 1) if ((a[offset + j] as number) < v) smaller += 1
    r = r * (n - i) + smaller
  }
  return r
}

function cornerKey(a: Uint8Array): number {
  let twist = 0
  for (let i = 0; i < 7; i += 1) twist = twist * 3 + (a[CO + i] as number)
  return rank(a, CP, 8) * 2187 + twist
}

function edgeKey(a: Uint8Array): number {
  let flip = 0
  for (let i = 0; i < 11; i += 1) flip = flip * 2 + (a[EO + i] as number)
  return rank(a, EP, 12) * 2048 + flip
}

/** Open-addressing map (cornerKey, edgeKey) → distance, for the goal-side table. */
class StateTable {
  private readonly mask: number
  private readonly kc: Uint32Array
  private readonly ke: Float64Array
  private readonly dist: Uint8Array
  size = 0

  constructor(capacityLog2: number) {
    const cap = 1 << capacityLog2
    this.mask = cap - 1
    this.kc = new Uint32Array(cap)
    this.ke = new Float64Array(cap)
    this.dist = new Uint8Array(cap)
  }

  private slot(c: number, e: number): number {
    let h = (Math.imul(c, 0x9e3779b1) ^ Math.imul(e % 0x7fffffff | 0, 0x85ebca6b) ^ Math.floor(e / 0x7fffffff)) & this.mask
    while (this.kc[h] !== 0 && (this.kc[h] !== c + 1 || this.ke[h] !== e)) h = (h + 1) & this.mask
    return h
  }

  get(c: number, e: number): number {
    const h = this.slot(c, e)
    return this.kc[h] === 0 ? -1 : (this.dist[h] as number)
  }

  /** Stores d if the state is new or d is smaller. */
  set(c: number, e: number, d: number) {
    const h = this.slot(c, e)
    if (this.kc[h] === 0) {
      this.kc[h] = c + 1
      this.ke[h] = e
      this.dist[h] = d
      this.size += 1
    } else if (d < (this.dist[h] as number)) {
      this.dist[h] = d
    }
  }
}

const face = (m: number) => Math.floor(m / 3)
function allowedAfter(last: number, m: number): boolean {
  if (last < 0) return true
  const f = face(m)
  const lf = face(last)
  return f !== lf && !(f % 3 === lf % 3 && f < lf)
}

/** A projection that tracks only some pieces: positions and orientations of `ids`. */
interface PieceGroup {
  kind: 'corner' | 'edge'
  ids: readonly number[]
}

function groupIndex(g: PieceGroup, a: Uint8Array): number {
  const n = g.kind === 'corner' ? 8 : 12
  const permOff = g.kind === 'corner' ? CP : EP
  const oriOff = g.kind === 'corner' ? CO : EO
  const oris = g.kind === 'corner' ? 3 : 2
  let pos = 0
  let ori = 0
  for (const id of g.ids) {
    let p = 0
    while (a[permOff + p] !== id) p += 1
    pos = pos * n + p
    ori = ori * oris + (a[oriOff + p] as number)
  }
  return pos * oris ** g.ids.length + ori
}

/** BFS over the projected graph (positions/orientations of the group's pieces only). */
function buildGroupPdb(g: PieceGroup): Uint8Array {
  const n = g.kind === 'corner' ? 8 : 12
  const oris = g.kind === 'corner' ? 3 : 2
  const k = g.ids.length
  const oriStates = oris ** k
  const size = n ** k * oriStates
  const dist = new Uint8Array(size).fill(255)
  const queue = new Int32Array(size)
  const dest = g.kind === 'corner' ? CDEST : EDEST
  const delta = g.kind === 'corner' ? MCO : MEO
  // Solved: piece id sits at position id with orientation 0.
  let start = 0
  for (const id of g.ids) start = start * n + id
  start *= oriStates
  dist[start] = 0
  queue[0] = start
  let head = 0
  let tail = 1
  const pos = new Array<number>(k)
  const ori = new Array<number>(k)
  while (head < tail) {
    const idx = queue[head++] as number
    let p = Math.floor(idx / oriStates)
    let o = idx % oriStates
    for (let i = k - 1; i >= 0; i -= 1) {
      pos[i] = p % n
      p = Math.floor(p / n)
      ori[i] = o % oris
      o = Math.floor(o / oris)
    }
    const d = (dist[idx] as number) + 1
    for (let m = 0; m < 18; m += 1) {
      let np = 0
      let no = 0
      for (let i = 0; i < k; i += 1) {
        const to = (dest[m] as Uint8Array)[pos[i] as number] as number
        np = np * n + to
        no = no * oris + (((ori[i] as number) + ((delta[m] as Uint8Array)[to] as number)) % oris)
      }
      const next = np * oriStates + no
      if (dist[next] === 255) {
        dist[next] = d
        queue[tail++] = next
      }
    }
  }
  return dist
}

const GROUPS: readonly PieceGroup[] = [
  { kind: 'corner', ids: [0, 1, 2, 3] },
  { kind: 'corner', ids: [4, 5, 6, 7] },
  { kind: 'corner', ids: [0, 2, 4, 6] },
  { kind: 'edge', ids: [0, 1, 2, 3] },
  { kind: 'edge', ids: [4, 5, 6, 7] },
  { kind: 'edge', ids: [8, 9, 10, 11] },
  { kind: 'edge', ids: [0, 2, 8, 10] },
  { kind: 'edge', ids: [1, 3, 9, 11] }
]

export const ENDGAME_DEPTH = 5

export interface OptimalTables {
  groups: { group: PieceGroup; pdb: Uint8Array }[]
  endgame: StateTable
  endgameDepth: number
}

export function buildOptimalTables(endgameDepth = ENDGAME_DEPTH): OptimalTables {
  const groups = GROUPS.map((group) => ({ group, pdb: buildGroupPdb(group) }))

  // Exact distances near the goal: DFS from solved with canonical move order.
  const endgame = new StateTable(endgameDepth >= 5 ? 21 : 17)
  const stack = Array.from({ length: endgameDepth + 1 }, () => new Uint8Array(STATE_BYTES))
  ;(stack[0] as Uint8Array).set(pack({ cp: [0, 1, 2, 3, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0], ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], eo: new Array(12).fill(0) }))
  const fill = (depth: number, last: number) => {
    const s = stack[depth] as Uint8Array
    endgame.set(cornerKey(s), edgeKey(s), depth)
    if (depth === endgameDepth) return
    for (let m = 0; m < 18; m += 1) {
      if (!allowedAfter(last, m)) continue
      applyInto(s, m, stack[depth + 1] as Uint8Array)
      fill(depth + 1, m)
    }
  }
  fill(0, -1)
  return { groups, endgame, endgameDepth }
}

export interface OptimalOptions {
  timeoutMs: number
  maxDepth: number
}

export interface OptimalResult {
  /** Proven shortest solution, or null if the time limit was hit first. */
  moves: Move[] | null
  /** Largest depth bound fully searched: the true distance is greater than this when moves is null. */
  provenLowerBound: number
  nodes: number
  ms: number
}

export function solveOptimal(start: CubieState, t: OptimalTables, options: Partial<OptimalOptions> = {}): OptimalResult {
  const opts = { timeoutMs: 5000, maxDepth: 20, ...options }
  if (validateState(start).length) throw new Error('invalid cube state')
  const t0 = performance.now()
  const K = t.endgameDepth
  const stack = Array.from({ length: opts.maxDepth + 2 }, () => new Uint8Array(STATE_BYTES))
  ;(stack[0] as Uint8Array).set(pack(start))
  const path: number[] = []
  let nodes = 0
  let aborted = false

  const exact = (s: Uint8Array) => t.endgame.get(cornerKey(s), edgeKey(s))

  const heuristic = (s: Uint8Array): number => {
    let h = 0
    for (const { group, pdb } of t.groups) {
      const v = pdb[groupIndex(group, s)] as number
      if (v > h) h = v
    }
    if (h > K) return h
    const d = exact(s)
    return d >= 0 ? d : K + 1
  }

  /** Walks down the exact table from a state within the endgame radius. */
  const descend = (depth: number): boolean => {
    let s = stack[depth] as Uint8Array
    let d = exact(s)
    while (d > 0) {
      let found = false
      for (let m = 0; m < 18 && !found; m += 1) {
        const next = stack[depth + 1] as Uint8Array
        applyInto(s, m, next)
        if (exact(next) === d - 1) {
          path.push(m)
          ;(stack[depth] as Uint8Array).set(next)
          found = true
        }
      }
      if (!found) return false
      s = stack[depth] as Uint8Array
      d -= 1
    }
    return true
  }

  const dfs = (depth: number, bound: number, last: number): boolean => {
    nodes += 1
    if ((nodes & 4095) === 0 && performance.now() - t0 > opts.timeoutMs) aborted = true
    if (aborted) return false
    const s = stack[depth] as Uint8Array
    const h = heuristic(s)
    if (depth + h > bound) return false
    if (h <= K && exact(s) >= 0) return descend(depth)
    for (let m = 0; m < 18; m += 1) {
      if (!allowedAfter(last, m)) continue
      applyInto(s, m, stack[depth + 1] as Uint8Array)
      path.push(m)
      if (dfs(depth + 1, bound, m)) return true
      path.pop()
      if (aborted) return false
    }
    return false
  }

  const h0 = heuristic(stack[0] as Uint8Array)
  let provenLowerBound = h0 - 1
  for (let bound = h0; bound <= opts.maxDepth; bound += 1) {
    path.length = 0
    if (dfs(0, bound, -1)) {
      return { moves: path.map((m) => MOVES[m] as Move), provenLowerBound: path.length, nodes, ms: performance.now() - t0 }
    }
    if (aborted) break
    provenLowerBound = bound
  }
  return { moves: null, provenLowerBound: provenLowerBound + 1, nodes, ms: performance.now() - t0 }
}
