import { describe, expect, it } from 'vitest'
import { MOVES, SOLVED, applyMoves, isSolved, type Move } from '../core'
import { solveBeginner2, solveBeginner3, solved2x2 } from './beginner'

function scramble(seed: number, length: number, moves: readonly Move[] = MOVES): Move[] {
  let s = seed
  return Array.from({ length }, () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return moves[Math.floor((s / 2147483648) * moves.length)] as Move
  })
}

const stats = (xs: number[]) => {
  const sorted = [...xs].sort((a, b) => a - b)
  return `avg ${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)}, median ${sorted[xs.length >> 1]?.toFixed(0)}, max ${sorted[xs.length - 1]?.toFixed(0)}`
}

describe('3x3 beginner method', () => {
  it('solves 100 random scrambles of varying depth', () => {
    const lengths: number[] = []
    const times: number[] = []
    const used = new Map<string, number>()
    for (let seed = 1; seed <= 100; seed += 1) {
      const start = applyMoves(SOLVED, scramble(seed, 5 + (seed % 26)))
      const t0 = performance.now()
      const steps = solveBeginner3(start)
      times.push(performance.now() - t0)
      const moves = steps.flatMap((s) => s.moves)
      expect(isSolved(applyMoves(start, moves)), `seed ${seed}`).toBe(true)
      lengths.push(moves.length)
      steps.forEach((s) => s.algorithms.forEach((a) => used.set(a, (used.get(a) ?? 0) + 1)))
    }
    console.log(`[bench] 3x3 beginner: moves ${stats(lengths)}; ms ${stats(times)}`)
    console.log(`[bench] algorithms used: ${[...used.entries()].map(([k, v]) => `${k}×${v}`).join(', ')}`)
  }, 120000)

  it('returns no steps for a solved cube', () => {
    expect(solveBeginner3(SOLVED)).toEqual([])
  })
})

describe('2x2 beginner method', () => {
  // A 2x2 is the corners of a 3x3; U, R, F turns keep the DBL corner as the reference.
  const URF = MOVES.filter((m) => /^[URF]/.test(m))
  it('solves 100 random scrambles', () => {
    const lengths: number[] = []
    const times: number[] = []
    const used = new Map<string, number>()
    for (let seed = 1; seed <= 100; seed += 1) {
      const start = applyMoves(SOLVED, scramble(seed, 4 + (seed % 16), URF))
      const t0 = performance.now()
      const steps = solveBeginner2(start)
      times.push(performance.now() - t0)
      const moves = steps.flatMap((s) => s.moves)
      expect(solved2x2(applyMoves(start, moves)), `seed ${seed}`).toBe(true)
      lengths.push(moves.length)
      steps.forEach((s) => s.algorithms.forEach((a) => used.set(a, (used.get(a) ?? 0) + 1)))
    }
    console.log(`[bench] 2x2 beginner: moves ${stats(lengths)}; ms ${stats(times)}`)
    console.log(`[bench] algorithms used: ${[...used.entries()].map(([k, v]) => `${k}×${v}`).join(', ')}`)
  }, 120000)
})
