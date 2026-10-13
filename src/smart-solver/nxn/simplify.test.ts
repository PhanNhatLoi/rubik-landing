import { describe, expect, it } from 'vitest'
import { simplifyMoves } from './simplify'

describe('simplifyMoves', () => {
  it('cancels a turn followed by its inverse', () => {
    expect(simplifyMoves(['U', "U'"])).toEqual([])
    expect(simplifyMoves(['F', 'R', "R'", "F'"])).toEqual([])
  })

  it('merges repeated turns of the same layer', () => {
    expect(simplifyMoves(['U', 'U'])).toEqual(['U2'])
    expect(simplifyMoves(["U'", "U'"])).toEqual(['U2'])
    expect(simplifyMoves(['U2', "U'"])).toEqual(['U'])
    expect(simplifyMoves(['U', 'U', 'U'])).toEqual(["U'"])
    expect(simplifyMoves(['U2', 'U2'])).toEqual([])
  })

  it('keeps different layers apart, including wide and slice turns', () => {
    expect(simplifyMoves(['R', 'Rw', "R'"])).toEqual(['R', 'Rw', "R'"])
    expect(simplifyMoves(['Rw', "Rw'"])).toEqual([])
    expect(simplifyMoves(['R', 'L', "R'"])).toEqual(['R', 'L', "R'"])
  })
})
