import { expect, it } from 'vitest'
import { applyMoves, parseAlgorithm, SOLVED } from '../../smart-solver/core/cubie'
import { fromFacelets, toFacelets } from '../../smart-solver/core/facelets'
import type { CubieState, Move } from '../../smart-solver/core/types'
import { f2lDone, topCrossDone } from '../goals'

const RIGHT = parseAlgorithm("R' D2 R D R' D R")
const LEFT = parseAlgorithm("L D2 L' D' L D' L'")
const PREFIXES: Move[][] = [[], ['D'], ["D'"], ['D2']]
const SIDES = ['F', 'R', 'B', 'L']
const variants = [RIGHT, LEFT].flatMap((alg) => SIDES.map((_, yaw) => alg.map((m) => {
  const index = SIDES.indexOf(m[0]!)
  return (index < 0 ? m : SIDES[(index + yaw) % 4]! + m.slice(1)) as Move
})))
const correct = (s: CubieState) => [4, 5, 6, 7].filter((i) => s.ep[i] === i).length
const aligned = (s: CubieState) => PREFIXES.map((p) => applyMoves(s, p))
const permutations = (xs: number[]): number[][] => xs.length ? xs.flatMap((x) => permutations(xs.filter((y) => y !== x)).map((p) => [x, ...p])) : [[]]

it('keeps F, cycles R to L to B, and preserves the upper layers and yellow cross', () => {
  const right = applyMoves(SOLVED, RIGHT)
  const left = applyMoves(SOLVED, LEFT)
  expect(right.ep.slice(4, 8)).toEqual([7, 5, 4, 6])
  expect(left.ep.slice(4, 8)).toEqual([6, 5, 7, 4])
  expect(toFacelets(right)).toBe('UUUUUUUUURRRRRRBBDFFFFFFBFDDDLDDDRDFLLLLLLFRRBBBBBBLLD')
  for (const s of [right, left]) {
    expect(f2lDone(s)).toBe(true)
    expect(topCrossDone(s)).toBe(true)
  }
})

it('solves all 24 edge permutations in at most two formula rounds using the matching-edge tip', () => {
  let preparatoryCases = 0
  for (const p of permutations([4, 5, 6, 7])) {
    const inversions = p.reduce((n, x, i) => n + p.slice(i + 1).filter((y) => x > y).length, 0)
    let state: CubieState = { ...SOLVED, cp: inversions % 2 ? [0, 1, 2, 3, 5, 4, 6, 7] : [...SOLVED.cp], ep: [...SOLVED.ep.slice(0, 4), ...p, ...SOLVED.ep.slice(8)] }
    expect(fromFacelets(toFacelets(state)).ok).toBe(true)
    let options = aligned(state)
    if (options.some((s) => correct(s) === 4)) continue
    if (!options.some((s) => correct(s) === 1)) {
      // Only two opposite matching edges can occur here, regardless of D alignment.
      expect(options.map(correct).sort()).toEqual([0, 0, 2, 2])
      state = applyMoves(state, RIGHT)
      expect(f2lDone(state)).toBe(true)
      expect(topCrossDone(state)).toBe(true)
      options = aligned(state)
      preparatoryCases += 1
    }
    const oneMatch = options.find((s) => correct(s) === 1)
    expect(oneMatch).toBeDefined()
    const solved = variants.map((alg) => applyMoves(oneMatch!, alg)).find((s) => correct(s) === 4)
    expect(solved).toBeDefined()
    expect(f2lDone(solved!)).toBe(true)
    expect(topCrossDone(solved!)).toBe(true)
  }
  expect(preparatoryCases).toBe(4)
})
