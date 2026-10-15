import { describe, expect, it } from 'vitest'
import { FACES, type Face } from '../smart-solver/core/types'
import { frameFor } from './frame'

type Vec = [number, number, number]
const NORMAL: Record<Face, Vec> = { U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] }
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1] + 0, a[2] * b[0] - a[0] * b[2] + 0, a[0] * b[1] - a[1] * b[0] + 0]

describe('frameFor', () => {
  it.each(FACES)('front %s is a pure rotation of the cube', (front) => {
    const f = frameFor(front)
    expect(f.F).toBe(front)
    expect(new Set(Object.values(f)).size).toBe(6)
    expect(NORMAL[f.B]).toEqual(NORMAL[f.F].map((v) => 0 - v))
    expect(NORMAL[f.D]).toEqual(NORMAL[f.U].map((v) => 0 - v))
    expect(NORMAL[f.L]).toEqual(NORMAL[f.R].map((v) => 0 - v))
    expect(NORMAL[f.R]).toEqual(cross(NORMAL[f.U], NORMAL[f.F]))
  })
})
