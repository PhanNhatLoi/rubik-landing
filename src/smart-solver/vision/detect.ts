import { fitLattice, project, type Point, type SquareCandidate } from './lattice'
import type { OpenCv } from './opencv'

export type Rgb = [number, number, number]

export interface CellObservation {
  center: Point
  /** Quad of the sticker area (shrunk from the cell), clockwise from top-left. */
  polygon: [Point, Point, Point, Point]
  /** True when a sticker blob was matched to this cell; false when only predicted. */
  observed: boolean
  rgb: Rgb
}

export interface FaceDetection {
  /** Outer corners of the 3x3 lattice, clockwise from top-left (in image pixels). */
  corners: [Point, Point, Point, Point]
  cells: CellObservation[]
  inliers: number
  error: number
  pitch: number
}

export interface DetectResult {
  face: FaceDetection | null
  candidates: number
  sharpness: number
}

export interface FaceDetector {
  detect(rgba: Uint8ClampedArray, width: number, height: number): DetectResult
  dispose(): void
}

function medianOf(gray: Uint8Array): number {
  const hist = new Uint32Array(256)
  for (let i = 0; i < gray.length; i += 1) hist[gray[i] as number] = (hist[gray[i] as number] as number) + 1
  let acc = 0
  const half = gray.length / 2
  for (let v = 0; v < 256; v += 1) {
    acc += hist[v] as number
    if (acc >= half) return v
  }
  return 128
}

/** Per-channel median RGB of a square patch around `center`, clipped to the image (robust to glare). */
export function samplePatch(rgba: Uint8ClampedArray, width: number, height: number, center: Point, radius: number): Rgb {
  const x0 = Math.max(0, Math.round(center.x - radius))
  const x1 = Math.min(width - 1, Math.round(center.x + radius))
  const y0 = Math.max(0, Math.round(center.y - radius))
  const y1 = Math.min(height - 1, Math.round(center.y + radius))
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)] as const
  let n = 0
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const i = (y * width + x) * 4
      for (let ch = 0; ch < 3; ch += 1) {
        const h = hist[ch as 0 | 1 | 2]
        const v = rgba[i + ch] as number
        h[v] = (h[v] as number) + 1
      }
      n += 1
    }
  }
  if (!n) return [0, 0, 0]
  const median = (h: Uint32Array) => {
    let acc = 0
    for (let v = 0; v < 256; v += 1) {
      acc += h[v] as number
      if (acc * 2 >= n) return v
    }
    return 255
  }
  return [median(hist[0]), median(hist[1]), median(hist[2])]
}

/**
 * Detects one 3x3 face in an RGBA frame (expected to be the guide region, face roughly frontal).
 * Mats are allocated per frame size and reused; call dispose() to free them.
 */
export function createFaceDetector(cv: OpenCv): FaceDetector {
  let width = 0
  let height = 0
  let src: InstanceType<OpenCv['Mat']> | null = null
  let gray: InstanceType<OpenCv['Mat']> | null = null
  let blurred: InstanceType<OpenCv['Mat']> | null = null
  let edges: InstanceType<OpenCv['Mat']> | null = null
  let lap: InstanceType<OpenCv['Mat']> | null = null
  let value: InstanceType<OpenCv['Mat']> | null = null
  let mask: InstanceType<OpenCv['Mat']> | null = null
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U)

  function release() {
    ;[src, gray, blurred, edges, lap, value, mask].forEach((m) => m?.delete())
    src = gray = blurred = edges = lap = value = mask = null
  }

  function ensure(w: number, h: number) {
    if (w === width && h === height && src) return
    release()
    width = w
    height = h
    src = new cv.Mat(h, w, cv.CV_8UC4)
    gray = new cv.Mat()
    blurred = new cv.Mat()
    edges = new cv.Mat()
    lap = new cv.Mat()
    value = new cv.Mat(h, w, cv.CV_8UC1)
    mask = new cv.Mat()
  }

  function sharpnessOf(g: InstanceType<OpenCv['Mat']>): number {
    const mean = new cv.Mat()
    const std = new cv.Mat()
    try {
      cv.Laplacian(g, lap as InstanceType<OpenCv['Mat']>, cv.CV_64F)
      cv.meanStdDev(lap as InstanceType<OpenCv['Mat']>, mean, std)
      const s = std.doubleAt(0, 0)
      return s * s
    } finally {
      mean.delete()
      std.delete()
    }
  }

  /** Collects sticker-shaped blobs from a binary image into `out`. */
  function collectCandidates(
    binary: InstanceType<OpenCv['Mat']>,
    mode: number,
    minSide: number,
    maxSide: number,
    out: SquareCandidate[]
  ) {
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    try {
      cv.findContours(binary, contours, hierarchy, mode, cv.CHAIN_APPROX_SIMPLE)
      for (let i = 0; i < contours.size(); i += 1) {
        const c = contours.get(i)
        const hull = new cv.Mat()
        try {
          const area = cv.contourArea(c)
          const side = Math.sqrt(area)
          if (side < minSide || side > maxSide) continue
          cv.convexHull(c, hull)
          const solidity = area / Math.max(cv.contourArea(hull), 1)
          const rect = cv.minAreaRect(c)
          const w = rect.size.width
          const h = rect.size.height
          const aspect = Math.min(w, h) / Math.max(w, h)
          const fill = area / Math.max(w * h, 1)
          if (solidity < 0.9 || aspect < 0.65 || fill < 0.7) continue
          out.push({ center: { x: rect.center.x, y: rect.center.y }, side, angle: rect.angle })
        } finally {
          hull.delete()
          c.delete()
        }
      }
    } finally {
      contours.delete()
      hierarchy.delete()
    }
  }

  /** Several sources find the same sticker: keep one candidate per location. */
  function dedupe(cands: SquareCandidate[]): SquareCandidate[] {
    const sorted = [...cands].sort((a, b) => b.side - a.side)
    return sorted.filter(
      (c, i) => !sorted.slice(0, i).some((k) => Math.hypot(k.center.x - c.center.x, k.center.y - c.center.y) < k.side * 0.5)
    )
  }

  /** max(R, G, B): every sticker color is bright here, while the plastic body stays dark. */
  function fillValue(rgba: Uint8ClampedArray, v: Uint8Array) {
    for (let i = 0, j = 0; j < v.length; i += 4, j += 1) {
      const r = rgba[i] as number
      const g = rgba[i + 1] as number
      const b = rgba[i + 2] as number
      v[j] = r > g ? (r > b ? r : b) : g > b ? g : b
    }
  }

  return {
    detect(rgba, w, h) {
      ensure(w, h)
      const s = src as InstanceType<OpenCv['Mat']>
      const g = gray as InstanceType<OpenCv['Mat']>
      const bl = blurred as InstanceType<OpenCv['Mat']>
      const ed = edges as InstanceType<OpenCv['Mat']>
      const v = value as InstanceType<OpenCv['Mat']>
      const mk = mask as InstanceType<OpenCv['Mat']>
      s.data.set(rgba)
      cv.cvtColor(s, g, cv.COLOR_RGBA2GRAY)
      const sharpness = sharpnessOf(g)
      const size = Math.min(w, h)
      const minSide = size * 0.06
      const maxSide = size * 0.34
      const raw: SquareCandidate[] = []

      // Source 1: edges on gray. Works for stickerless cubes; misses dark stickers on black plastic.
      cv.GaussianBlur(g, bl, new cv.Size(5, 5), 0)
      const m = medianOf(bl.data)
      cv.Canny(bl, ed, Math.min(20, 0.5 * m), Math.min(50, 1.2 * m))
      cv.dilate(ed, ed, kernel)
      collectCandidates(ed, cv.RETR_LIST, minSide, maxSide, raw)

      // Sources 2-3: stickers vs. dark body on max(R,G,B), with a global (Otsu) and a local threshold.
      fillValue(rgba, v.data)
      cv.GaussianBlur(v, v, new cv.Size(3, 3), 0)
      cv.threshold(v, mk, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU)
      cv.morphologyEx(mk, mk, cv.MORPH_OPEN, kernel)
      collectCandidates(mk, cv.RETR_EXTERNAL, minSide, maxSide, raw)
      const block = Math.max(3, Math.round(size / 4) | 1)
      cv.adaptiveThreshold(v, mk, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY, block, -6)
      cv.morphologyEx(mk, mk, cv.MORPH_OPEN, kernel)
      collectCandidates(mk, cv.RETR_EXTERNAL, minSide, maxSide, raw)

      const candidates = dedupe(raw)
      const fit = fitLattice(candidates)
      if (!fit) return { face: null, candidates: candidates.length, sharpness }

      const H = fit.homography
      const at = (col: number, row: number) => project(H, col, row)
      const cells: CellObservation[] = []
      for (let cell = 0; cell < 9; cell += 1) {
        const col = cell % 3
        const row = Math.floor(cell / 3)
        const k = 0.32
        cells.push({
          center: at(col, row),
          polygon: [at(col - k, row - k), at(col + k, row - k), at(col + k, row + k), at(col - k, row + k)],
          observed: (fit.assignment[cell] as number) >= 0,
          rgb: samplePatch(rgba, w, h, at(col, row), fit.pitch * 0.18)
        })
      }
      return {
        face: {
          corners: [at(-0.5, -0.5), at(2.5, -0.5), at(2.5, 2.5), at(-0.5, 2.5)],
          cells,
          inliers: fit.inliers,
          error: fit.error,
          pitch: fit.pitch
        },
        candidates: candidates.length,
        sharpness
      }
    },
    dispose() {
      release()
      kernel.delete()
    }
  }
}
