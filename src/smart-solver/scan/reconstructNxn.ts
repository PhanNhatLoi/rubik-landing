import { FACES, type Face } from '../core/types'
import { deltaE2000, type Lab } from '../vision/color'
import { hungarian } from './hungarian'

export interface NxnReconstruction {
  /** Face label per sticker (index into URFDLB), engine order: faces URFDLB, each row-major in its standard layout. */
  stickers: Uint8Array
  /** Stickers whose two nearest colors are within the margin. */
  lowConfidence: number[]
}

export interface NxnReconstructOptions {
  /** Lightness weight divisor for ΔE2000; faces are lit differently while scanning. */
  kL: number
  lowConfidenceMargin: number
  maxRounds: number
}

const DEFAULTS: NxnReconstructOptions = { kL: 2, lowConfidenceMargin: 8, maxRounds: 8 }

const meanLab = (labs: readonly Lab[]): Lab => {
  const s = labs.reduce<Lab>((a, l) => [a[0] + l[0], a[1] + l[1], a[2] + l[2]], [0, 0, 0])
  return [s[0] / labs.length, s[1] / labs.length, s[2] / labs.length]
}

/**
 * Names every sticker of an n×n scan with exactly n² stickers per color: a balanced
 * assignment to six reference colors, refined from what was assigned (k-means with equal
 * cluster sizes). Odd cubes start from their fixed centers (each keeps its own cluster); even
 * cubes have none and start from the color scheme (`refs`), and their clusters are named by the
 * nearest scheme color.
 * Piece-level checks (impossible corners, twists) are left to the solver's validation.
 */
export function reconstructNxn(
  n: number,
  faces: Record<Face, readonly Lab[]>,
  refs: Record<Face, Lab>,
  options: Partial<NxnReconstructOptions> = {}
): NxnReconstruction {
  const opts = { ...DEFAULTS, ...options }
  const per = n * n
  const labs = FACES.flatMap((f) => faces[f])
  const centerIndex = n % 2 ? (per - 1) / 2 : -1
  const fixed = (i: number) => (centerIndex >= 0 && i % per === centerIndex ? Math.floor(i / per) : -1)

  let centroids: Lab[] = FACES.map((f, fi) => (centerIndex >= 0 ? (labs[fi * per + centerIndex] as Lab) : refs[f]))
  let labels = new Uint8Array(labs.length)
  const costOf = (i: number, label: number) => {
    const own = fixed(i)
    if (own >= 0 && own !== label) return 1e6
    return deltaE2000(labs[i] as Lab, centroids[label] as Lab, opts.kL)
  }

  for (let round = 0; round < opts.maxRounds; round += 1) {
    const perLabel = FACES.map((_, label) => labs.map((_, i) => costOf(i, label)))
    // Column j is one of the n² slots of label floor(j / n²).
    const matrix = labs.map((_, i) => Array.from({ length: labs.length }, (_, j) => (perLabel[Math.floor(j / per)] as number[])[i] as number))
    const next = Uint8Array.from(hungarian(matrix), (j) => Math.floor(j / per))
    const stable = next.every((v, i) => v === labels[i])
    labels = next
    centroids = FACES.map((_, label) => meanLab(labs.filter((_, i) => labels[i] === label)))
    if (stable && round > 0) break
  }

  // Odd cubes, as the 3x3: each color is named by the face whose fixed center has it (the scan
  // checks that every face is shown with its center). Even cubes: by the nearest scheme color.
  const names = centerIndex >= 0 ? FACES.map((_, i) => i) : hungarian(centroids.map((c) => FACES.map((f) => deltaE2000(c, refs[f], opts.kL))))
  const stickers = Uint8Array.from(labels, (l) => names[l] as number)

  const lowConfidence: number[] = []
  labs.forEach((_, i) => {
    if (fixed(i) >= 0) return
    const costs = FACES.map((_, label) => costOf(i, label)).sort((a, b) => a - b)
    if ((costs[1] as number) - (costs[0] as number) < opts.lowConfidenceMargin) lowConfidence.push(i)
  })
  return { stickers, lowConfidence }
}
