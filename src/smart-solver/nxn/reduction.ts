import { EDGE_FACELETS } from '../core/facelets'
import { fromFacelets } from '../core/facelets'
import type { CubieState } from '../core/types'
import { FACE_ORDER, getEngine, splitMoves, type Engine, type FaceName } from './engine'
import { simplifyMoves } from './simplify'
import { stickerIndex } from './state'

/**
 * Reduction method for 4x4 and 5x5 (Cresta booklet): build the centers, pair the edges,
 * fix parity, then the cube behaves like a 3x3 under outer turns.
 *
 * Every stage is greedy: repeatedly find a short sequence (iterative deepening over an
 * alphabet of turns and booklet techniques) that makes measurable progress without undoing
 * finished work. Leaves only read the stickers the goal looks at, which keeps search cheap.
 */

export interface NMacro {
  name: string
  moves: string[]
  perm: Int16Array
  /** Face letter of a plain single turn (for pruning), or null for techniques. */
  plain: string | null
}

export interface ReductionStep {
  stage: 'centers' | 'edges' | 'parity'
  title: string
  moves: string[]
  algorithms: string[]
}

export class SolveTimeoutError extends Error {
  constructor(readonly stage: string) {
    super(`hết thời gian ở giai đoạn "${stage}"`)
    this.name = 'SolveTimeoutError'
  }
}

export class StuckError extends Error {
  constructor(readonly stage: string) {
    super(`không tìm được bước tiếp theo ở giai đoạn "${stage}"`)
    this.name = 'StuckError'
  }
}

function composeMoves(e: Engine, moves: readonly string[]): Int16Array {
  let perm = new Int16Array(e.stickers).map((_, i) => i)
  for (const m of moves) {
    const p = e.permOf(m)
    const next = new Int16Array(e.stickers)
    for (let i = 0; i < e.stickers; i += 1) next[i] = perm[p[i] as number] as number
    perm = next
  }
  return perm
}

function nmacro(e: Engine, name: string, moves: string[]): NMacro {
  return { name, moves, perm: composeMoves(e, moves), plain: name ? null : (moves[0]?.replace(/(2|')$/, '') ?? null) }
}

const invert = (m: string) => (m.endsWith('2') ? m : m.endsWith("'") ? m.slice(0, -1) : `${m}'`)

export interface Geometry {
  n: number
  /** Center stickers per face (excluding nothing: the fixed center of odd cubes is included). */
  centers: number[][]
  /** For each of the 12 edges, its two sides' stickers between the corners. */
  edges: [number[], number[]][]
}

export function geometry(n: number): Geometry {
  const centers = FACE_ORDER.map((_, f) => {
    const out: number[] = []
    for (let r = 1; r < n - 1; r += 1) for (let c = 1; c < n - 1; c += 1) out.push(f * n * n + r * n + c)
    return out
  })
  const side = (f3: number): number[] => {
    const face = Math.floor(f3 / 9)
    const r3 = Math.floor((f3 % 9) / 3)
    const c3 = f3 % 3
    const map = (v: number) => (v === 0 ? 0 : n - 1)
    const out: number[] = []
    for (let k = 1; k < n - 1; k += 1) out.push(face * n * n + (r3 === 1 ? k : map(r3)) * n + (c3 === 1 ? k : map(c3)))
    return out
  }
  const edges = EDGE_FACELETS.map(([a, b]) => [side(a), side(b)] as [number[], number[]])
  return { n, centers, edges }
}

const uniform = (s: Uint8Array, idx: readonly number[]) => idx.every((i) => s[i] === s[idx[0] as number])

export function edgesPaired(s: Uint8Array, g: Geometry): number {
  return g.edges.filter(([a, b]) => uniform(s, a) && uniform(s, b)).length
}

/**
 * Edge pieces matching their edge's reference piece (the middle one, or the first wing on
 * even cubes). Finer than whole edges: on a 5x5 one technique pairs one wing at a time.
 */
export function wingsMatched(s: Uint8Array, g: Geometry): number {
  const ref = Math.floor((g.n - 3) / 2)
  let count = 0
  for (const [a, b] of g.edges) {
    const ra = s[a[ref] as number]
    const rb = s[b[ref] as number]
    for (let k = 0; k < a.length; k += 1) if (k !== ref && s[a[k] as number] === ra && s[b[k] as number] === rb) count += 1
  }
  return count
}

export function centersSolved(s: Uint8Array, g: Geometry, target: readonly number[]): boolean {
  return g.centers.every((idx, f) => idx.every((i) => s[i] === target[f]))
}

interface SearchOptions {
  alphabet: readonly NMacro[]
  /** Stickers read by score/keep: leaves only fill these. */
  watch: readonly number[]
  score: (s: Uint8Array) => number
  keep: (s: Uint8Array) => boolean
  maxDepth: number
  deadline: number
  stage: string
}

/** Shortest sequence (by macro count) after which keep() holds and score() went up. */
function improve(e: Engine, start: Uint8Array, opts: SearchOptions): NMacro[] | null {
  const base = opts.score(start)
  const buffers = Array.from({ length: opts.maxDepth + 1 }, () => new Uint8Array(e.stickers))
  const leaf = new Uint8Array(e.stickers)
  const watch = Int32Array.from(opts.watch)
  const path: NMacro[] = []
  let nodes = 0

  const dfs = (s: Uint8Array, left: number, level: number): boolean => {
    const last = path[path.length - 1]
    for (const m of opts.alphabet) {
      if (last?.plain && m.plain === last.plain) continue
      const p = m.perm
      if (left === 1) {
        for (let k = 0; k < watch.length; k += 1) {
          const i = watch[k] as number
          leaf[i] = s[p[i] as number] as number
        }
        if (opts.keep(leaf) && opts.score(leaf) > base) {
          path.push(m)
          return true
        }
        continue
      }
      if ((++nodes & 1023) === 0 && performance.now() > opts.deadline) throw new SolveTimeoutError(opts.stage)
      const next = buffers[level] as Uint8Array
      for (let i = 0; i < e.stickers; i += 1) next[i] = s[p[i] as number] as number
      path.push(m)
      if (dfs(next, left - 1, level + 1)) return true
      path.pop()
    }
    return false
  }

  for (let d = 1; d <= opts.maxDepth; d += 1) {
    path.length = 0
    if (dfs(start, d, 0)) return [...path]
  }
  return null
}

/**
 * Up to `maxSetup` plain setup turns followed by exactly one technique: the way such cases
 * are solved by hand, and far smaller than searching every mix of turns and techniques.
 */
function improveWithSetup(
  e: Engine,
  start: Uint8Array,
  setups: readonly NMacro[],
  finals: readonly NMacro[],
  maxSetup: number,
  opts: Omit<SearchOptions, 'alphabet' | 'maxDepth'>
): NMacro[] | null {
  const base = opts.score(start)
  const buffers = Array.from({ length: maxSetup + 1 }, () => new Uint8Array(e.stickers))
  const leaf = new Uint8Array(e.stickers)
  const watch = Int32Array.from(opts.watch)
  const path: NMacro[] = []
  let nodes = 0
  const tryFinals = (s: Uint8Array): boolean => {
    for (const m of finals) {
      const p = m.perm
      for (let k = 0; k < watch.length; k += 1) {
        const i = watch[k] as number
        leaf[i] = s[p[i] as number] as number
      }
      if (opts.keep(leaf) && opts.score(leaf) > base) {
        path.push(m)
        return true
      }
    }
    return false
  }
  const dfs = (s: Uint8Array, left: number, level: number): boolean => {
    if (left === 0) return tryFinals(s)
    const last = path[path.length - 1]
    for (const m of setups) {
      if (last?.plain && m.plain === last.plain) continue
      if ((++nodes & 255) === 0 && performance.now() > opts.deadline) throw new SolveTimeoutError(opts.stage)
      const next = buffers[level] as Uint8Array
      const p = m.perm
      for (let i = 0; i < e.stickers; i += 1) next[i] = s[p[i] as number] as number
      path.push(m)
      if (dfs(next, left - 1, level + 1)) return true
      path.pop()
    }
    return false
  }
  for (let k = 0; k <= maxSetup; k += 1) {
    path.length = 0
    if (dfs(start, k, 0)) return [...path]
  }
  return null
}

/**
 * One macro from each level in turn (a level may contain the empty macro to skip it);
 * succeeds when the last level makes progress. Used for "setup, flip, setup, pair".
 */
function improvePattern(
  e: Engine,
  start: Uint8Array,
  levels: readonly (readonly NMacro[])[],
  opts: Omit<SearchOptions, 'alphabet' | 'maxDepth'>
): NMacro[] | null {
  const base = opts.score(start)
  const buffers = levels.map(() => new Uint8Array(e.stickers))
  const leaf = new Uint8Array(e.stickers)
  const watch = Int32Array.from(opts.watch)
  const path: NMacro[] = []
  let nodes = 0
  const dfs = (s: Uint8Array, level: number): boolean => {
    const options = levels[level] as readonly NMacro[]
    const lastLevel = level === levels.length - 1
    for (const m of options) {
      const p = m.perm
      if (lastLevel) {
        for (let k = 0; k < watch.length; k += 1) {
          const i = watch[k] as number
          leaf[i] = s[p[i] as number] as number
        }
        if (opts.keep(leaf) && opts.score(leaf) > base) {
          path.push(m)
          return true
        }
        continue
      }
      if ((++nodes & 255) === 0 && performance.now() > opts.deadline) throw new SolveTimeoutError(opts.stage)
      const next = buffers[level] as Uint8Array
      for (let i = 0; i < e.stickers; i += 1) next[i] = s[p[i] as number] as number
      path.push(m)
      if (dfs(next, level + 1)) return true
      path.pop()
    }
    return false
  }
  return dfs(start, 0) ? path.filter((m) => m.moves.length > 0) : null
}

/**
 * Edge pairing in its general form: setup turns, a slice turn, a short sequence of outer turns
 * that swaps which edge sits in the slice, then the slice turned back (centers come back with
 * it). The booklet technique "u' R U R' F R' F' R u" is one instance.
 */
function improveConjugate(
  e: Engine,
  start: Uint8Array,
  setups: readonly NMacro[],
  slices: readonly [NMacro, NMacro][],
  outer: readonly NMacro[],
  setupDepth: number,
  innerDepth: number,
  opts: Omit<SearchOptions, 'alphabet' | 'maxDepth'>
): NMacro[] | null {
  const base = opts.score(start)
  const total = setupDepth + 1 + innerDepth
  const buffers = Array.from({ length: total + 1 }, () => new Uint8Array(e.stickers))
  const leaf = new Uint8Array(e.stickers)
  const watch = Int32Array.from(opts.watch)
  const path: NMacro[] = []
  let nodes = 0
  const step = (s: Uint8Array, m: NMacro, level: number): Uint8Array => {
    const next = buffers[level] as Uint8Array
    const p = m.perm
    for (let i = 0; i < e.stickers; i += 1) next[i] = s[p[i] as number] as number
    return next
  }
  const inner = (s: Uint8Array, undo: NMacro, left: number, level: number): boolean => {
    // Close the conjugate here.
    const p = undo.perm
    for (let k = 0; k < watch.length; k += 1) {
      const i = watch[k] as number
      leaf[i] = s[p[i] as number] as number
    }
    if (path.length && opts.keep(leaf) && opts.score(leaf) > base) {
      path.push(undo)
      return true
    }
    if (left === 0) return false
    const last = path[path.length - 1]
    for (const m of outer) {
      if (last?.plain && m.plain === last.plain) continue
      if ((++nodes & 255) === 0 && performance.now() > opts.deadline) throw new SolveTimeoutError(opts.stage)
      path.push(m)
      if (inner(step(s, m, level), undo, left - 1, level + 1)) return true
      path.pop()
    }
    return false
  }
  const setup = (s: Uint8Array, left: number, level: number): boolean => {
    for (const [sl, undo] of slices) {
      path.push(sl)
      if (inner(step(s, sl, level), undo, innerDepth, level + 1)) return true
      path.pop()
    }
    if (left === 0) return false
    const last = path[path.length - 1]
    for (const m of setups) {
      if (last?.plain && m.plain === last.plain) continue
      path.push(m)
      if (setup(step(s, m, level), left - 1, level + 1)) return true
      path.pop()
    }
    return false
  }
  for (let d = 0; d <= setupDepth; d += 1) {
    path.length = 0
    if (setup(start, d, 0)) return [...path]
  }
  return null
}

function applyMacros(e: Engine, s: Uint8Array, ms: readonly NMacro[]): Uint8Array {
  return e.applyAll(s, ms.flatMap((m) => m.moves))
}

// --- Alphabets ------------------------------------------------------------------------------

const AXIS_FACES: readonly [FaceName, FaceName][] = [
  ['R', 'L'],
  ['U', 'D'],
  ['F', 'B']
]

const alphabetCache = new Map<number, ReturnType<typeof buildAlphabets>>()

function alphabets(e: Engine) {
  const hit = alphabetCache.get(e.n)
  if (hit) return hit
  const built = buildAlphabets(e)
  alphabetCache.set(e.n, built)
  return built
}

function buildAlphabets(e: Engine) {
  const n = e.n
  const outer = FACE_ORDER.flatMap((f) => ['', "'", '2'].map((s) => nmacro(e, '', [`${f}${s}`])))
  // Inner layers that never move the fixed center of a 5x5 (its middle slice is excluded).
  const innerDepths = Array.from({ length: n - 2 }, (_, i) => i + 2).filter((d) => !(n % 2 === 1 && d === (n + 1) / 2))
  const slices = AXIS_FACES.flatMap(([f]) => innerDepths.map((d) => `${d}${f}`))
  const sliceSingles = slices.flatMap((sl) => ['', "'", '2'].map((s) => nmacro(e, '', [`${sl}${s}`])))

  // Commutators [inner layer, perpendicular face]: small 3-cycles of center pieces.
  const allInner = AXIS_FACES.flatMap(([f]) => Array.from({ length: n - 2 }, (_, i) => `${i + 2}${f}`))
  const commutators: NMacro[] = []
  AXIS_FACES.forEach(([f], axis) => {
    const layers = allInner.filter((s) => s.endsWith(f))
    const perpendicular = AXIS_FACES.filter((_, a) => a !== axis).flat()
    for (const sl of layers) {
      for (const sd of ['', "'"]) {
        for (const pf of perpendicular) {
          for (const pd of ['', "'"]) {
            const a = `${sl}${sd}`
            const b = `${pf}${pd}`
            commutators.push(nmacro(e, 'Ghép tâm (commutator)', [a, b, invert(a), invert(b)]))
          }
        }
      }
    }
  })
  // Last pieces of a face: pure 3-cycles of single center pieces, [a, Y b Y'] with a, b inner
  // layers of one axis and Y a quarter turn of a perpendicular face (r U l' U' r' U l U'),
  // each also conjugated by one setup turn. Large, so only built when needed.
  let pureConj: NMacro[] | null = null
  const pureCommutators = (): NMacro[] => {
    if (pureConj) return pureConj
    const pure: string[][] = []
    AXIS_FACES.forEach(([f], axis) => {
      const layers = allInner.filter((x) => x.endsWith(f))
      const perpendicular = AXIS_FACES.filter((_, ax) => ax !== axis).flat()
      for (const la of layers) for (const da of ['', "'"]) for (const lb of layers) for (const db of ['', "'"]) {
        for (const y of perpendicular) for (const dy of ['', "'"]) {
          const a = `${la}${da}`
          const b = `${lb}${db}`
          const yy = `${y}${dy}`
          pure.push([a, yy, b, invert(yy), invert(a), yy, invert(b), invert(yy)])
        }
      }
    })
    const setups = ['', ...[...outer, ...sliceSingles].map((m) => m.moves[0] as string)]
    pureConj = setups.flatMap((st) => pure.map((c) => nmacro(e, 'Ghép tâm (commutator)', st ? [st, ...c, invert(st)] : c)))
    return pureConj
  }

  // Booklet edge technique: slice · R U R' F R' F' R · slice back, round the four sides.
  const flipper = splitMoves("R U R' F R' F' R")
  // Mirror image of the same technique (left hand).
  const mirrored = splitMoves("L' U' L F' L F L'")
  // Same technique on the next side (rotation about U): F→R→B→L→F, lowercase wide turns too.
  const relabel = (moves: string[], k: number) => {
    const next: Record<string, string> = { F: 'R', R: 'B', B: 'L', L: 'F', f: 'r', r: 'b', b: 'l', l: 'f' }
    return moves.map((m) => {
      let out = m
      for (let i = 0; i < k; i += 1) out = out.replace(/[FRBLfrbl]/, (c) => next[c] as string)
      return out
    })
  }
  // Standard last-two-edges middle part (Dw R F' U R' F Dw') and its mirror.
  const l2e = splitMoves("R F' U R' F")
  const l2eMirror = splitMoves("L' F U' L F'")
  const edgeSlices = ['Uw', 'Dw', '2U', '2D', ...(n === 5 ? ['3U'] : [])]
  const pairing: NMacro[] = []
  const lastTwo: NMacro[] = []
  for (const sl of edgeSlices) {
    for (const sd of ['', "'"]) {
      for (let k = 0; k < 4; k += 1) {
        const a = `${sl}${sd}`
        pairing.push(nmacro(e, 'Ghép cạnh (u · R U R\' F R\' F\' R · u\')', [a, ...relabel(flipper, k), invert(a)]))
        pairing.push(nmacro(e, 'Ghép cạnh (đối xứng)', [a, ...relabel(mirrored, k), invert(a)]))
        lastTwo.push(nmacro(e, 'Hai cạnh cuối (Dw R F\' U R\' F Dw\')', [a, ...relabel(l2e, k), invert(a)]))
        lastTwo.push(nmacro(e, 'Hai cạnh cuối (đối xứng)', [a, ...relabel(l2eMirror, k), invert(a)]))
      }
    }
  }

  const oll = splitMoves("r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2")
  // Booklet "MR" is the second layer from R: written 2R so it can be turned round like any layer.
  const pll = splitMoves('MR2 U2 MR2 u2 MR2 u2').map((m) => m.replace(/^MR/, '2R'))
  const parity: NMacro[] = []
  for (let k = 0; k < 4; k += 1) {
    parity.push(nmacro(e, 'Parity OLL (r2 B2 U2 l U2 r\' U2 r U2 F2 r F2 l\' B2 r2)', relabel(oll, k)))
    // Inner-slice reading of the same algorithm (lowercase as single inner layers).
    parity.push(nmacro(e, 'Parity OLL (tầng trong)', relabel(oll.map((m) => m.replace(/^([rl])/, (c) => `2${c.toUpperCase()}`)), k)))
    parity.push(nmacro(e, 'Parity PLL (MR2 U2 MR2 u2 MR2 u2)', relabel(pll, k)))
  }

  // Once U and D centers are done: commutators of a horizontal layer with a side face keep
  // them intact. Each comes conjugated by a setup turn that also keeps them (S · C · S').
  const horizontal = Array.from({ length: n - 2 }, (_, i) => `${i + 2}U`)
  const sides: FaceName[] = ['F', 'R', 'B', 'L']
  const sideComms: string[][] = []
  for (const sl of horizontal) {
    for (const sd of ['', "'"]) {
      for (const f of sides) {
        for (const fd of ['', "'"]) {
          const x = `${sl}${sd}`
          const y = `${f}${fd}`
          sideComms.push([x, y, invert(x), invert(y)])
        }
      }
    }
  }
  const setups = [
    ...FACE_ORDER.flatMap((f) => ['', "'", '2'].map((d) => `${f}${d}`)),
    ...horizontal.filter((h) => !(n % 2 === 1 && h === `${(n + 1) / 2}U`)).flatMap((h) => ['', "'", '2'].map((d) => `${h}${d}`))
  ]
  const sideCommMacros = sideComms.map((c) => nmacro(e, 'Ghép tâm (commutator)', c))
  const sideCenters: NMacro[] = [
    ...sideCommMacros,
    ...setups.flatMap((st) => sideComms.map((c) => nmacro(e, 'Ghép tâm (commutator)', [st, ...c, invert(st)])))
  ]
  const sideSingles = [...outer, ...setups.slice(18).map((m) => nmacro(e, '', [m]))]

  // Edge flippers on their own (outer turns only, never touch centers).
  const flips: NMacro[] = []
  for (let k = 0; k < 4; k += 1) {
    flips.push(nmacro(e, 'Lật cạnh (R U R\' F R\' F\' R)', relabel(flipper, k)))
    flips.push(nmacro(e, 'Lật cạnh (đối xứng)', relabel(mirrored, k)))
  }
  const none = nmacro(e, '', [])
  // Slice/undo pairs for the general pairing search, named as the booklet technique.
  const slicePairs: [NMacro, NMacro][] = edgeSlices.flatMap((sl) =>
    ['', "'"].map((d) => {
      const a = `${sl}${d}`
      return [nmacro(e, 'Ghép cạnh (tầng · xoay mặt · tầng)', [a]), nmacro(e, 'Ghép cạnh (tầng · xoay mặt · tầng)', [invert(a)])] as [NMacro, NMacro]
    })
  )

  return { outer, sliceSingles, commutators, pureCommutators, pairing, lastTwo, parity, sideCenters, sideCommMacros, sideSingles, flips, none, slicePairs }
}

// --- Stages ---------------------------------------------------------------------------------

const CENTER_ORDER: readonly number[] = [3, 0, 2, 1, 5, 4] // D, U, F, R, B, L

const FACE_VI: Record<FaceName, string> = { U: 'trên', R: 'phải', F: 'trước', D: 'dưới', L: 'trái', B: 'sau' }

export interface ReductionResult {
  steps: ReductionStep[]
  state: Uint8Array
  /** Virtual 3x3 of the reduced cube, labelled by the center colors. */
  virtual: CubieState
}

/** Reads a reduced n×n cube as a 3x3 (corners, one wing per edge, centers). */
export function virtualFacelets(s: Uint8Array, n: number): string {
  const centerColor = FACE_ORDER.map((_, f) => s[stickerIndex(n, f * 9 + 4)] as number)
  return Array.from({ length: 54 }, (_, f3) => FACE_ORDER[centerColor.indexOf(s[stickerIndex(n, f3)] as number)] ?? '?').join('')
}

export function reduce(start: Uint8Array, n: number, target: readonly number[], deadline: number): ReductionResult {
  const e = getEngine(n)
  const g = geometry(n)
  const a = alphabets(e)
  const steps: ReductionStep[] = []
  let s = start
  const centerWatch = g.centers.flat()

  const record = (stage: ReductionStep['stage'], title: string, found: NMacro[]) => {
    const moves = found.flatMap((m) => m.moves)
    if (!moves.length) return
    const last = steps[steps.length - 1]
    const algorithms = [...new Set(found.filter((m) => m.name).map((m) => m.name))]
    // Consecutive searches for the same goal read as one step.
    if (last && last.title === title) {
      last.moves.push(...moves)
      algorithms.forEach((x) => last.algorithms.includes(x) || last.algorithms.push(x))
    } else steps.push({ stage, title, moves, algorithms })
    s = applyMacros(e, s, found)
  }

  // 1. Centers, face by face.
  const done: number[] = []
  for (const f of CENTER_ORDER) {
    const idx = g.centers[f] as number[]
    const color = target[f] as number
    const keep = (x: Uint8Array) => done.every((d) => (g.centers[d] as number[]).every((i) => x[i] === target[d]))
    const score = (x: Uint8Array) => idx.reduce((c, i) => c + (x[i] === color ? 1 : 0), 0)
    const title = `Ghép tâm mặt ${FACE_VI[FACE_ORDER[f] as FaceName]}`
    const sidesPhase = done.includes(0) && done.includes(3)
    while (score(s) < idx.length) {
      const sideOpts = { watch: centerWatch, score, keep, deadline, stage: 'centers' }
      const found = sidesPhase
        ? (improve(e, s, { ...sideOpts, alphabet: [...a.sideSingles, ...a.sideCenters], maxDepth: 2 }) ??
          // Rare last pieces: deeper, with plain commutators only (setups are searched explicitly).
          improve(e, s, { ...sideOpts, alphabet: [...a.sideSingles, ...a.sideCommMacros], maxDepth: 3 }) ??
          improve(e, s, { ...sideOpts, alphabet: [...a.sideSingles, ...a.sideCommMacros], maxDepth: 4 }))
        : improve(e, s, { alphabet: [...a.outer, ...a.sliceSingles], watch: centerWatch, score, keep, maxDepth: 2, deadline, stage: 'centers' }) ??
        improve(e, s, {
          alphabet: [...a.outer, ...a.sliceSingles, ...a.commutators],
          watch: centerWatch,
          score,
          keep,
          maxDepth: 3,
          deadline,
          stage: 'centers'
        }) ??
        improve(e, s, { alphabet: a.pureCommutators(), watch: centerWatch, score, keep, maxDepth: 1, deadline, stage: 'centers' })
      if (!found) throw new StuckError(`centers ${FACE_ORDER[f]} ${score(s)}/${idx.length}`)
      record('centers', title, found)
    }
    done.push(f)
  }

  // 2. Edges: pair while keeping every center.
  const edgeWatch = [...centerWatch, ...g.edges.flatMap(([x, y]) => [...x, ...y])]
  const keepCenters = (x: Uint8Array) => centersSolved(x, g, target)
  const pairedScore = (x: Uint8Array) => edgesPaired(x, g)
  const wingScore = (x: Uint8Array) => wingsMatched(x, g)
  const allWings = 12 * (n - 3)
  while (wingScore(s) < allWings) {
    const opts = { watch: edgeWatch, score: wingScore, keep: keepCenters, deadline, stage: 'edges' }
    const techniques = [...a.pairing, ...a.lastTwo, ...a.parity]
    // Cheapest first: plain pairing, then setups before one technique, then the general
    // slice/exchange/slice form, then a flip before the technique.
    const found =
      improve(e, s, { ...opts, alphabet: [...a.outer, ...a.pairing], maxDepth: 2 }) ??
      improveWithSetup(e, s, a.outer, techniques, 3, opts) ??
      improveConjugate(e, s, a.outer, a.slicePairs, a.outer, 1, 3, opts) ??
      improvePattern(e, s, [[a.none, ...a.outer], a.flips, [a.none, ...a.outer], techniques], opts) ??
      // Odd wing permutation (two edges swapping one piece): parity first, then the technique.
      improvePattern(e, s, [[a.none, ...a.outer], a.parity, [a.none, ...a.outer], [a.none, ...a.outer], [...a.pairing, ...a.lastTwo]], opts) ??
      improveWithSetup(e, s, a.outer, techniques, 4, opts)
    if (!found) throw new StuckError(`edges ${wingScore(s)}/${allWings}`)
    record('edges', 'Ghép cặp các mảnh cạnh', found)
  }

  // 3. Parity: the virtual 3x3 must be a legal 3x3 (4x4 OLL/PLL parity).
  const legal = (x: Uint8Array) => fromFacelets(virtualFacelets(x, n)).ok
  if (!legal(s)) {
    const all = (x: Uint8Array) => keepCenters(x) && pairedScore(x) === 12 && legal(x)
    // Legality needs every sticker, so this search works on full states (small alphabet).
    const alphabet = [...a.outer, ...a.parity]
    let found: NMacro[] | null = null
    for (let depth = 1; depth <= 3 && !found; depth += 1) {
      const path: NMacro[] = []
      const dfs = (x: Uint8Array, left: number): boolean => {
        if (performance.now() > deadline) throw new SolveTimeoutError('parity')
        if (left === 0) return all(x)
        for (const m of alphabet) {
          if (left === 1 && !m.name) continue // must end with a parity algorithm
          path.push(m)
          if (dfs(e.applyAll(x, m.moves), left - 1)) return true
          path.pop()
        }
        return false
      }
      if (dfs(s, depth)) found = [...path]
    }
    if (!found) throw new StuckError('parity')
    record('parity', 'Xử lý parity', found)
  }

  const parsed = fromFacelets(virtualFacelets(s, n))
  if (!parsed.ok) throw new StuckError('parity')
  // Searches are chained greedily, so neighbouring turns can cancel; the cube state is unchanged.
  const tidy = steps
    .map((st) => ({ ...st, moves: simplifyMoves(st.moves) }))
    .filter((st) => st.moves.length > 0)
  return { steps: tidy, state: s, virtual: parsed.state }
}
