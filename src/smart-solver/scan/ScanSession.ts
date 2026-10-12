import type { Face } from '../core/types'
import { deltaE2000, medianLab, rgbToLab, type Lab } from '../vision/color'
import type { FaceDetection, Rgb } from '../vision/detect'
import { SCAN_ORDER, clockwiseMap, toStandard } from './scanGuide'

export { SCAN_ORDER }

/** A captured face, stored in its standard facelet layout (not as the camera saw it). */
export interface FaceScan {
  labs: Lab[]
  rgbs: Rgb[]
}

export interface ScanSessionOptions {
  /** Stickers per side of the cube. */
  n: number
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
  /**
   * Optional check that the center belongs to the face being scanned; returns the face it
   * looks like instead, or null when it fits.
   */
  identify?: (center: Lab, target: Face, scanned: readonly Face[]) => Face | null
}

const DEFAULTS: ScanSessionOptions = { n: 3, stableFrames: 6, maxMotion: 0.08, minInliers: 7, minSharpness: 15, sameFaceDeltaE: 6 }

/** Smallest mean ΔE2000 between two faces over the four in-plane rotations. */
export function faceDistance(a: readonly Lab[], b: readonly Lab[]): number {
  const cw = clockwiseMap(Math.round(Math.sqrt(a.length)))
  let best = Infinity
  let map = a.map((_, k) => k)
  for (let r = 0; r < 4; r += 1) {
    const d = map.reduce((sum, src, k) => sum + deltaE2000(a[k] as Lab, b[src] as Lab), 0) / a.length
    best = Math.min(best, d)
    map = cw.map((i) => map[i] as number)
  }
  return best
}

export type ScanPhase =
  | 'searching' // no reliable lattice in view
  | 'blurry'
  | 'holding' // stable lattice, collecting frames
  | 'duplicate' // the face in view was already scanned
  | 'wrongFace' // the center color belongs to another face
  | 'done' // all six faces captured

export interface ScanFeedback {
  phase: ScanPhase
  target: Face | null
  /** 0..1 while holding. */
  progress: number
  /** Face that was just captured by this frame, if any. */
  captured: Face | null
  /** For 'duplicate' / 'wrongFace': which face is in view. */
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
    const n = options.n ?? 3
    // Most stickers of the face must be seen, not just predicted by the lattice.
    this.opts = { ...DEFAULTS, minInliers: n === 3 ? 7 : Math.max(3, Math.ceil(0.75 * n * n)), ...options }
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

  /** Forgets a scanned face and scans it next. */
  remove(face: Face) {
    delete this.faces[face]
    this.setTarget(face)
  }

  /** Runs the capture checks on a live frame without capturing; null means it would be accepted. */
  check(face: FaceDetection | null, sharpness: number, minInliers = this.opts.minInliers): ScanFeedback | null {
    return this.reject(face, sharpness, minInliers)
  }

  reset() {
    SCAN_ORDER.forEach((f) => delete this.faces[f])
    this.target = 'F'
    this.buffer = []
  }

  private feedback(phase: ScanPhase, extra: Partial<ScanFeedback> = {}): ScanFeedback {
    return {
      phase,
      target: this.target,
      progress: phase === 'holding' ? this.buffer.length / this.opts.stableFrames : 0,
      captured: null,
      seenFace: null,
      ...extra
    }
  }

  /** Checks shared by video frames and still photos; returns feedback when the face is rejected. */
  private reject(face: FaceDetection | null, sharpness: number, minInliers = this.opts.minInliers): ScanFeedback | null {
    if (!this.target) return this.feedback('done')
    if (!face || face.cells.length !== this.opts.n ** 2 || face.inliers < minInliers) return this.feedback('searching')
    if (sharpness < this.opts.minSharpness) return this.feedback('blurry')
    const labs = face.cells.map((c) => rgbToLab(c.rgb))
    const seen = SCAN_ORDER.find((f) => {
      const scan = this.faces[f]
      return f !== this.target && scan && faceDistance(labs, scan.labs) < this.opts.sameFaceDeltaE
    })
    if (seen) return this.feedback('duplicate', { seenFace: seen })
    const scanned = SCAN_ORDER.filter((f) => this.faces[f] && f !== this.target)
    const center = this.opts.n % 2 ? labs[(labs.length - 1) / 2] : undefined
    const other = center ? (this.opts.identify?.(center, this.target, scanned) ?? null) : null
    return other ? this.feedback('wrongFace', { seenFace: other }) : null
  }

  private capture(frames: FaceDetection[]): ScanFeedback {
    const captured = this.target as Face
    const cells = this.opts.n ** 2
    this.faces[captured] = {
      labs: toStandard(captured, Array.from({ length: cells }, (_, k) => medianLab(frames.map((f) => rgbToLab(f.cells[k]!.rgb))))),
      rgbs: toStandard(
        captured,
        Array.from({ length: cells }, (_, k) => [0, 1, 2].map((ch) => median(frames.map((f) => f.cells[k]!.rgb[ch]!))) as Rgb)
      )
    }
    this.buffer = []
    this.target = SCAN_ORDER.find((f) => !this.faces[f]) ?? null
    return this.feedback(this.target ? 'holding' : 'done', { captured, progress: 0 })
  }

  /** A still photo: captured immediately (no stability wait) if it passes the same checks. */
  pushStill(face: FaceDetection | null, sharpness: number): ScanFeedback {
    this.buffer = []
    return this.reject(face, sharpness) ?? this.capture([face as FaceDetection])
  }

  push(face: FaceDetection | null, sharpness: number): ScanFeedback {
    const rejected = this.reject(face, sharpness)
    if (rejected) {
      this.buffer = []
      return rejected
    }
    if (!face) return this.feedback('searching')

    const prev = this.buffer[this.buffer.length - 1]
    if (prev) {
      const motion = Math.max(...face.corners.map((c, i) => Math.hypot(c.x - prev.corners[i]!.x, c.y - prev.corners[i]!.y)))
      if (motion / face.pitch > this.opts.maxMotion) this.buffer = []
    }
    this.buffer.push(face)
    if (this.buffer.length < this.opts.stableFrames) return this.feedback('holding')
    return this.capture(this.buffer)
  }
}
