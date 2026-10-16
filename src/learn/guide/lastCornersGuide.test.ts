import { describe, expect, it } from 'vitest'
import { applyMoves, equals, parseAlgorithm, SOLVED } from '../../smart-solver/core/cubie'
import { CORNER_COLORS, fromFacelets, toFacelets } from '../../smart-solver/core/facelets'
import { lastEdgesDone } from './lastEdgesGuide'
import { LAST_CORNERS_LEFT, LAST_CORNERS_RIGHT, LAST_CORNERS_VARIANTS, buildLastCornersGuide, correctLastCorners, lastCornerClue, lastCornersChoices, lastCornersPositionDone } from './lastCornersGuide'
import { generateLastCornersScramble, LAST_CORNERS_COMBINATIONS } from '../copy/lesson7'
import { locateOnGuide } from './follow'
import { applyNotation, fromCubie, toCubie } from './physical'
const NAMES = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }

describe('lesson 7 user corner-position formula', () => {
  it('exhausts all 24 corner permutations and admits only 0, 1 or 4 correct positions after lesson 6', () => {
    const permutations = (xs: number[]): number[][] => xs.length ? xs.flatMap((x) => permutations(xs.filter((y) => y !== x)).map((p) => [x, ...p])) : [[]]
    const all = permutations([4, 5, 6, 7])
    const valid = new Map<number, number>()
    const invalid = new Map<number, number>()
    expect(all).toHaveLength(24)
    for (const p of all) {
      const state = { ...SOLVED, cp: [...SOLVED.cp.slice(0, 4), ...p] }
      const parsed = fromFacelets(toFacelets(state))
      const count = correctLastCorners(state).length
      const counts = parsed.ok ? valid : invalid
      counts.set(count, (counts.get(count) ?? 0) + 1)
      if (!parsed.ok) expect(parsed.errors).toEqual([{ kind: 'parity' }])
    }
    expect(Object.fromEntries(valid)).toEqual({ 0: 3, 1: 8, 4: 1 })
    expect(Object.fromEntries(invalid)).toEqual({ 0: 6, 2: 6 })
    expect(valid.has(3)).toBe(false)
  })
  it('replays the log, keeps FR and cycles FL to BL to BR; its mirror keeps FL', () => {
    expect(LAST_CORNERS_RIGHT).toEqual(parseAlgorithm("R' L D' R D L' D' R' D R"))
    const right = applyMoves(SOLVED, LAST_CORNERS_RIGHT)
    expect(toFacelets(right)).toBe('UUUUUUUUURRRRRRRRBFFFFFFDFFRDDDDDFDDLLLLLLLLBBBBBBBLBD')
    expect(right.cp.slice(4)).toEqual([4, 7, 5, 6])
    const left = applyMoves(SOLVED, LAST_CORNERS_LEFT)
    expect(left.cp.slice(4)).toEqual([6, 5, 7, 4])
    for (const v of LAST_CORNERS_VARIANTS) {
      const end = applyMoves(SOLVED, v.moves)
      expect(lastEdgesDone(end)).toBe(true)
      expect(end.cp[v.anchor]).toBe(v.anchor)
      for (let i = 0; i < 3; i += 1) expect(end.cp[v.cycle[(i + 1) % 3]!]).toBe(v.cycle[i])
    }
  })

  it('uses the two-common-color neighbor independently of all 27 legal corner orientations', () => {
    expect(LAST_CORNERS_COMBINATIONS).toHaveLength(12)
    const counts = LAST_CORNERS_COMBINATIONS.map((c) => correctLastCorners(c.state).length)
    expect(counts.filter((n) => n === 4)).toHaveLength(1)
    expect(counts.filter((n) => n === 1)).toHaveLength(8)
    expect(counts.filter((n) => n === 0)).toHaveLength(3)
    for (const c of LAST_CORNERS_COMBINATIONS) for (let a = 0; a < 3; a += 1) for (let b = 0; b < 3; b += 1) for (let d = 0; d < 3; d += 1) {
      const state = { ...c.state, co: [0, 0, 0, 0, a, b, d, (9 - a - b - d) % 3] }
      expect(fromFacelets(toFacelets(state)).ok).toBe(true)
      const clue = lastCornerClue(state)
      if (correctLastCorners(state).length === 1) {
        expect(clue).not.toBeNull()
        expect(clue!.shared).toHaveLength(2)
        expect(clue!.shared).toContain('D')
        expect(lastCornersChoices(state)).toHaveLength(1)
        const guide = buildLastCornersGuide(state, NAMES)!
        const destination = applyMoves(SOLVED, guide.variant.moves).cp.indexOf(clue!.neighbor)
        expect(destination).toBe(clue!.destination)
        expect(CORNER_COLORS[state.cp[clue!.neighbor]!]!.includes('D')).toBe(true)
      }
      for (const choice of lastCornersChoices(state)) {
        const guide = buildLastCornersGuide(state, NAMES, choice.id)!
        expect(guide.variant.id).toBe(choice.id)
        const end = guide.states.at(-1)!
        expect(lastEdgesDone(end)).toBe(true)
        expect(end.cp[choice.anchor]).toBe(state.cp[choice.anchor])
        expect(end.co[choice.anchor]).toBe(state.co[choice.anchor])
        if (guide.kind === 'cycle') expect(lastCornersPositionDone(end)).toBe(true)
        else {
          expect(correctLastCorners(end)).toHaveLength(1)
          const final = buildLastCornersGuide(end, NAMES)!
          expect(lastCornersPositionDone(final.states.at(-1)!)).toBe(true)
        }
      }
    }
  })

  it('replays every physical step, pauses for a wrong turn and resumes after undo', () => {
    for (const c of LAST_CORNERS_COMBINATIONS.filter((c) => c.kind !== 'done')) {
      const guide = buildLastCornersGuide(c.state, NAMES)!
      let physical = fromCubie(c.state)
      for (let i = 0; i < guide.steps.length; i += 1) {
        expect(locateOnGuide(guide, guide.states[i]!)).toEqual({ kind: 'step', index: i, quarterDone: false })
        physical = applyNotation(physical, guide.steps[i]!.notation)
        expect(equals(toCubie(physical)!, guide.states[i + 1]!)).toBe(true)
      }
      expect(locateOnGuide(guide, guide.states.at(-1)!)).toEqual({ kind: 'done' })
      expect(locateOnGuide(guide, applyMoves(c.state, ['U']))).toEqual({ kind: 'off' })
      expect(locateOnGuide(guide, c.state)).toEqual({ kind: 'step', index: 0, quarterDone: false })
    }
  })

  it('loads each corner combination with solved edges and fresh legal orientations', () => {
    for (let i = 0; i < LAST_CORNERS_COMBINATIONS.length; i += 1) {
      let prev: ReturnType<typeof generateLastCornersScramble> | undefined
      for (let n = 0; n < 10; n += 1) {
        const setup = generateLastCornersScramble(i, () => n / 10, prev)
        const state = applyMoves(SOLVED, setup)
        expect(state.cp).toEqual(LAST_CORNERS_COMBINATIONS[i]!.state.cp)
        expect(lastEdgesDone(state)).toBe(true)
        expect(fromFacelets(toFacelets(state)).ok).toBe(true)
        if (prev) expect(equals(state, applyMoves(SOLVED, prev))).toBe(false)
        prev = setup
      }
    }
    expect(buildLastCornersGuide(applyMoves(SOLVED, ['D']), NAMES)).toBeNull()
    expect(buildLastCornersGuide(SOLVED, NAMES)).toBeNull()
    const twisted = { ...SOLVED, co: [0, 0, 0, 0, 1, 2, 0, 0] }
    expect(lastCornersPositionDone(twisted)).toBe(true)
  })
})
