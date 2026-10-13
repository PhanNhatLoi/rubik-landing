import { SOLVED, applyMoves, moveState, multiply, parseAlgorithm } from '../core/cubie'
import { CORNER_COLORS, CORNER_FACELETS } from '../core/facelets'
import { MOVES, type CubieState, type Face, type Move } from '../core/types'
import { simplifyMoves } from './simplify'

/**
 * Layer-by-layer ("beginner") method on the 3x3 cubie model, following the Cresta booklet.
 * Used for 3x3 cubes and for the virtual 3x3 of reduced 4x4/5x5 cubes, plus the 2x2 method.
 *
 * Every step is a goal on the cube state, reached by a short search over an alphabet of
 * U-layer setup turns and booklet algorithms. An algorithm is only ever used if the result
 * really reaches the goal and keeps everything solved earlier, so a misread or unsuitable
 * algorithm can never corrupt the solution.
 */

export interface Macro {
  /** Name shown to the learner (e.g. "Sune"), empty for plain turns. */
  name: string
  moves: Move[]
  effect: CubieState
}

export interface BeginnerStep {
  /** Stage id, e.g. "cross". */
  stage: string
  /** Vietnamese stage title. */
  title: string
  moves: Move[]
  /** Booklet algorithms used in this step, in order. */
  algorithms: string[]
}

export function macro(name: string, alg: string | Move[]): Macro {
  const moves = typeof alg === 'string' ? parseAlgorithm(alg) : alg
  return { name, moves, effect: applyMoves(SOLVED, moves) }
}

const TURNS: Macro[] = MOVES.map((m) => ({ name: '', moves: [m], effect: moveState(m) }))
const U_TURNS: Macro[] = TURNS.filter((t) => t.moves[0]?.startsWith('U'))
const D_TURNS: Macro[] = TURNS.filter((t) => t.moves[0]?.startsWith('D'))

/** Same algorithm for the next slot round the cube: faces F→R→B→L→F (a rotation about U). */
export function relabel(moves: readonly Move[], times: number): Move[] {
  const next: Record<string, string> = { F: 'R', R: 'B', B: 'L', L: 'F', U: 'U', D: 'D' }
  return moves.map((m) => {
    let face = m[0] as string
    for (let i = 0; i < times; i += 1) face = next[face] as string
    return `${face}${m.slice(1)}` as Move
  })
}

/** An algorithm and its three rotated copies, all sharing the booklet name. */
function aroundU(name: string, alg: string): Macro[] {
  const base = parseAlgorithm(alg)
  return [0, 1, 2, 3].map((k) => macro(name, relabel(base, k)))
}

const face = (m: Move) => m[0]

/**
 * Iterative deepening over macros until `goal` holds. Plain U/D turns never follow a turn
 * of the same face; returns null when nothing works within maxDepth.
 */
export function searchMacros(
  start: CubieState,
  alphabet: readonly Macro[],
  goal: (s: CubieState) => boolean,
  maxDepth: number
): Macro[] | null {
  if (goal(start)) return []
  const path: Macro[] = []
  const dfs = (s: CubieState, depth: number): boolean => {
    if (depth === 0) return goal(s)
    const last = path[path.length - 1]
    for (const m of alphabet) {
      if (last && !last.name && !m.name && face(last.moves[0] as Move) === face(m.moves[0] as Move)) continue
      path.push(m)
      if (dfs(multiply(s, m.effect), depth - 1)) return true
      path.pop()
    }
    return false
  }
  for (let d = 1; d <= maxDepth; d += 1) {
    path.length = 0
    if (dfs(start, d)) return [...path]
  }
  return null
}

// --- Goals --------------------------------------------------------------------------------

const edgeDone = (s: CubieState, i: number) => s.ep[i] === i && s.eo[i] === 0
const cornerDone = (s: CubieState, i: number) => s.cp[i] === i && s.co[i] === 0
const all = (idx: readonly number[], f: (i: number) => boolean) => idx.every(f)

const CROSS = [5, 4, 7, 6] // DF DR DB DL
const D_CORNERS = [4, 5, 6, 7] // DFR DLF DBL DRB
const MIDDLE = [8, 9, 10, 11] // FR FL BL BR

const crossDone = (s: CubieState) => all(CROSS, (i) => edgeDone(s, i))
const firstLayerDone = (s: CubieState) => crossDone(s) && all(D_CORNERS, (i) => cornerDone(s, i))
const f2lDone = (s: CubieState) => firstLayerDone(s) && all(MIDDLE, (i) => edgeDone(s, i))
const topCrossDone = (s: CubieState) => f2lDone(s) && all([0, 1, 2, 3], (i) => s.eo[i] === 0)
const topFaceDone = (s: CubieState) => topCrossDone(s) && all([0, 1, 2, 3], (i) => s.co[i] === 0)
const cornersDone = (s: CubieState) => topFaceDone(s) && all([0, 1, 2, 3], (i) => cornerDone(s, i))
const allDone = (s: CubieState) => cornersDone(s) && all([0, 1, 2, 3], (i) => edgeDone(s, i))

// --- Algorithm library (booklet + equivalent standard forms) --------------------------------

/** Corner triggers, one per bottom slot: repeated, they bring the corner above the slot down. */
const TRIGGERS: Macro[] = [
  macro('Kỹ thuật góc phải (R U R\' U\')', "R U R' U'"),
  macro('Kỹ thuật góc trái (L\' U\' L U)', "L' U' L U"),
  macro('Kỹ thuật góc trái (L U L\' U\')', "L U L' U'"),
  macro('Kỹ thuật góc phải (R\' U\' R U)', "R' U' R U")
]

const MIDDLE_ALGS: Macro[] = [
  ...aroundU('Đưa cạnh vào bên phải', "U R U' R' U' F' U F"),
  ...aroundU('Đưa cạnh vào bên trái', "U' L' U L U F U' F'"),
  ...aroundU('Tầng giữa – Alg 2', "R' U' R' U' R' U R U R"),
  ...aroundU('Tầng giữa – Alg 3', "R U U R' U R U U R' U F' U' F")
]

const TOP_CROSS: Macro[] = [macro('Chữ thập trên (F R U R\' U\' F\')', "F R U R' U' F'")]

const TOP_FACE: Macro[] = [macro('Mặt trên – Alg 1', "R' U' R U' R' U2 R"), macro('Mặt trên – Alg 2', "R U R' U R U2 R'")]

const TOP_CORNERS: Macro[] = [
  macro('Góc trên – Alg 1', "R2 F2 R' B' R F2 R' B R'"),
  macro('Góc trên – Alg 2', "R B' R F2 R' B R F2 R2"),
  macro('Góc trên (A-perm)', "R' F R' B2 R F' R' B2 R2"),
  macro('Góc trên (A-perm)', "R2 B2 R F R' B2 R F' R")
]

const TOP_EDGES: Macro[] = [
  macro('Cạnh trên – Alg 1', "R U' R U R U R U' R' U' R2"),
  macro('Cạnh trên – Alg 2', "L' U L' U' L' U' L' U L U L2"),
  macro('Cạnh trên (U-perm)', "R2 U R U R' U' R' U' R' U R'")
]

// --- Single-edge distance tables for the cross (24 states: position × flip) -------------------

const edgeDistance: number[][] = []
function edgeTable(edge: number): number[] {
  const cached = edgeDistance[edge]
  if (cached) return cached
  const dist = new Array<number>(24).fill(-1)
  dist[edge * 2] = 0
  let frontier = [edge * 2]
  while (frontier.length) {
    const next: number[] = []
    for (const code of frontier) {
      const p = code >> 1
      const o = code & 1
      for (const t of TURNS) {
        // Under s·m the edge at position p moves to the position i with m.ep[i] = p.
        const i = t.effect.ep.indexOf(p)
        const nc = i * 2 + ((o + (t.effect.eo[i] as number)) & 1)
        if (dist[nc] === -1) {
          dist[nc] = (dist[code] as number) + 1
          next.push(nc)
        }
      }
    }
    frontier = next
  }
  edgeDistance[edge] = dist
  return dist
}

/** IDA* over single turns for a set of edges (the cross), with per-edge distance heuristics. */
function solveEdges(start: CubieState, edges: readonly number[], maxDepth = 12): Macro[] | null {
  const tables = edges.map(edgeTable)
  const h = (s: CubieState) =>
    Math.max(
      0,
      ...edges.map((e, k) => {
        const p = s.ep.indexOf(e)
        return (tables[k] as number[])[p * 2 + (s.eo[p] as number)] as number
      })
    )
  const path: Macro[] = []
  const dfs = (s: CubieState, g: number, bound: number): boolean => {
    const hs = h(s)
    if (hs === 0) return true
    if (g + hs > bound) return false
    const last = path[path.length - 1]
    for (const t of TURNS) {
      if (last && face(last.moves[0] as Move) === face(t.moves[0] as Move)) continue
      path.push(t)
      if (dfs(multiply(s, t.effect), g + 1, bound)) return true
      path.pop()
    }
    return false
  }
  for (let bound = h(start); bound <= maxDepth; bound += 1) {
    path.length = 0
    if (dfs(start, 0, bound)) return [...path]
  }
  return null
}

// --- Stage runner ---------------------------------------------------------------------------

export class BeginnerError extends Error {
  constructor(readonly stage: string) {
    super(`không tìm được bước giải cho giai đoạn "${stage}"`)
    this.name = 'BeginnerError'
  }
}

function run(
  state: CubieState,
  steps: BeginnerStep[],
  stage: string,
  title: string,
  found: Macro[] | null
): CubieState {
  if (!found) throw new BeginnerError(stage)
  // Macros are searched one by one, so neighbours can undo or repeat each other (… U' + U …).
  const moves = simplifyMoves(found.flatMap((m) => m.moves))
  if (moves.length) steps.push({ stage, title, moves, algorithms: found.filter((m) => m.name).map((m) => m.name) })
  return applyMoves(state, moves)
}

const EDGE_NAME: Record<number, string> = { 4: 'DR', 5: 'DF', 6: 'DL', 7: 'DB', 8: 'FR', 9: 'FL', 10: 'BL', 11: 'BR' }
const CORNER_NAME: Record<number, string> = { 4: 'DFR', 5: 'DLF', 6: 'DBL', 7: 'DRB' }

/** Beginner solution of a 3x3 cubie state (centers fixed: U on top, D at the bottom). */
export function solveBeginner3(start: CubieState): BeginnerStep[] {
  const steps: BeginnerStep[] = []
  let s = start

  // 1. Cross on the bottom face, one edge at a time.
  const placed: number[] = []
  for (const e of CROSS) {
    placed.push(e)
    s = run(s, steps, 'cross', `Chữ thập mặt đáy – cạnh ${EDGE_NAME[e]}`, solveEdges(s, placed))
  }

  // 2. Bottom corners with the corner triggers.
  const corners: number[] = []
  for (const c of D_CORNERS) {
    corners.push(c)
    const goal = (x: CubieState) => crossDone(x) && all(corners, (i) => cornerDone(x, i))
    s = run(s, steps, 'corners', `Góc mặt đáy – góc ${CORNER_NAME[c]}`, searchMacros(s, [...U_TURNS, ...TRIGGERS], goal, 8))
  }

  // 3. Middle-layer edges.
  const middle: number[] = []
  for (const e of MIDDLE) {
    middle.push(e)
    const goal = (x: CubieState) => firstLayerDone(x) && all(middle, (i) => edgeDone(x, i))
    s = run(s, steps, 'middle', `Cạnh tầng giữa – cạnh ${EDGE_NAME[e]}`, searchMacros(s, [...U_TURNS, ...MIDDLE_ALGS], goal, 4))
  }

  // 4–7. Last layer.
  s = run(s, steps, 'topCross', 'Chữ thập mặt trên', searchMacros(s, [...U_TURNS, ...TOP_CROSS], topCrossDone, 6))
  s = run(s, steps, 'topFace', 'Hoàn thành mặt trên', searchMacros(s, [...U_TURNS, ...TOP_FACE], topFaceDone, 7))
  s = run(s, steps, 'topCorners', 'Đưa góc trên về đúng vị trí', searchMacros(s, [...U_TURNS, ...TOP_CORNERS], cornersDone, 5))
  run(s, steps, 'topEdges', 'Đưa cạnh trên về đúng vị trí', searchMacros(s, [...U_TURNS, ...TOP_EDGES], allDone, 5))
  return steps
}

// --- 2x2 ------------------------------------------------------------------------------------

const OLL_2X2: Macro[] = [
  macro('OLL 1', "R2 U2 R U2 R2"),
  macro('OLL 2', "F R U R' U' R U R' U' F'"),
  macro('OLL 3', "F R U R' U' F'"),
  macro('OLL 4', "R U R' U' R' F R F'"),
  macro('OLL 5', "F R' F' R U R U' R'"),
  macro('OLL 6', "R U2 R' U' R U' R'"),
  macro('OLL 7', "R U R' U R U2 R'")
]

const PBL_2X2: Macro[] = [
  macro('Hoán vị – Alg 1', 'R2 B2 R2'),
  macro('Hoán vị – Alg 2', "R' U R' B2 R U' R"),
  macro('Hoán vị – Alg 3', "R2 U' R2 U2 F2 U' R2"),
  macro('Hoán vị – Alg 4', "R U2 R' U' R U2 L' U R' U' L"),
  macro('Hoán vị – Alg 5', "R U' R' U' F2 U' R U R' U F2")
]

/** Corner stickers of a corner-only state, as face letters (edges/centers ignored). */
function cornerStickers(s: CubieState): Map<number, Face> {
  const out = new Map<number, Face>()
  CORNER_FACELETS.forEach((slots, i) => {
    const cubie = s.cp[i] as number
    const ori = s.co[i] as number
    for (let k = 0; k < 3; k += 1) out.set(slots[(k + ori) % 3] as number, (CORNER_COLORS[cubie] as readonly Face[])[k] as Face)
  })
  return out
}

/** 2x2 solved in any orientation: every face's four corner stickers share a color. */
export function solved2x2(s: CubieState): boolean {
  const st = cornerStickers(s)
  for (let f = 0; f < 6; f += 1) {
    const colors = [0, 2, 6, 8].map((k) => st.get(f * 9 + k))
    if (colors.some((c) => c !== colors[0])) return false
  }
  return true
}

const bottom2x2 = (s: CubieState, set: readonly number[]) => all(set, (i) => cornerDone(s, i))

/** 2x2 beginner method (booklet): bottom layer, top face (OLL), then permute both layers. */
export function solveBeginner2(start: CubieState): BeginnerStep[] {
  const steps: BeginnerStep[] = []
  let s = start
  const corners: number[] = []
  for (const c of [6, 5, 4, 7]) {
    corners.push(c)
    s = run(s, steps, 'bottom', `Mặt đáy – góc ${CORNER_NAME[c]}`, searchMacros(s, [...U_TURNS, ...TRIGGERS], (x) => bottom2x2(x, corners), 8))
  }
  const topOriented = (x: CubieState) => bottom2x2(x, D_CORNERS) && all([0, 1, 2, 3], (i) => x.co[i] === 0)
  s = run(s, steps, 'oll', 'Giải mặt nắp (OLL)', searchMacros(s, [...U_TURNS, ...OLL_2X2], topOriented, 4))
  run(s, steps, 'pbl', 'Hoán vị các mảnh còn lại', searchMacros(s, [...U_TURNS, ...D_TURNS, ...PBL_2X2], solved2x2, 4))
  return steps
}
