import { createRequire } from 'node:module'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createFaceDetector, type FaceDetector, type Rgb } from './detect'
import { project, type Homography } from './lattice'
import { initOpenCv } from './opencv'

const SIZE = 320
const PALETTE: Rgb[] = [
  [240, 240, 235], // white
  [250, 210, 30], // yellow
  [200, 30, 40], // red
  [250, 120, 20], // orange
  [20, 160, 80], // green
  [20, 70, 200] // blue
]

function invert(h: Homography): Homography {
  const [a, b, c, d, e, f, g, k, m] = h as [number, number, number, number, number, number, number, number, number]
  const A = e * m - f * k
  const B = -(d * m - f * g)
  const C = d * k - e * g
  const det = a * A + b * B + c * C
  return [A, -(b * m - c * k), b * f - c * e, B, a * m - c * g, -(a * f - c * d), C, -(a * k - b * g), a * e - b * d].map(
    (v) => v / det
  )
}

interface Scene {
  h: Homography
  colors: Rgb[]
  /** Cells covered by a "finger" (drawn as skin color over the sticker). */
  occluded?: number[]
  /** Cells with a specular highlight. */
  glare?: number[]
  background?: Rgb
  /** Illumination multiplier per pixel. */
  light?: (x: number, y: number) => number
  /** Sticker half-size in lattice units (0.5 = no gap). */
  half?: number
  /** Sticker corner radius in lattice units. */
  radius?: number
  /** Stickers per side (3 unless testing other cube sizes). */
  n?: number
}

function insideRoundedSquare(dx: number, dy: number, half: number, radius: number): boolean {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ax > half || ay > half) return false
  const inner = half - radius
  if (ax <= inner || ay <= inner) return true
  return Math.hypot(ax - inner, ay - inner) <= radius
}

function render(
  { h, colors, occluded = [], glare = [], background, light = () => 1, half = 0.42, radius = 0, n = 3 }: Scene,
  seed = 1
): Uint8ClampedArray {
  const inv = invert(h)
  const out = new Uint8ClampedArray(SIZE * SIZE * 4)
  let s = seed
  const noise = () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return (s / 2147483648 - 0.5) * 16
  }
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const p = project(inv, x, y)
      let rgb: Rgb = background ?? [110 + y * 0.2, 105 + x * 0.1, 100]
      if (p.x > -0.55 && p.x < n - 0.45 && p.y > -0.55 && p.y < n - 0.45) {
        rgb = [22, 22, 24]
        const col = Math.round(p.x)
        const row = Math.round(p.y)
        if (col >= 0 && col < n && row >= 0 && row < n && insideRoundedSquare(p.x - col, p.y - row, half, radius)) {
          const cell = row * n + col
          rgb = occluded.includes(cell) ? [215, 160, 130] : (colors[cell % colors.length] as Rgb)
          // Elliptical highlight in the upper-left part of the sticker.
          if (glare.includes(cell) && ((p.x - col + 0.12) / 0.22) ** 2 + ((p.y - row + 0.15) / 0.12) ** 2 < 1) {
            rgb = [255, 255, 255]
          }
        }
      }
      const k = light(x, y)
      const i = (y * SIZE + x) * 4
      out[i] = rgb[0] * k + noise()
      out[i + 1] = rgb[1] * k + noise()
      out[i + 2] = rgb[2] * k + noise()
      out[i + 3] = 255
    }
  }
  return out
}

function lattice(angleDeg: number, pitch: number, persp = 0, n = 3): Homography {
  const t = (angleDeg * Math.PI) / 180
  const c = Math.cos(t) * pitch
  const s = Math.sin(t) * pitch
  // Center the lattice in the frame.
  const m = (n - 1) / 2
  const cx = SIZE / 2 - (c * m - s * m)
  const cy = SIZE / 2 - (s * m + c * m)
  return [c, -s, cx, s, c, cy, persp, persp * 0.5, 1]
}

const colorsA = [0, 2, 4, 1, 3, 5, 5, 0, 2].map((i) => PALETTE[i] as Rgb)

let detector: FaceDetector

beforeAll(async () => {
  // Loaded through require: vitest's ESM interop awaits the thenable module and hangs.
  const { cv } = await initOpenCv(createRequire(import.meta.url)('@techstark/opencv-js'))
  detector = createFaceDetector(cv)
})

afterAll(() => detector.dispose())

describe('createFaceDetector', () => {
  it('detects a frontal face and samples sticker colors', () => {
    const scene = { h: lattice(0, 80), colors: colorsA }
    const r = detector.detect(render(scene), SIZE, SIZE)
    expect(r.face).not.toBeNull()
    expect(r.face?.inliers).toBe(9)
    r.face?.cells.forEach((cell, i) => {
      const truth = project(scene.h, i % 3, Math.floor(i / 3))
      expect(Math.hypot(cell.center.x - truth.x, cell.center.y - truth.y)).toBeLessThan(3)
      cell.rgb.forEach((v, k) => expect(Math.abs(v - ((colorsA[i] as Rgb)[k] as number))).toBeLessThan(12))
    })
  })

  it('handles rotation and mild perspective', () => {
    for (const [angle, persp] of [[20, 0], [-35, 0], [10, 0.0006], [-15, -0.0005]] as const) {
      const scene = { h: lattice(angle, 70, persp), colors: colorsA }
      const r = detector.detect(render(scene, angle + 50), SIZE, SIZE)
      expect(r.face, `angle ${angle} persp ${persp}`).not.toBeNull()
      expect(r.face?.inliers).toBeGreaterThanOrEqual(8)
      const truth = project(scene.h, -0.5, -0.5)
      const corners = r.face?.corners ?? []
      // Same lattice up to the 90° labelling ambiguity: some outer corner matches.
      const best = Math.min(...corners.map((c) => Math.hypot(c.x - truth.x, c.y - truth.y)))
      expect(best).toBeLessThan(5)
    }
  })

  it('still fits the lattice with two stickers occluded', () => {
    const scene = { h: lattice(8, 75), colors: colorsA, occluded: [2, 5] }
    const r = detector.detect(render(scene), SIZE, SIZE)
    expect(r.face).not.toBeNull()
    expect(r.face?.inliers).toBeGreaterThanOrEqual(7)
  })

  // Conditions seen with real cubes: dark stickers against black plastic, bright tables,
  // uneven light, glare and rounded stickers.
  const hard: [string, Partial<Scene>][] = [
    ['dim light on a bright table', { background: [215, 212, 205], light: () => 0.5 }],
    ['strong side light', { light: (x) => 0.3 + (x / SIZE) * 0.9 }],
    ['glare on two stickers', { glare: [1, 5] }],
    ['rounded stickers with thin gaps', { radius: 0.14, half: 0.46 }],
    ['dark stickers on a white table', { background: [235, 235, 230], light: () => 0.75 }]
  ]
  const darkColors = [2, 4, 5, 5, 2, 4, 4, 5, 2].map((i) => PALETTE[i] as Rgb)
  for (const [name, extra] of hard) {
    it(`detects all 9 stickers: ${name}`, () => {
      const scene: Scene = { h: lattice(12, 72, 0.0003), colors: name.startsWith('dark') ? darkColors : colorsA, ...extra }
      const r = detector.detect(render(scene, 7), SIZE, SIZE)
      expect(r.face, name).not.toBeNull()
      expect(r.face?.inliers, name).toBe(9)
    })
  }

  it('tells other cube sizes apart and returns no 3x3 face for them', () => {
    for (const n of [2, 4, 5]) {
      const scene: Scene = { h: lattice(10, 220 / n, 0, n), colors: colorsA, n }
      const r = detector.detect(render(scene, n), SIZE, SIZE)
      expect(r.gridSize, `${n}x${n}`).toBe(n)
      expect(r.face).toBeNull()
      const own = detector.detect(render(scene, n), SIZE, SIZE, n)
      expect(own.face?.cells.length, `${n}x${n} face`).toBe(n * n)
      expect(own.face?.inliers, `${n}x${n} inliers`).toBe(n * n)
    }
    const r3 = detector.detect(render({ h: lattice(10, 72), colors: colorsA }), SIZE, SIZE)
    expect(r3.gridSize).toBe(3)
  })

  it('finds nothing on an empty background', () => {
    const scene = { h: lattice(0, 1e-3), colors: colorsA }
    const r = detector.detect(render(scene), SIZE, SIZE)
    expect(r.face).toBeNull()
  })

  it('reuses buffers across frame sizes without throwing', () => {
    const scene = { h: lattice(0, 80), colors: colorsA }
    const img = render(scene)
    expect(detector.detect(img, SIZE, SIZE).face).not.toBeNull()
    expect(detector.detect(img.slice(0, 160 * 320 * 4), SIZE, 160).face).toBeNull()
    expect(detector.detect(img, SIZE, SIZE).face).not.toBeNull()
  })
})
