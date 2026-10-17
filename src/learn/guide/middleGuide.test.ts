import { describe, expect, it } from 'vitest'
import { applyMoves, equals, SOLVED } from '../../smart-solver/core/cubie'
import { layerTurnToEvent, readOrientation } from '../../smart-solver/adapter/stickerModel'
import { MIDDLE, edgeDone, firstLayerDone } from '../goals'
import { generateMiddleScramble, MIDDLE_PICTURE_SCRAMBLE } from '../copy/lesson4'
import { buildMiddleGuide, type MiddleCase } from './middleGuide'
import { applyNotation, fromCubie, notationToTurn } from './physical'

const NAMES = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }

function rng(seed: number) {
  let s = seed
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return (s >>> 8) / 2 ** 24
  }
}

describe('buildMiddleGuide', () => {
  it('puts one more middle edge in place without breaking the first layer or placed edges', () => {
    const r = rng(3)
    const kinds = new Set<MiddleCase>()
    let guides = 0
    for (let i = 0; i < 300; i += 1) {
      const level = (['easy', 'medium', 'hard'] as const)[i % 3]!
      let state = applyMoves(SOLVED, generateMiddleScramble(level, r))
      // Sometimes the learner has already made a move or two on top.
      if (i % 4 === 0) state = applyMoves(state, ['D'])
      expect(firstLayerDone(state)).toBe(true)
      const guide = buildMiddleGuide(state, NAMES)
      const todo = MIDDLE.filter((e) => !edgeDone(state, e))
      if (!todo.length) {
        expect(guide).toBeNull()
        continue
      }
      expect(guide).not.toBeNull()
      guides += 1
      kinds.add(guide!.kind)
      const placed = MIDDLE.filter((e) => edgeDone(state, e))
      let physical = fromCubie(state)
      let tracked = state
      guide!.steps.forEach((step, k) => {
        const o = readOrientation(physical, (s) => s)!
        tracked = applyMoves(tracked, layerTurnToEvent(notationToTurn(step.notation), o)!.moves)
        physical = applyNotation(physical, step.notation)
        expect(equals(tracked, guide!.states[k + 1]!)).toBe(true)
        expect(step.why.length).toBeGreaterThan(10)
        expect(guide!.marks[k]!.length).toBe(3)
        if (step.notation.endsWith('2')) expect(guide!.halves[k]!.length).toBe(2)
      })
      const end = guide!.states[guide!.states.length - 1]!
      expect(edgeDone(end, guide!.piece)).toBe(true)
      expect(firstLayerDone(end)).toBe(true)
      for (const e of placed) expect(edgeDone(end, e)).toBe(true)
      expect(guide!.steps.length).toBeLessThanOrEqual(20)
    }
    expect(guides).toBeGreaterThan(200)
    expect([...kinds].sort()).toEqual(['top', 'wrong'])
  })

  it('the picture leaves all four middle edges out of place with the first layer done', () => {
    const state = applyMoves(SOLVED, MIDDLE_PICTURE_SCRAMBLE)
    expect(firstLayerDone(state)).toBe(true)
    expect(MIDDLE.filter((e) => edgeDone(state, e)).length).toBe(0)
  })

  it('needs the first layer first', () => {
    expect(buildMiddleGuide(applyMoves(SOLVED, ['F']), NAMES)).toBeNull()
  })
})
