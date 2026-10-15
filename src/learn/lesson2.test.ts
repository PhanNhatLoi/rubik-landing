import { describe, expect, it } from 'vitest'
import { applyMoves, SOLVED } from '../smart-solver/core/cubie'
import { CROSS, edgeDone } from '../smart-solver/nxn/beginner'
import { CROSS_LEVELS, CROSS_PICTURE_SCRAMBLE, generateCrossScramble } from './copy/lesson2'
import { crossEdgeCells, edgeCell } from './cells'

describe('lesson 2', () => {
  it('places edge slots on the grid', () => {
    expect(edgeCell(5)).toEqual([1, 0, 2]) // DF
    expect(edgeCell(8)).toEqual([2, 1, 2]) // FR
    expect(crossEdgeCells(SOLVED).map((c) => c[1])).toEqual([0, 0, 0, 0])
  })

  it('the picture scramble moves every cross edge off the bottom layer', () => {
    const state = applyMoves(SOLVED, CROSS_PICTURE_SCRAMBLE)
    expect(CROSS.some((e) => edgeDone(state, e))).toBe(false)
    expect(crossEdgeCells(state).every((c) => c[1] !== 0)).toBe(true)
  })

  const seeded = (seed: number) => () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 2 ** 32
  }

  it('random scrambles keep their level: 3, 2 and 0 cross edges in place', () => {
    const expected = { easy: 3, medium: 2, hard: 0 }
    for (const level of CROSS_LEVELS) {
      for (let i = 1; i <= 40; i += 1) {
        const moves = generateCrossScramble(level.id, seeded(i))
        const state = applyMoves(SOLVED, moves)
        expect(CROSS.filter((e) => edgeDone(state, e)).length).toBe(expected[level.id])
      }
    }
  })

  it('scrambles differ between draws and from the one to avoid', () => {
    const first = generateCrossScramble('hard', seeded(1))
    const again = generateCrossScramble('hard', seeded(1), first)
    expect(again.join(' ')).not.toBe(first.join(' '))
    const seen = new Set(Array.from({ length: 20 }, (_, i) => generateCrossScramble('medium', seeded(i + 100)).join(' ')))
    expect(seen.size).toBeGreaterThan(5)
  })
})
