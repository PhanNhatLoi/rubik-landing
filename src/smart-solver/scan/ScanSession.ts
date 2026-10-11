import type { Face } from '../core/types'
import { deltaE2000, medianLab, rgbToLab, type Lab } from '../vision/color'
import type { FaceDetection, Rgb } from '../vision/detect'

/** Guided order: four sides with U on top, then U and D. */
export const SCAN_ORDER: readonly Face[] = ['F', 'R', 'B', 'L', 'U', 'D']

export interface FaceScan {
  labs: Lab[]
  rgbs: Rgb[]
}

export interface ScanSessionOptions {
  /** Consecutive stable frames required to capture a face. */
  stableFrames: number
  /** Max lattice corner movement between frames, as a fraction of the pitch. */
  maxMotion: number
  minInliers: number
  minSharpness: number
  /**
   * A face whose nine stickers average closer than this (ΔE2000) to an already scanned face,
   * in any rotation, is that face again. Whole-face comparison: webcam red and orange centers
   * can be only ~8–11 apart, so centers alone cannot tell those faces apart.
   */
  sameFaceDeltaE: number
}

const DEFAULTS: ScanSessionOptions = { stableFrames: 6, maxMotion: 0.08, minInliers: 7, minSharpness: 15, sameFaceDeltaE: 6 }

// Cell k of a face image after one clockwise quarter turn comes from ROTATE_CW[k].
const ROTATE_CW = [6, 3, 0, 7, 4, 1, 8, 5, 2]

/** Smallest mean ΔE2000 between two faces over the four in-plane rotations. */
export function faceDistance(a: readonly Lab[], b: readonly Lab[]): number {
  let best = Infinity
  let map = [0, 1, 2, 3, 4, 5, 6, 7, 8]
  for (let r = 0; r < 4; r += 1) {
    const d = map.reduce((sum, src, k) => sum + deltaE2000(a[k] as Lab, b[src] as Lab), 0) / 9
    best = Math.min(best, d)
    map = ROTATE_CW.map((i) => map[i] as number)
  }
  return best
}

export type ScanPhase =
  | 'searching' // no reliable lattice in view
  | 'blurry'
  | 'holding' // stable lattice, collecting frames
  | 'duplicate' // the face in view was already scanned
  | 'done' // all six faces captured

export interface ScanFeedback {
  phase: ScanPhase
  target: Face | null
  /** 0..1 while holding. */
  progress: number
  /** Face that was just captured by this frame, if any. */
  captured: Face | null
  /** For 'duplicate': which scanned face is in view. */
  seenFace: Face | null
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2
}

/**
 * Turns a stream of per-frame face detections into six captured faces.
 * Pure state machine: no DOM, driven by `push` once per vision result.
 */
export class ScanSession {
  readonly faces: Partial<Record<Face, FaceScan>> = {}
  private readonly opts: ScanSessionOptions
  private target: Face | null = 'F'
  private buffer: FaceDetection[] = []

  constructor(options: Partial<ScanSessionOptions> = {}) {
    this.opts = { ...DEFAULTS, ...options }
  }

  get currentTarget(): Face | null {
    return this.target
  }

  get complete(): boolean {
    return SCAN_ORDER.every((f) => this.faces[f])
  }

  /** Rescans `face` next (its previous capture is kept until replaced). */
  setTarget(face: Face) {
    this.target = face
    this.buffer = []
  }

  reset() {
    SCAN_ORDER.forEach((f) => delete this.faces[f])
    this.target = 'F'
    this.buffer = []
  }

  push(face: FaceDetection | null, sharpness: number): ScanFeedback {
    const feedback = (phase: ScanPhase, extra: Partial<ScanFeedback> = {}): ScanFeedback => ({
      phase,
      target: this.target,
      progress: phase === 'holding' ? this.buffer.length / this.opts.stableFrames : 0,
      captured: null,
      seenFace: null,
      ...extra
    })

    if (!this.target) return feedback('done')
    if (!face || face.inliers < this.opts.minInliers) {
      this.buffer = []
      return feedback('searching')
    }
    if (sharpness < this.opts.minSharpness) {
      this.buffer = []
      return feedback('blurry')
    }

    const labs = face.cells.map((c) => rgbToLab(c.rgb))
    const seen = SCAN_ORDER.find((f) => {
      const scan = this.faces[f]
      return f !== this.target && scan && faceDistance(labs, scan.labs) < this.opts.sameFaceDeltaE
    })
    if (seen) {
      this.buffer = []
      return feedback('duplicate', { seenFace: seen })
    }

    const prev = this.buffer[this.buffer.length - 1]
    if (prev) {
      const motion = Math.max(...face.corners.map((c, i) => Math.hypot(c.x - prev.corners[i]!.x, c.y - prev.corners[i]!.y)))
      if (motion / face.pitch > this.opts.maxMotion) this.buffer = []
    }
    this.buffer.push(face)
    if (this.buffer.length < this.opts.stableFrames) return feedback('holding')

    const captured = this.target
    this.faces[captured] = {
      labs: Array.from({ length: 9 }, (_, k) => medianLab(this.buffer.map((f) => rgbToLab(f.cells[k]!.rgb)))),
      rgbs: Array.from({ length: 9 }, (_, k) => [0, 1, 2].map((ch) => median(this.buffer.map((f) => f.cells[k]!.rgb[ch]!))) as Rgb)
    }
    this.buffer = []
    this.target = SCAN_ORDER.find((f) => !this.faces[f]) ?? null
    return feedback(this.target ? 'holding' : 'done', { captured, progress: 0 })
  }
}
