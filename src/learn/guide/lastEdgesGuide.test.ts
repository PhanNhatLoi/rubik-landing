import { describe, expect, it } from 'vitest'
import { applyMoves, equals, SOLVED } from '../../smart-solver/core/cubie'
import type { CubieState } from '../../smart-solver/core/types'
import { fromFacelets, toFacelets } from '../../smart-solver/core/facelets'
import { f2lDone, topCrossDone } from '../goals'
import { generateLastEdgesScramble, lastEdgesLevel, LAST_EDGES_LEVELS, LAST_EDGES_EXCHANGE_PICTURE, LAST_EDGES_FORMULA_PICTURES } from '../copy/lesson6'
import { CURRICULUM_STAGES } from '../curriculum'
import { buildLastEdgesGuide, lastEdgesCycleOptions, lastEdgesDone, matchingLastEdges, LAST_EDGES_LEFT, LAST_EDGES_RIGHT, LAST_EDGES_VARIANTS } from './lastEdgesGuide'
import { applyNotation, fromCubie, toCubie } from './physical'
import { locateOnGuide } from './follow'

const NAMES = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }
function random(seed: number) {
  let s = seed
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32 }
}
const permutations = (xs: number[]): number[][] => xs.length ? xs.flatMap((x) => permutations(xs.filter((y) => y !== x)).map((p) => [x, ...p])) : [[]]

describe('lesson 6 last-edge guide', () => {
  it('requires D alignment, then the matching anchor and correct direction for adjacent pairs', () => {
    let adjacentCases = 0
    for (const p of permutations([4, 5, 6, 7])) {
      const state: CubieState = { ...SOLVED, ep: [...SOLVED.ep.slice(0, 4), ...p, ...SOLVED.ep.slice(8)], cp: [0, 1, 2, 3, 5, 4, 6, 7] }
      if (lastEdgesLevel(state) !== 'medium') continue
      adjacentCases += 1
      // Keeping any front and immediately applying one formula cannot solve the initial pair.
      for (const v of LAST_EDGES_VARIANTS) expect(lastEdgesDone(applyMoves(state, v.moves))).toBe(false)
      const options = lastEdgesCycleOptions(state)
      expect(options).toHaveLength(2)
      for (const option of options) {
        expect(option.alignment).toHaveLength(1)
        expect(equals(option.state, applyMoves(state, option.alignment))).toBe(true)
        expect(matchingLastEdges(option.state)).toEqual([option.variant.anchor])
        expect(lastEdgesDone(applyMoves(state, [...option.alignment, ...option.variant.moves]))).toBe(true)
      }
      const guide = buildLastEdgesGuide(state, NAMES)!
      expect(guide.alignmentSteps).toBe(1)
      expect(guide.front).toBe(options[0]!.variant.front)
      expect(guide.direction).toBe(options[0]!.variant.direction)
      expect(guide.steps[0]!.why).toContain('chưa bắt đầu công thức')
    }
    expect(adjacentCases).toBe(4)
  })
  it('illustrates real edge exchanges without presenting a fully solved cube', () => {
    const picture = LAST_EDGES_EXCHANGE_PICTURE
    expect(equals(picture.after, applyMoves(picture.before, picture.moves))).toBe(true)
    expect(picture.after.ep[5]).toBe(picture.before.ep[5])
    for (const i of [4, 6, 7]) expect(picture.after.ep[i]).not.toBe(picture.before.ep[i])
    expect(lastEdgesDone(picture.after)).toBe(false)
    for (const example of [picture, ...LAST_EDGES_FORMULA_PICTURES]) {
      expect(equals(example.after, applyMoves(example.before, example.moves))).toBe(true)
      expect(equals(example.after, SOLVED)).toBe(false)
      expect(topCrossDone(example.before)).toBe(true)
      expect(topCrossDone(example.after)).toBe(true)
    }
    for (const example of LAST_EDGES_FORMULA_PICTURES) {
      expect(lastEdgesDone(example.before)).toBe(false)
      expect(lastEdgesDone(example.after)).toBe(true)
      expect(example.before.ep[5]).toBe(5)
      expect(example.after.ep[5]).toBe(5)
    }
  })
  it('solves every edge permutation with at most two formula rounds and replays every physical step', () => {
    const fronts = new Set<string>()
    const directions = new Set<string>()
    const kinds = new Set<string>()
    for (const p of permutations([4, 5, 6, 7])) {
      const parity = p.reduce((n, x, i) => n + p.slice(i + 1).filter((y) => x > y).length, 0) % 2
      let state: CubieState = { ...SOLVED, ep: [...SOLVED.ep.slice(0, 4), ...p, ...SOLVED.ep.slice(8)], cp: parity ? [0, 1, 2, 3, 5, 4, 6, 7] : SOLVED.cp }
      expect(fromFacelets(toFacelets(state)).ok).toBe(true)
      for (let round = 0; round < 2 && !lastEdgesDone(state); round += 1) {
        const guide = buildLastEdgesGuide(state, NAMES)
        expect(guide).not.toBeNull()
        if (!guide) throw new Error('Missing guide')
        kinds.add(guide.kind)
        if (guide.front) fronts.add(guide.front)
        if (guide.direction) directions.add(guide.direction)
        if (guide.front) {
          const v = LAST_EDGES_VARIANTS.find((v) => v.front === guide.front && v.direction === guide.direction)!
          expect(guide.steps.slice(-v.moves.length).map((s) => s.notation)).toEqual(v.moves)
          if (guide.kind === 'cycle') expect(guide.states[guide.steps.length - v.moves.length]!.ep[v.anchor]).toBe(v.anchor)
        }
        let physical = fromCubie(state)
        for (let i = 0; i < guide.steps.length; i += 1) {
          const step = guide.steps[i]!
          expect(locateOnGuide(guide, guide.states[i]!)).toEqual({ kind: 'step', index: i, quarterDone: false })
          if (step.notation.endsWith('2')) {
            expect(guide.halves[i]).toHaveLength(2)
            for (const half of guide.halves[i]!) expect(locateOnGuide(guide, half)).toEqual({ kind: 'step', index: i, quarterDone: true })
          }
          physical = applyNotation(physical, step.notation)
          expect(equals(toCubie(physical)!, guide.states[i + 1]!)).toBe(true)
        }
        expect(locateOnGuide(guide, applyMoves(guide.states[0]!, ['U']))).toEqual({ kind: 'off' })
        state = guide.states.at(-1)!
        expect(locateOnGuide(guide, state)).toEqual({ kind: 'done' })
        expect(f2lDone(state)).toBe(true)
        expect(topCrossDone(state)).toBe(true)
        if (guide.kind !== 'prepare') expect(lastEdgesDone(state)).toBe(true)
      }
      expect(lastEdgesDone(state)).toBe(true)
    }
    expect([...fronts].sort()).toEqual(['B', 'F', 'L', 'R'])
    expect([...directions].sort()).toEqual(['left', 'right'])
    expect([...kinds].sort()).toEqual(['align', 'cycle', 'prepare'])
  })

  it('randomizes each level without losing the two upper layers or the yellow cross', () => {
    const rng = random(917)
    for (const level of LAST_EDGES_LEVELS) {
      let previous = generateLastEdgesScramble(level.id, rng)
      for (let i = 0; i < 100; i += 1) {
        const setup = generateLastEdgesScramble(level.id, rng, previous)
        let state = applyMoves(SOLVED, setup)
        expect(equals(state, applyMoves(SOLVED, previous))).toBe(false)
        expect(lastEdgesLevel(state)).toBe(level.id)
        expect(topCrossDone(state)).toBe(true)
        let formulas = 0
        for (let j = 0; j < 2 && !lastEdgesDone(state); j += 1) {
          const guide = buildLastEdgesGuide(state, NAMES)!
          expect(guide).not.toBeNull()
          if (guide.kind !== 'align') formulas += 1
          state = guide.states.at(-1)!
        }
        expect(lastEdgesDone(state)).toBe(true)
        expect(formulas).toBe(level.id === 'hard' ? 2 : 1)
        previous = setup
      }
    }
  })

  it('rejects missing prerequisites and distinguishes edge completion from a solved cube', () => {
    expect(buildLastEdgesGuide(applyMoves(SOLVED, ['R']), NAMES)).toBeNull()
    expect(buildLastEdgesGuide(SOLVED, NAMES)).toBeNull()
    const cornersUnfinished = applyMoves(SOLVED, [...LAST_EDGES_RIGHT, ...LAST_EDGES_LEFT])
    expect(lastEdgesDone(cornersUnfinished)).toBe(true)
    expect(equals(cornersUnfinished, SOLVED)).toBe(false)
    expect(CURRICULUM_STAGES.map((s) => s.id)).toEqual(['cross', 'corners', 'middle', 'topCross', 'topEdges', 'topCorners', 'topFace'])
    expect(CURRICULUM_STAGES[4]!.isDone(cornersUnfinished)).toBe(true)
    expect(CURRICULUM_STAGES[6]!.isDone(cornersUnfinished)).toBe(false)
    for (let i = 1; i < CURRICULUM_STAGES.length; i += 1) expect(CURRICULUM_STAGES[i]!.prerequisite).toBe(CURRICULUM_STAGES[i - 1]!.id)
  })
})
