import { describe, expect, it } from 'vitest'
import { edgeDone, firstLayerDone } from './goals'
import { MIDDLE_FORMULAS } from './copy/lesson4'

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
