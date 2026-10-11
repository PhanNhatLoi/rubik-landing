import { permutationParity } from '../core/cubie'
import { CORNER_COLORS, CORNER_FACELETS, EDGE_COLORS, EDGE_FACELETS, toFacelets } from '../core/facelets'
import { FACES, type CubieState, type Face, type Facelets } from '../core/types'
import { deltaE2000, type Lab } from '../vision/color'
import { hungarian } from './hungarian'

/** Nine sticker colors per face, row-major as seen by the camera during the guided scan. */
export type ScanInput = Record<Face, readonly Lab[]>

export interface ReconstructOptions {
  /** Lightness weight divisor for ΔE2000; faces are lit differently while scanning. */
  kL: number
  /** A different valid state within this cost of the best one makes the scan ambiguous. */
  ambiguityMargin: number
  /** A sticker whose two nearest center colors are closer than this is flagged. */
  lowConfidenceMargin: number
  /** Tie-breaker preferring the orientation the user was asked to hold. */
  rotationPenalty: number
}

const DEFAULTS: ReconstructOptions = { kL: 2, ambiguityMargin: 12, lowConfidenceMargin: 8, rotationPenalty: 0.5 }

export interface StickerSource {
  face: Face
  cell: number
}

export interface Reconstruction {
  facelets: Facelets
  state: CubieState
  cost: number
  /** Clockwise quarter turns applied to each scanned face image. */
  rotations: Record<Face, number>
  /** For each facelet, which scanned sticker it came from. */
  source: StickerSource[]
  /** Facelets whose final label differs from their nearest center color (corrected by cube constraints). */
  changed: number[]
  /** Facelets whose color sits between two center colors. */
  lowConfidence: number[]
  /** A different valid state almost as likely as the best; the user should check `differing`. */
  alternative: { facelets: Facelets; cost: number; differing: number[] } | null
}

export type ReconstructResult =
  | { ok: true; result: Reconstruction }
  | { ok: false; reason: 'duplicateCenters'; faces: [Face, Face] }

// ROTATION[t][k]: scanned cell feeding facelet cell k after t clockwise quarter turns.
const ROTATION: number[][] = [0, 1, 2, 3].map((t) =>
  Array.from({ length: 9 }, (_, k) => {
    let idx = k
    for (let i = 0; i < t; i += 1) {
      const r = Math.floor(idx / 3)
      const c = idx % 3
      idx = (2 - c) * 3 + r
    }
    return idx
  })
)

const FACE_INDEX: Record<Face, number> = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 }
const CORNER_LABELS = CORNER_COLORS.map((cc) => cc.map((f) => FACE_INDEX[f]))
const EDGE_LABELS = EDGE_COLORS.map((ec) => ec.map((f) => FACE_INDEX[f]))

interface Solved {
  cp: number[]
  co: number[]
  ep: number[]
  eo: number[]
  cost: number
}

/** Best cube state for a fixed facelet → sticker cost table (54 × 6). */
function solveCubies(cost: readonly (readonly number[])[]): Solved {
  const at = (facelet: number, label: number) => (cost[facelet] as readonly number[])[label] as number

  // cornerCost[i][j][o]: corner cubie j at position i with twist o.
  const cornerCost = CORNER_FACELETS.map((slots) =>
    CORNER_LABELS.map((labels) =>
      [0, 1, 2].map((o) => labels.reduce((sum, label, n) => sum + at(slots[(n + o) % 3] as number, label), 0))
    )
  )
  const edgeCost = EDGE_FACELETS.map((slots) =>
    EDGE_LABELS.map((labels) => [0, 1].map((o) => labels.reduce((sum, label, n) => sum + at(slots[(n + o) % 2] as number, label), 0)))
  )
  const cBest = (i: number, j: number) => Math.min(...((cornerCost[i] as number[][])[j] as number[]))
  const eBest = (i: number, j: number) => Math.min(...((edgeCost[i] as number[][])[j] as number[]))
  const cOri = (i: number, j: number) => {
    const c = (cornerCost[i] as number[][])[j] as number[]
    return c.indexOf(Math.min(...c))
  }
  const eOri = (i: number, j: number) => {
    const c = (edgeCost[i] as number[][])[j] as number[]
    return c.indexOf(Math.min(...c))
  }
  const cc = (i: number, j: number, o: number) => ((cornerCost[i] as number[][])[j] as number[])[o] as number
  const ec = (i: number, j: number, o: number) => ((edgeCost[i] as number[][])[j] as number[])[o] as number

  const total = (s: Omit<Solved, 'cost'>) =>
    s.cp.reduce((sum, j, i) => sum + cc(i, j, s.co[i] as number), 0) +
    s.ep.reduce((sum, j, i) => sum + ec(i, j, s.eo[i] as number), 0)

  const fixTwist = (cp: number[], co: number[]) => {
    const s = co.reduce((a, b) => a + b, 0) % 3
    if (!s) return
    const d = 3 - s
    let best = -1
    let bestDelta = Infinity
    cp.forEach((j, i) => {
      const delta = cc(i, j, ((co[i] as number) + d) % 3) - cc(i, j, co[i] as number)
      if (delta < bestDelta) {
        bestDelta = delta
        best = i
      }
    })
    co[best] = ((co[best] as number) + d) % 3
  }

  const fixFlip = (ep: number[], eo: number[]) => {
    if (eo.reduce((a, b) => a + b, 0) % 2 === 0) return
    let best = -1
    let bestDelta = Infinity
    ep.forEach((j, i) => {
      const delta = ec(i, j, 1 - (eo[i] as number)) - ec(i, j, eo[i] as number)
      if (delta < bestDelta) {
        bestDelta = delta
        best = i
      }
    })
    eo[best] = 1 - (eo[best] as number)
  }

  const cp = hungarian(CORNER_FACELETS.map((_, i) => CORNER_LABELS.map((_, j) => cBest(i, j))))
  const ep = hungarian(EDGE_FACELETS.map((_, i) => EDGE_LABELS.map((_, j) => eBest(i, j))))
  const co = cp.map((j, i) => cOri(i, j))
  const eo = ep.map((j, i) => eOri(i, j))

  let candidates: Omit<Solved, 'cost'>[] = [{ cp, co, ep, eo }]
  if (permutationParity(cp) !== permutationParity(ep)) {
    // Fix parity with the cheapest single swap of two corners or two edges.
    candidates = []
    for (let a = 0; a < 8; a += 1) {
      for (let b = a + 1; b < 8; b += 1) {
        const ncp = [...cp]
        ;[ncp[a], ncp[b]] = [ncp[b] as number, ncp[a] as number]
        const nco = [...co]
        nco[a] = cOri(a, ncp[a] as number)
        nco[b] = cOri(b, ncp[b] as number)
        candidates.push({ cp: ncp, co: nco, ep, eo })
      }
    }
    for (let a = 0; a < 12; a += 1) {
      for (let b = a + 1; b < 12; b += 1) {
        const nep = [...ep]
        ;[nep[a], nep[b]] = [nep[b] as number, nep[a] as number]
        const neo = [...eo]
        neo[a] = eOri(a, nep[a] as number)
        neo[b] = eOri(b, nep[b] as number)
        candidates.push({ cp, co, ep: nep, eo: neo })
      }
    }
  }

  let best: Solved | null = null
  for (const cand of candidates) {
    const s = { cp: [...cand.cp], co: [...cand.co], ep: [...cand.ep], eo: [...cand.eo] }
    fixTwist(s.cp, s.co)
    fixFlip(s.ep, s.eo)
    const c = total(s)
    if (!best || c < best.cost) best = { ...s, cost: c }
  }
  return best as Solved
}

/**
 * Rebuilds the cube from six scanned faces. Labels come from each face's center color,
 * so no fixed color palette is assumed. Every combination of face rotations is tried and
 * the cheapest legal cube wins; a close runner-up is reported instead of silently chosen.
 */
export function reconstruct(input: ScanInput, options: Partial<ReconstructOptions> = {}): ReconstructResult {
  const opts = { ...DEFAULTS, ...options }
  const refs = FACES.map((f) => (input[f] as readonly Lab[])[4] as Lab)

  for (let a = 0; a < 6; a += 1) {
    for (let b = a + 1; b < 6; b += 1) {
      if (deltaE2000(refs[a] as Lab, refs[b] as Lab, opts.kL) < 4) {
        return { ok: false, reason: 'duplicateCenters', faces: [FACES[a] as Face, FACES[b] as Face] }
      }
    }
  }

  // stickerCost[face][cell][label]
  const stickerCost = FACES.map((f) =>
    (input[f] as readonly Lab[]).map((lab, cell) =>
      cell === 4 ? FACES.map((_, l) => (l === FACE_INDEX[f] ? 0 : 1e6)) : refs.map((ref) => deltaE2000(lab, ref, opts.kL))
    )
  )

  type Ranked = { facelets: Facelets; score: number; cost: number; solved: Solved; rot: number[] }
  const byFacelets = new Map<Facelets, Ranked>()
  const rot = [0, 0, 0, 0, 0, 0]
  const table: number[][] = new Array(54)

  for (let combo = 0; combo < 4096; combo += 1) {
    for (let fi = 0; fi < 6; fi += 1) rot[fi] = (combo >> (fi * 2)) & 3
    for (let fi = 0; fi < 6; fi += 1) {
      const map = ROTATION[rot[fi] as number] as number[]
      for (let k = 0; k < 9; k += 1) table[fi * 9 + k] = (stickerCost[fi] as number[][])[map[k] as number] as number[]
    }
    const solved = solveCubies(table)
    const facelets = toFacelets(solved)
    const score = solved.cost + opts.rotationPenalty * rot.filter((r) => r !== 0).length
    const prev = byFacelets.get(facelets)
    if (!prev || score < prev.score) byFacelets.set(facelets, { facelets, score, cost: solved.cost, solved, rot: [...rot] })
  }

  const ranked = [...byFacelets.values()].sort((a, b) => a.score - b.score)
  const best = ranked[0] as Ranked
  const runnerUp = ranked[1]

  const source: StickerSource[] = []
  FACES.forEach((face, fi) => {
    const map = ROTATION[best.rot[fi] as number] as number[]
    for (let k = 0; k < 9; k += 1) source.push({ face, cell: map[k] as number })
  })

  const changed: number[] = []
  const lowConfidence: number[] = []
  source.forEach(({ face, cell }, index) => {
    if (cell === 4) return
    const costs = (stickerCost[FACE_INDEX[face]] as number[][])[cell] as number[]
    const sorted = [...costs].sort((a, b) => a - b)
    const nearest = costs.indexOf(sorted[0] as number)
    if (FACES[nearest] !== best.facelets[index]) changed.push(index)
    if ((sorted[1] as number) - (sorted[0] as number) < opts.lowConfidenceMargin) lowConfidence.push(index)
  })

  const alternative =
    runnerUp && runnerUp.score - best.score < opts.ambiguityMargin
      ? {
          facelets: runnerUp.facelets,
          cost: runnerUp.cost,
          differing: [...best.facelets].flatMap((c, i) => (c !== runnerUp.facelets[i] ? [i] : []))
        }
      : null

  const { cp, co, ep, eo } = best.solved
  return {
    ok: true,
    result: {
      facelets: best.facelets,
      state: { cp, co, ep, eo },
      cost: best.cost,
      rotations: Object.fromEntries(FACES.map((f, i) => [f, best.rot[i] as number])) as Record<Face, number>,
      source,
      changed,
      lowConfidence,
      alternative
    }
  }
}
