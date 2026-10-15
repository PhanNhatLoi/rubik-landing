import { describe, expect, it } from 'vitest'
import { applyMoves, equals, parseAlgorithm, SOLVED } from '../../smart-solver/core/cubie'
import { layerTurnToEvent, readOrientation } from '../../smart-solver/adapter/stickerModel'
import { D_CORNERS, cornerDone, crossDone } from '../../smart-solver/nxn/beginner'
import { bottomCornerCells, cornerCell } from '../cells'
import { buildCornerGuide, type CornerCase } from './cornerGuide'
import { applyNotation, findCorner, fromCubie, notationToTurn } from './physical'
import { CORNER_COLORS } from '../../smart-solver/core/facelets'
import { generateCornerScramble } from '../copy/lesson3'

const NAMES = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }

function rng(seed: number) {
  let s = seed
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return (s >>> 8) / 2 ** 24
  }
}

describe('corner cells', () => {
  it('slot cells match where the physical cube puts each corner', () => {
    const p = fromCubie(SOLVED)
    for (const piece of D_CORNERS) {
      const c = findCorner(p, CORNER_COLORS[piece]!)!
      expect([c.grid.x, c.grid.y, c.grid.z]).toEqual(cornerCell(piece))
    }
    expect(bottomCornerCells(SOLVED).map((c) => c[1])).toEqual([0, 0, 0, 0])
  })
})

describe('buildCornerGuide', () => {
  it('puts one more corner in place without breaking the cross or placed corners, tracking like the app', () => {
    const r = rng(5)
    const kinds = new Set<CornerCase>()
    let guides = 0
    for (let i = 0; i < 500; i += 1) {
      const level = (['easy', 'medium', 'hard'] as const)[i % 3]!
      const state = applyMoves(SOLVED, generateCornerScramble(level, r))
      expect(crossDone(state)).toBe(true)
      const guide = buildCornerGuide(state, NAMES)
      const todo = D_CORNERS.filter((c) => !cornerDone(state, c))
      if (!todo.length) {
        expect(guide).toBeNull()
        continue
      }
      expect(guide).not.toBeNull()
      guides += 1
      kinds.add(guide!.kind)
      const placed = D_CORNERS.filter((c) => cornerDone(state, c))
      let physical = fromCubie(state)
      let tracked = state
      guide!.steps.forEach((step, k) => {
        const o = readOrientation(physical, (s) => s)!
        tracked = applyMoves(tracked, layerTurnToEvent(notationToTurn(step.notation), o)!.moves)
        physical = applyNotation(physical, step.notation)
        expect(equals(tracked, guide!.states[k + 1]!)).toBe(true)
        expect(step.why.length).toBeGreaterThan(10)
        if (step.notation.endsWith('2')) expect(guide!.halves[k]!.length).toBe(2)
      })
      const end = guide!.states[guide!.states.length - 1]!
      expect(cornerDone(end, guide!.piece)).toBe(true)
      expect(crossDone(end)).toBe(true)
      for (const c of placed) expect(cornerDone(end, c)).toBe(true)
      expect(guide!.steps.length).toBeLessThanOrEqual(10)
    }
    expect(guides).toBeGreaterThan(300)
    expect([...kinds].sort()).toEqual(['bottom', 'flip', 'top'])
  })

  it('needs the cross first', () => {
    expect(buildCornerGuide(applyMoves(SOLVED, parseAlgorithm('F R U')), NAMES)).toBeNull()
  })
})
