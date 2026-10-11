import { describe, expect, it } from 'vitest'
import { MOVES, SOLVED, applyMoves, toFacelets, type Move } from '../core'
import { FACE_ORDER, getEngine, invertSequence, isSolvedState, splitMoves } from './engine'

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

/** Every move token that exists on an n×n cube. */
function allMoves(n: number): string[] {
  const out: string[] = []
  for (const f of FACE_ORDER) {
    for (const s of ['', "'", '2']) {
      out.push(`${f}${s}`)
      for (let d = 2; d <= n - 1; d += 1) out.push(`${d}${f}${s}`)
      for (let d = 2; d <= n - 1; d += 1) out.push(`${d === 2 ? '' : d}${f}w${s}`)
    }
  }
  for (const r of ['x', 'y', 'z']) for (const s of ['', "'", '2']) out.push(`${r}${s}`)
  return out
}

const equal = (a: Uint8Array, b: Uint8Array) => a.every((v, i) => v === b[i])

describe.each([2, 3, 4, 5])('%ix%i move engine', (n) => {
  const e = getEngine(n)
  const moves = allMoves(n)

  it('has 6·n² stickers', () => expect(e.stickers).toBe(6 * n * n))

  it('X⁴ = id, X X\' = id, X2 X2 = id for every move', () => {
    const start = e.applyAll(e.solved(), ['R', 'U', "F'", 'D2', 'L', "B'"])
    for (const m of moves.filter((m) => !m.endsWith("'") && !m.endsWith('2'))) {
      expect(equal(e.applyAll(start, [m, m, m, m]), start), m).toBe(true)
      expect(equal(e.applyAll(start, [m, `${m}'`]), start), m).toBe(true)
      expect(equal(e.applyAll(start, [`${m}2`, `${m}2`]), start), m).toBe(true)
      expect(equal(e.apply(start, `${m}2`), e.applyAll(start, [m, m])), m).toBe(true)
    }
  })

  it('wide moves are outer + inner layers, rotations turn every layer', () => {
    const s = e.applyAll(e.solved(), ['R', 'U'])
    if (n >= 3) expect(equal(e.apply(s, 'Rw'), e.applyAll(s, ['R', '2R']))).toBe(true)
    const all = ['R', ...Array.from({ length: n - 2 }, (_, i) => `${i + 2}R`), "L'"]
    expect(equal(e.apply(s, 'x'), e.applyAll(s, all))).toBe(true)
    expect(isSolvedState(e.applyAll(e.solved(), ['x', 'y', "z'"]), n)).toBe(true)
  })

  it('keeps n² stickers of each color and undoes random sequences', () => {
    const r = rng(n)
    for (let t = 0; t < 20; t += 1) {
      const seq = Array.from({ length: 30 }, () => moves[Math.floor(r() * moves.length)] as string)
      const s = e.applyAll(e.solved(), seq)
      for (let c = 0; c < 6; c += 1) expect(s.filter((v) => v === c).length).toBe(n * n)
      expect(isSolvedState(e.applyAll(s, invertSequence(seq)), n)).toBe(true)
    }
  })
})

describe('3x3 engine agrees with the cubie model', () => {
  it('matches core facelets for random face-turn sequences', () => {
    const e = getEngine(3)
    const r = rng(42)
    for (let t = 0; t < 50; t += 1) {
      const seq = Array.from({ length: 25 }, () => MOVES[Math.floor(r() * MOVES.length)] as Move)
      const s = e.applyAll(e.solved(), seq)
      const letters = [...s].map((v) => FACE_ORDER[v]).join('')
      expect(letters).toBe(toFacelets(applyMoves(SOLVED, seq)))
    }
  })

  it('parses booklet notation: lowercase = wide, MR = second layer', () => {
    const e = getEngine(4)
    const s = e.applyAll(e.solved(), ['R', 'U'])
    expect(equal(e.apply(s, 'r'), e.apply(s, 'Rw'))).toBe(true)
    expect(equal(e.apply(s, 'MR2'), e.apply(s, '2R2'))).toBe(true)
    expect(splitMoves(" R  U2 r' ")).toEqual(['R', 'U2', "r'"])
    expect(() => e.apply(s, '5R')).toThrow()
  })
})
