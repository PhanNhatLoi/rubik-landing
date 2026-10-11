export interface Point {
  x: number
  y: number
}

/** A sticker-like blob found in the image. angle is in degrees, any range. */
export interface SquareCandidate {
  center: Point
  side: number
  angle: number
}

/** 3x3 row-major homography mapping lattice coordinates (col, row) to image pixels. */
export type Homography = readonly number[]

export interface LatticeFit {
  homography: Homography
  /** Candidate index assigned to each of the 9 cells (row-major), or -1 when unseen. */
  assignment: number[]
  inliers: number
  /** RMS reprojection error of the inliers, in units of lattice pitch. */
  error: number
  pitch: number
}

export interface LatticeOptions {
  minInliers: number
  /** Max distance from the predicted cell center, as a fraction of the pitch. */
  tolerance: number
  maxError: number
}

const DEFAULTS: LatticeOptions = { minInliers: 5, tolerance: 0.3, maxError: 0.15 }

export function project(h: Homography, col: number, row: number): Point {
  const [a, b, c, d, e, f, g, k, m] = h as [number, number, number, number, number, number, number, number, number]
  const w = g * col + k * row + m
  return { x: (a * col + b * row + c) / w, y: (d * col + e * row + f) / w }
}

/** Solves A x = b for a square system with partial pivoting. Returns null if singular. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length
  const m = a.map((row, i) => [...row, b[i] as number])
  for (let col = 0; col < n; col += 1) {
    let pivot = col
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs((m[r] as number[])[col] as number) > Math.abs((m[pivot] as number[])[col] as number)) pivot = r
    }
    const pivotRow = m[pivot] as number[]
    if (Math.abs(pivotRow[col] as number) < 1e-12) return null
    ;[m[col], m[pivot]] = [pivotRow, m[col] as number[]]
    const rowC = m[col] as number[]
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue
      const rowR = m[r] as number[]
      const factor = (rowR[col] as number) / (rowC[col] as number)
      for (let k = col; k <= n; k += 1) rowR[k] = (rowR[k] as number) - factor * (rowC[k] as number)
    }
  }
  return m.map((row, i) => (row[n] as number) / (row[i] as number))
}

/**
 * Least-squares homography from lattice coordinates to image points (h33 = 1).
 * Image points are normalized by `scale` for numerical stability.
 */
export function fitHomography(src: readonly Point[], dst: readonly Point[], scale = 1): Homography | null {
  if (src.length < 4 || src.length !== dst.length) return null
  const ata = Array.from({ length: 8 }, () => new Array<number>(8).fill(0))
  const atb = new Array<number>(8).fill(0)
  const addRow = (row: number[], rhs: number) => {
    for (let i = 0; i < 8; i += 1) {
      atb[i] = (atb[i] as number) + (row[i] as number) * rhs
      const ataRow = ata[i] as number[]
      for (let j = 0; j < 8; j += 1) ataRow[j] = (ataRow[j] as number) + (row[i] as number) * (row[j] as number)
    }
  }
  src.forEach((s, i) => {
    const x = (dst[i] as Point).x / scale
    const y = (dst[i] as Point).y / scale
    addRow([s.x, s.y, 1, 0, 0, 0, -s.x * x, -s.y * x], x)
    addRow([0, 0, 0, s.x, s.y, 1, -s.x * y, -s.y * y], y)
  })
  const h = solve(ata, atb)
  if (!h) return null
  const [a, b, c, d, e, f, g, k] = h as [number, number, number, number, number, number, number, number]
  return [a * scale, b * scale, c * scale, d * scale, e * scale, f * scale, g, k, 1]
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2
}

function dominantAngle(candidates: readonly SquareCandidate[]): number {
  // Squares are 90° symmetric: average on the 4θ circle.
  let sx = 0
  let sy = 0
  candidates.forEach((c) => {
    const t = (c.angle * Math.PI) / 45
    sx += Math.cos(t)
    sy += Math.sin(t)
  })
  return Math.atan2(sy, sx) / 4
}

interface Hypothesis {
  assignment: number[]
  residual: number
}

function bestAxisAlignedHypothesis(points: readonly Point[], pitch: number, tolerance: number): Hypothesis | null {
  let best: Hypothesis | null = null
  points.forEach((anchor) => {
    for (let ai = 0; ai < 9; ai += 1) {
      const aCol = ai % 3
      const aRow = Math.floor(ai / 3)
      const assignment = new Array<number>(9).fill(-1)
      const cellResidual = new Array<number>(9).fill(Infinity)
      points.forEach((p, pi) => {
        const u = (p.x - anchor.x) / pitch
        const v = (p.y - anchor.y) / pitch
        const col = aCol + Math.round(u)
        const row = aRow + Math.round(v)
        if (col < 0 || col > 2 || row < 0 || row > 2) return
        const r = Math.hypot(u - Math.round(u), v - Math.round(v))
        const cell = row * 3 + col
        if (r < tolerance && r < (cellResidual[cell] as number)) {
          assignment[cell] = pi
          cellResidual[cell] = r
        }
      })
      const count = assignment.filter((a) => a >= 0).length
      const residual = cellResidual.filter(Number.isFinite).reduce((a, b) => a + b, 0)
      const bestCount = best ? best.assignment.filter((a) => a >= 0).length : -1
      if (count > bestCount || (count === bestCount && best && residual < best.residual)) {
        best = { assignment, residual }
      }
    }
  })
  return best
}

function spansGrid(assignment: readonly number[]): boolean {
  const cols = new Set<number>()
  const rows = new Set<number>()
  assignment.forEach((a, cell) => {
    if (a < 0) return
    cols.add(cell % 3)
    rows.add(Math.floor(cell / 3))
  })
  return cols.size >= 2 && rows.size >= 2
}

function fitAssignment(points: readonly Point[], assignment: readonly number[], scale: number) {
  const src: Point[] = []
  const dst: Point[] = []
  assignment.forEach((a, cell) => {
    if (a < 0) return
    src.push({ x: cell % 3, y: Math.floor(cell / 3) })
    dst.push(points[a] as Point)
  })
  const h = fitHomography(src, dst, scale)
  if (!h) return null
  const sq = src.reduce((sum, s, i) => {
    const p = project(h, s.x, s.y)
    const q = dst[i] as Point
    return sum + (p.x - q.x) ** 2 + (p.y - q.y) ** 2
  }, 0)
  return { h, rms: Math.sqrt(sq / src.length) }
}

/**
 * Finds the 3x3 sticker lattice among candidates. Assumes a roughly frontal view:
 * moderate rotation and perspective, uniform-ish pitch.
 */
export function fitLattice(
  candidates: readonly SquareCandidate[],
  options: Partial<LatticeOptions> = {}
): LatticeFit | null {
  const opts = { ...DEFAULTS, ...options }
  if (candidates.length < opts.minInliers) return null

  const theta = dominantAngle(candidates)
  const cos = Math.cos(-theta)
  const sin = Math.sin(-theta)
  const centers = candidates.map((c) => c.center)
  const rotated = centers.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }))

  // Pitch = median nearest-neighbour distance (stickers are one pitch apart).
  const nn = rotated.map((p, i) =>
    Math.min(...rotated.map((q, j) => (i === j ? Infinity : Math.hypot(p.x - q.x, p.y - q.y))))
  )
  const pitch = median(nn)
  if (!Number.isFinite(pitch) || pitch <= 0) return null

  const hyp = bestAxisAlignedHypothesis(rotated, pitch, opts.tolerance)
  if (!hyp || !spansGrid(hyp.assignment)) return null
  let assignment = hyp.assignment
  if (assignment.filter((a) => a >= 0).length < opts.minInliers) return null

  const scale = pitch * 3
  let fit = fitAssignment(centers, assignment, scale)
  if (!fit) return null

  // One refinement pass: re-associate every candidate through the fitted homography.
  const refined = new Array<number>(9).fill(-1)
  const refinedDist = new Array<number>(9).fill(Infinity)
  centers.forEach((p, pi) => {
    for (let cell = 0; cell < 9; cell += 1) {
      const q = project((fit as { h: Homography }).h, cell % 3, Math.floor(cell / 3))
      const d = Math.hypot(p.x - q.x, p.y - q.y) / pitch
      if (d < opts.tolerance && d < (refinedDist[cell] as number)) {
        refined[cell] = pi
        refinedDist[cell] = d
      }
    }
  })
  if (refined.filter((a) => a >= 0).length >= assignment.filter((a) => a >= 0).length && spansGrid(refined)) {
    const refit = fitAssignment(centers, refined, scale)
    if (refit) {
      assignment = refined
      fit = refit
    }
  }

  const error = fit.rms / pitch
  const inliers = assignment.filter((a) => a >= 0).length
  if (inliers < opts.minInliers || error > opts.maxError) return null
  return { homography: fit.h, assignment, inliers, error, pitch }
}
