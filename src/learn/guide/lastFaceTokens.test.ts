import { describe, expect, it } from 'vitest'
import { compactHalfTurns, formulaTokens, LAST_FACE_VARIANTS } from './lastFaceGuide'

describe('formulaTokens', () => {
  it('reads equal D quarter-turn pairs as one half turn and keeps every step covered once', () => {
    for (const variant of LAST_FACE_VARIANTS) {
      const tokens = formulaTokens(variant.moves)
      expect(tokens).toHaveLength(14)
      expect(tokens.flatMap((t) => (t.to > t.from ? [t.from, t.to] : [t.from]))).toEqual(variant.moves.map((_, i) => i))
      expect(tokens.filter((t) => t.to > t.from).map((t) => t.token).sort()).toEqual(['D2', "D2'"])
      // A half turn never straddles the middle of the two halves.
      expect(tokens.every((t) => t.to < 8 || t.from >= 8)).toBe(true)
    }
    expect(compactHalfTurns(['D', "D'"])).toBe("D D'")
  })
})
