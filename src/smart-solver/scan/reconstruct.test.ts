import { describe, expect, it } from 'vitest'
import { MOVES, SOLVED, SOLVED_FACELETS, applyMoves, toFacelets, type Face, type Move } from '../core'
import { FACES } from '../core/types'
import { rgbToLab, type Lab } from '../vision/color'
import { hungarian } from './hungarian'
import { reconstruct, type ScanInput } from './reconstruct'

describe('hungarian', () => {
  it('finds the optimal assignment', () => {
    const cost = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2]
    ]
    expect(hungarian(cost)).toEqual([1, 0, 2])
  })

  it('matches brute force on random 5x5 matrices', () => {
    let s = 3
    const rand = () => {
      s = (s * 1103515245 + 12345) % 2147483648
      return s / 2147483648
    }
    const perms = (n: number): number[][] =>
      n === 0 ? [[]] : perms(n - 1).flatMap((p) => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)]))
    for (let t = 0; t < 30; t += 1) {
      const cost = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => Math.round(rand() * 100)))
      const total = (a: number[]) => a.reduce((sum, j, i) => sum + (cost[i] as number[])[j]!, 0)
      const brute = Math.min(...perms(5).map(total))
      expect(total(hungarian(cost))).toBe(brute)
    }
  })
})

// Typical real-world sticker colors (sRGB) for the standard scheme.
const STICKER_RGB: Record<Face, [number, number, number]> = {
  U: [235, 235, 230], // white
  D: [245, 205, 40], // yellow
  F: [30, 160, 80], // green
  B: [30, 75, 195], // blue
  R: [195, 35, 45], // red
  L: [245, 125, 30] // orange
}

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

function randomMoves(n: number, seed: number): Move[] {
  const r = rng(seed)
  return Array.from({ length: n }, () => MOVES[Math.floor(r() * MOVES.length)] as Move)
}

// Inverse of the reconstruct rotation: image cell shown at facelet cell k after t clockwise turns.
function rotateImage(cells: Lab[], t: number): Lab[] {
  let out = cells
  for (let i = 0; i < t; i += 1) {
    // Counter-clockwise turn of the image, so that one clockwise turn restores it.
    out = Array.from({ length: 9 }, (_, k) => out[(k % 3) * 3 + (2 - Math.floor(k / 3))] as Lab)
  }
  return out
}

interface SimOptions {
  seed: number
  /** Per-face brightness multiplier range. */
  lightSpread?: number
  noise?: number
  rotations?: Partial<Record<Face, number>>
  /** Override the sRGB of specific facelets (e.g. a red sticker that reads orange). */
  override?: Record<number, [number, number, number]>
}

function simulateScan(facelets: string, { seed, lightSpread = 0.35, noise = 6, rotations = {}, override = {} }: SimOptions): ScanInput {
  const r = rng(seed)
  const input = {} as Record<Face, Lab[]>
  FACES.forEach((face, fi) => {
    const light = 1 - lightSpread / 2 + r() * lightSpread
    const cells = Array.from({ length: 9 }, (_, k) => {
      const idx = fi * 9 + k
      const base = override[idx] ?? STICKER_RGB[facelets[idx] as Face]
      const rgb = base.map((v) => Math.max(0, Math.min(255, v * light + (r() - 0.5) * 2 * noise))) as [number, number, number]
      return rgbToLab(rgb)
    })
    input[face] = rotateImage(cells, rotations[face] ?? 0)
  })
  return input
}

describe('reconstruct', () => {
  it('rebuilds a solved cube', () => {
    const r = reconstruct(simulateScan(SOLVED_FACELETS, { seed: 1 }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.result.facelets).toBe(SOLVED_FACELETS)
      expect(r.result.alternative).toBeNull()
    }
  })

  it('rebuilds random scrambles under uneven light and noise', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const truth = toFacelets(applyMoves(SOLVED, randomMoves(25, seed)))
      const r = reconstruct(simulateScan(truth, { seed }))
      expect(r.ok).toBe(true)
      if (!r.ok) continue
      expect(r.result.facelets, `seed ${seed}`).toBe(truth)
      expect(r.result.changed).toEqual([])
      expect(r.result.alternative).toBeNull()
    }
  })

  it('undoes faces held at the wrong rotation', () => {
    const truth = toFacelets(applyMoves(SOLVED, randomMoves(25, 99)))
    const rotations = { U: 1, R: 2, D: 3, B: 1 }
    const r = reconstruct(simulateScan(truth, { seed: 5, rotations }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.result.facelets).toBe(truth)
    expect(r.result.rotations).toMatchObject({ U: 1, R: 2, D: 3, B: 1, F: 0, L: 0 })
  })

  it('corrects a red sticker misread as orange using cube constraints', () => {
    const truth = toFacelets(applyMoves(SOLVED, randomMoves(25, 7)))
    const victim = [...truth].findIndex((c, i) => c === 'R' && i % 9 !== 4)
    const r = reconstruct(simulateScan(truth, { seed: 7, lightSpread: 0, override: { [victim]: [240, 120, 35] } }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.result.facelets).toBe(truth)
    expect(r.result.changed).toEqual([victim])
  })

  it('flags stickers halfway between two center colors', () => {
    const truth = toFacelets(applyMoves(SOLVED, randomMoves(25, 11)))
    const victim = [...truth].findIndex((c, i) => c === 'L' && i % 9 !== 4)
    const r = reconstruct(simulateScan(truth, { seed: 11, lightSpread: 0, noise: 0, override: { [victim]: [220, 80, 38] } }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.result.lowConfidence).toContain(victim)
  })

  it('rejects two faces with the same center color', () => {
    const scan = simulateScan(SOLVED_FACELETS, { seed: 2 })
    scan.B = scan.F
    const r = reconstruct(scan)
    expect(r).toEqual({ ok: false, reason: 'duplicateCenters', faces: ['F', 'B'] })
  })

  it('runs in reasonable time', () => {
    const truth = toFacelets(applyMoves(SOLVED, randomMoves(25, 3)))
    const scan = simulateScan(truth, { seed: 3 })
    const t0 = performance.now()
    reconstruct(scan)
    expect(performance.now() - t0).toBeLessThan(3000)
  })
})
