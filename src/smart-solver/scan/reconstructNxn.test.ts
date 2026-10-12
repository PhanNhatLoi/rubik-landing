import { describe, expect, it } from 'vitest'
import { FACES, type Face } from '../core/types'
import { FACE_ORDER, getEngine } from '../nxn/engine'
import { rgbToLab, type Lab } from '../vision/color'
import { reconstructNxn } from './reconstructNxn'

// Typical real-world sticker colors (sRGB) for the standard scheme.
const STICKER_RGB: Record<Face, [number, number, number]> = {
  U: [235, 235, 230],
  D: [245, 205, 40],
  F: [30, 160, 80],
  B: [30, 75, 195],
  R: [195, 35, 45],
  L: [245, 125, 30]
}
// Scheme references a bit off from the real stickers, as with an unknown cube.
const REFS = Object.fromEntries(FACES.map((f) => [f, rgbToLab(STICKER_RGB[f].map((v) => Math.min(255, v * 0.9 + 12)) as [number, number, number])])) as Record<Face, Lab>

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

/** Scrambles that keep an odd cube's centers in place, as when it is held by its centers to scan. */
function scrambled(n: number, seed: number): Uint8Array {
  const r = rng(seed)
  const e = getEngine(n)
  const depths = Array.from({ length: n - 2 }, (_, d) => d + 2).filter((d) => n % 2 === 0 || d !== (n + 1) / 2)
  const tokens = FACE_ORDER.flatMap((f) => ['', "'", '2'].flatMap((s) => [`${f}${s}`, ...depths.map((d) => `${d}${f}${s}`)]))
  return e.applyAll(e.solved(), Array.from({ length: 40 }, () => tokens[Math.floor(r() * tokens.length)] as string))
}

function simulate(stickers: Uint8Array, n: number, seed: number, lightSpread = 0.35, noise = 6): Record<Face, Lab[]> {
  const r = rng(seed + 1000)
  const per = n * n
  const out = {} as Record<Face, Lab[]>
  FACES.forEach((face, fi) => {
    const light = 1 - lightSpread / 2 + r() * lightSpread
    out[face] = Array.from({ length: per }, (_, k) => {
      const base = STICKER_RGB[FACES[stickers[fi * per + k] as number] as Face]
      return rgbToLab(base.map((v) => Math.max(0, Math.min(255, v * light + (r() - 0.5) * 2 * noise))) as [number, number, number])
    })
  })
  return out
}

describe('reconstructNxn', () => {
  for (const n of [2, 4, 5]) {
    it(`reads ${n}x${n} scrambles under uneven light and noise`, () => {
      const t0 = performance.now()
      for (let seed = 1; seed <= 10; seed += 1) {
        const truth = scrambled(n, seed)
        const r = reconstructNxn(n, simulate(truth, n, seed), REFS)
        expect(Array.from(r.stickers), `${n}x${n} seed ${seed}`).toEqual(Array.from(truth))
      }
      console.log(`[bench] reconstructNxn ${n}x${n}: ${((performance.now() - t0) / 10).toFixed(1)} ms per cube`)
    })
  }

  it('keeps exactly n² stickers per color even when a color reads ambiguously', () => {
    const n = 4
    const truth = scrambled(n, 7)
    const scan = simulate(truth, n, 7, 0.6, 14)
    const r = reconstructNxn(n, scan, REFS)
    const counts = FACES.map((_, label) => r.stickers.filter((v) => v === label).length)
    expect(counts).toEqual([16, 16, 16, 16, 16, 16])
  })
})
