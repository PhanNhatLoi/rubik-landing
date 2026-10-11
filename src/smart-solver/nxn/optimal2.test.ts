import { describe, expect, it } from 'vitest'
import { MOVES, SOLVED, applyMoves, type Move } from '../core'
import { solved2x2 } from './beginner'
import { distanceHistogram, solveOptimal2 } from './optimal2'

describe('2x2 optimal solver', () => {
  it('matches the published half-turn distance distribution of the 2x2 (God\'s number 11)', () => {
    // Positions at distance 0..11 (HTM), e.g. https://www.jaapsch.net/puzzles/cube2.htm
    expect(distanceHistogram()).toEqual([1, 9, 54, 321, 1847, 9992, 50136, 227536, 870072, 1887748, 623800, 2644])
  })

  it('solves random states optimally (never longer than the scramble)', () => {
    let s = 7
    const URF = MOVES.filter((m) => /^[URF]/.test(m))
    for (let t = 0; t < 100; t += 1) {
      const len = 1 + (t % 14)
      const scr = Array.from({ length: len }, () => {
        s = (s * 1103515245 + 12345) % 2147483648
        return URF[Math.floor((s / 2147483648) * URF.length)] as Move
      })
      const start = applyMoves(SOLVED, scr)
      const sol = solveOptimal2(start)
      expect(solved2x2(applyMoves(start, sol))).toBe(true)
      expect(sol.length).toBeLessThanOrEqual(Math.min(len, 11))
    }
  })
})
