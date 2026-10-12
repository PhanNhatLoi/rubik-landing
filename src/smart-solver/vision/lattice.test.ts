import { describe, expect, it } from 'vitest'
import { findGrid, fitHomography, fitLattice, project, type Homography, type SquareCandidate } from './lattice'

function syntheticH(angleDeg: number, pitch: number, origin: { x: number; y: number }, persp = 0): Homography {
  const t = (angleDeg * Math.PI) / 180
  const c = Math.cos(t) * pitch
  const s = Math.sin(t) * pitch
  return [c, -s, origin.x, s, c, origin.y, persp, persp / 2, 1]
}

function candidatesFrom(h: Homography, cells: number[], angle: number, pitch: number): SquareCandidate[] {
  return cells.map((cell) => ({ center: project(h, cell % 3, Math.floor(cell / 3)), side: pitch * 0.85, angle }))
}

describe('fitHomography', () => {
  it('recovers an exact homography from 4+ points', () => {
    const h = syntheticH(20, 50, { x: 100, y: 80 }, 0.02)
    const src = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ x: i % 3, y: Math.floor(i / 3) }))
    const dst = src.map((p) => project(h, p.x, p.y))
    const fitted = fitHomography(src, dst, 150)
    expect(fitted).not.toBeNull()
    const p = project(fitted as Homography, 2.5, -0.5)
    const q = project(h, 2.5, -0.5)
    expect(p.x).toBeCloseTo(q.x, 6)
    expect(p.y).toBeCloseTo(q.y, 6)
  })
})

describe('fitLattice', () => {
  it('finds a full rotated lattice', () => {
    const h = syntheticH(25, 60, { x: 90, y: 70 })
    const fit = fitLattice(candidatesFrom(h, [0, 1, 2, 3, 4, 5, 6, 7, 8], 25, 60))
    expect(fit).not.toBeNull()
    expect(fit?.inliers).toBe(9)
    expect(fit?.error).toBeLessThan(1e-6)
    expect(fit?.assignment).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('handles angles near 45° and the 90° symmetry', () => {
    for (const angle of [-80, -44, 0, 44, 89, 135]) {
      const h = syntheticH(angle, 50, { x: 160, y: 160 })
      const fit = fitLattice(candidatesFrom(h, [0, 1, 2, 3, 4, 5, 6, 7, 8], angle, 50))
      expect(fit?.inliers, `angle ${angle}`).toBe(9)
    }
  })

  it('tolerates missing cells, outliers, noise and mild perspective', () => {
    const h = syntheticH(-15, 55, { x: 80, y: 90 }, 0.03)
    const cands = candidatesFrom(h, [0, 1, 3, 4, 5, 7, 8], -15, 55).map((c, i) => ({
      ...c,
      center: { x: c.center.x + ((i * 7) % 3) - 1, y: c.center.y + ((i * 5) % 3) - 1 }
    }))
    cands.push({ center: { x: 10, y: 10 }, side: 50, angle: 3 })
    cands.push({ center: { x: 300, y: 20 }, side: 40, angle: 30 })
    const fit = fitLattice(cands)
    expect(fit).not.toBeNull()
    expect(fit?.inliers).toBe(7)
    expect(fit?.assignment[2]).toBe(-1)
    expect(fit?.assignment[6]).toBe(-1)
    // Unseen corner cell is still predicted close to the truth.
    const p = project((fit as { homography: Homography }).homography, 0, 2)
    const q = project(h, 0, 2)
    expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeLessThan(4)
  })

  it('rejects too few or collinear candidates', () => {
    const h = syntheticH(0, 50, { x: 50, y: 50 })
    expect(fitLattice(candidatesFrom(h, [0, 1, 2, 4], 0, 50))).toBeNull()
    expect(fitLattice(candidatesFrom(h, [0, 1, 2], 0, 50), { minInliers: 3 })).toBeNull()
  })

  it('rejects scattered blobs that do not form a lattice', () => {
    const cands: SquareCandidate[] = [
      { x: 13, y: 40 }, { x: 90, y: 17 }, { x: 150, y: 140 }, { x: 47, y: 230 }, { x: 260, y: 90 }, { x: 200, y: 260 }
    ].map((center) => ({ center, side: 40, angle: 0 }))
    expect(fitLattice(cands)).toBeNull()
  })
})

describe('findGrid', () => {
  const grid = (n: number, angle: number, skip: number[] = []) => {
    const pitch = 240 / n
    const h = syntheticH(angle, pitch, { x: 60, y: 60 })
    return Array.from({ length: n * n }, (_, i) => i)
      .filter((i) => !skip.includes(i))
      .map((i) => ({ center: project(h, i % n, Math.floor(i / n)), side: pitch * 0.85, angle }))
  }

  it('recognises 2x2, 3x3, 4x4 and 5x5 faces', () => {
    for (const n of [2, 3, 4, 5]) expect(findGrid(grid(n, 12)).size, `${n}x${n}`).toBe(n)
    for (const n of [2, 3, 4, 5]) expect(findGrid(grid(n, 12)).fit?.inliers, `${n}x${n}`).toBe(n * n)
  })

  it('does not take part of a partly hidden 4x4 face for a 3x3 one', () => {
    // Five of sixteen stickers hidden: too few for a 4x4 fit, but a 3x3 block is complete.
    const r = findGrid(grid(4, -8, [3, 7, 11, 12, 13]))
    expect(r.size).not.toBe(3)
    expect(r.fit?.n).not.toBe(3)
  })

  it('keeps a 3x3 face with two hidden stickers as 3x3', () => {
    expect(findGrid(grid(3, 20, [2, 6])).size).toBe(3)
  })
})
