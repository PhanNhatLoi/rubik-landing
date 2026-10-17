import { describe, expect, it } from 'vitest'
import { edgeDone, firstLayerDone } from './goals'
import { applyMoves, SOLVED } from '../smart-solver/core/cubie'
import { MIDDLE_EXAMPLES, MIDDLE_FORMULAS } from './copy/lesson4'
import { buildMiddleGuide } from './guide/middleGuide'

describe('lesson 4 formulas', () => {
  it('each formula slides one middle edge into its slot and keeps the first layer', () => {
    expect(MIDDLE_FORMULAS.map((f) => f.moves.length)).toEqual([8, 8])
    for (const f of MIDDLE_FORMULAS) {
      expect(firstLayerDone(f.before)).toBe(true)
      expect(edgeDone(f.before, f.edgePiece)).toBe(false)
      expect(firstLayerDone(f.after)).toBe(true)
      expect(edgeDone(f.after, f.edgePiece)).toBe(true)
    }
    expect(MIDDLE_FORMULAS.map((f) => f.moves.join(' '))).toEqual(["D L D' L' D' F' D F", "D' R' D R D F D' F'"])
  })
})

describe('compactHalfTurns', () => {
  it('merges equal D quarter turns without touching other moves', async () => {
    const { compactHalfTurns } = await import('./guide/lastFaceGuide')
    expect(compactHalfTurns(['B', "D'", "D'", 'B', 'D', 'B', 'F', 'D', 'D', "F'", "D'", 'F'])).toBe("B D2' B D B F D2 F' D' F")
    expect(compactHalfTurns(['D', "D'"])).toBe("D D'")
  })
})

describe('lesson 4 worked examples', () => {
  it('are fixed cubes whose guide matches the kind they illustrate', () => {
    const names = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }
    const guides = MIDDLE_EXAMPLES.map((e) => buildMiddleGuide(applyMoves(SOLVED, e.scramble), names)!)
    expect(guides.map((g) => g.kind)).toEqual(['top', 'wrong'])
    expect(guides[0]!.steps.map((x) => x.notation)).toEqual(['D2', "D'", "R'", 'D', 'R', 'D', 'F', "D'", "F'"])
  })

  it('the extra example first lowers the wrong middle edge to D while preserving the first layer and correct edges', () => {
    const names = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }
    const before = applyMoves(SOLVED, MIDDLE_EXAMPLES[1].scramble)
    const guide = buildMiddleGuide(before, names)!
    const placed = [8, 9, 10, 11].filter((piece) => edgeDone(before, piece))
    expect(guide.kind).toBe('wrong')
    const formula = MIDDLE_FORMULAS[1]!
    expect(before.ep.indexOf(formula.edgePiece)).toBe(8)
    expect(edgeDone(before, formula.edgePiece)).toBe(false)
    const after = applyMoves(before, formula.moves)
    expect(after.ep.indexOf(formula.edgePiece)).toBeGreaterThanOrEqual(4)
    expect(after.ep.indexOf(formula.edgePiece)).toBeLessThanOrEqual(7)
    expect(firstLayerDone(after)).toBe(true)
    for (const piece of placed) expect(edgeDone(after, piece)).toBe(true)
    expect(edgeDone(guide.states.at(-1)!, guide.piece)).toBe(true)
  })
})
