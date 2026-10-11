import { describe, expect, it } from 'vitest'
import {
  MOVES,
  SOLVED,
  SOLVED_FACELETS,
  applyMove,
  applyMoves,
  equals,
  fromFacelets,
  invertMoves,
  isSolved,
  parseAlgorithm,
  toFacelets,
  validateState,
  type Move
} from './index'

function randomMoves(n: number, seed: number): Move[] {
  let s = seed
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
  return Array.from({ length: n }, () => MOVES[Math.floor(rand() * MOVES.length)] as Move)
}

describe('moves', () => {
  it('every quarter turn has order 4', () => {
    for (const face of ['U', 'R', 'F', 'D', 'L', 'B'] as const) {
      expect(isSolved(applyMoves(SOLVED, [face, face, face, face]))).toBe(true)
      expect(isSolved(applyMoves(SOLVED, [face]))).toBe(false)
    }
  })

  it('X X\' and X2 X2 are identity', () => {
    for (const face of ['U', 'R', 'F', 'D', 'L', 'B'] as const) {
      expect(isSolved(applyMoves(SOLVED, [face, `${face}'`]))).toBe(true)
      expect(isSolved(applyMoves(SOLVED, [`${face}2`, `${face}2`]))).toBe(true)
    }
  })

  it('sexy move (R U R\' U\') has order 6', () => {
    const sexy = parseAlgorithm("R U R' U'")
    let s = SOLVED
    for (let i = 0; i < 6; i += 1) s = applyMoves(s, sexy)
    expect(isSolved(s)).toBe(true)
  })

  it('a sequence followed by its inverse is identity', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const seq = randomMoves(30, seed)
      expect(isSolved(applyMoves(applyMoves(SOLVED, seq), invertMoves(seq)))).toBe(true)
    }
  })

  it('random states stay structurally valid', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      expect(validateState(applyMoves(SOLVED, randomMoves(25, seed)))).toEqual([])
    }
  })
})

describe('facelets', () => {
  it('solved state maps to solved facelets', () => {
    expect(toFacelets(SOLVED)).toBe(SOLVED_FACELETS)
  })

  it('round-trips random states', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const s = applyMoves(SOLVED, randomMoves(25, seed))
      const r = fromFacelets(toFacelets(s))
      expect(r.ok).toBe(true)
      if (r.ok) expect(equals(r.state, s)).toBe(true)
    }
  })

  it('matches a known facelet string for R', () => {
    // Applying R to solved: U right column takes F colors, etc.
    expect(toFacelets(applyMove(SOLVED, 'R'))).toBe(
      'UUFUUFUUF' + 'RRRRRRRRR' + 'FFDFFDFFD' + 'DDBDDBDDB' + 'LLLLLLLLL' + 'UBBUBBUBB'
    )
  })

  const swap = (str: string, i: number, j: number) => {
    const a = str.split('')
    ;[a[i], a[j]] = [a[j] as string, a[i] as string]
    return a.join('')
  }

  it('detects a twisted corner', () => {
    // Rotate URF stickers (8, 9, 20) by one step.
    const a = SOLVED_FACELETS.split('')
    ;[a[8], a[9], a[20]] = [a[20] as string, a[8] as string, a[9] as string]
    const r = fromFacelets(a.join(''))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors).toContainEqual({ kind: 'cornerTwist' })
  })

  it('detects a flipped edge', () => {
    const r = fromFacelets(swap(SOLVED_FACELETS, 5, 10))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors).toContainEqual({ kind: 'edgeFlip' })
  })

  it('detects parity (two edges swapped)', () => {
    // Swap UR and UF edges completely.
    let f = swap(SOLVED_FACELETS, 5, 7)
    f = swap(f, 10, 19)
    const r = fromFacelets(f)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors).toContainEqual({ kind: 'parity' })
  })

  it('detects wrong color counts and impossible cubies', () => {
    const f = 'R' + SOLVED_FACELETS.slice(1)
    const r = fromFacelets(f)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors).toContainEqual({ kind: 'colorCount', face: 'U', count: 8 })
      expect(r.errors).toContainEqual({ kind: 'invalidCorner', position: 2 })
    }
  })

  it('detects misplaced centers and bad input', () => {
    expect(fromFacelets(swap(SOLVED_FACELETS, 4, 13))).toEqual({ ok: false, errors: [{ kind: 'centers' }] })
    expect(fromFacelets('U')).toEqual({ ok: false, errors: [{ kind: 'length', length: 1 }] })
    expect(fromFacelets('X' + SOLVED_FACELETS.slice(1)).ok).toBe(false)
  })
})
