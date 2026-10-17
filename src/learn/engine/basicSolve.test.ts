import { describe, expect, it } from 'vitest'
import { applyMoves, isSolved, SOLVED } from '../../smart-solver/core/cubie'
import type { CubieState, Move } from '../../smart-solver/core/types'
import { CURRICULUM_STAGES } from '../curriculum'
import { basicStageInProgress, planBasicStage } from './basicSolve'

const NAMES = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }
const FACE_MOVE = /^[URFDLB]['2]?$/

function rng(seed: number) {
  let s = seed
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return (s >>> 8) / 2 ** 24
  }
}
function scramble(r: () => number, length = 25): Move[] {
  const faces = ['U', 'R', 'F', 'D', 'L', 'B']
  const out: Move[] = []
  for (let i = 0; i < length; i += 1) out.push(`${faces[Math.floor(r() * 6)]}${['', "'", '2'][Math.floor(r() * 3)]}` as Move)
  return out
}

describe('basic 3x3 solve by big steps', () => {
  it('has seven big steps and none for a solved cube', () => {
    expect(CURRICULUM_STAGES).toHaveLength(7)
    expect(basicStageInProgress(SOLVED)).toBeNull()
    expect(planBasicStage(SOLVED, NAMES)).toBeNull()
  })

  it('solves random cubes one big step at a time, in lesson order, with face turns only', () => {
    const r = rng(11)
    for (let n = 0; n < 40; n += 1) {
      let cube: CubieState = applyMoves(SOLVED, scramble(r))
      const seen: string[] = []
      let total = 0
      while (!isSolved(cube)) {
        const plan = planBasicStage(cube, NAMES)
        expect(plan).not.toBeNull()
        if (!plan) throw new Error('no plan')
        expect(plan.moves.length).toBeGreaterThan(0)
        expect(plan.whys).toHaveLength(plan.moves.length)
        expect(plan.moves.every((m) => FACE_MOVE.test(m))).toBe(true)
        cube = applyMoves(cube, plan.moves)
        expect(plan.stage.isDone(cube)).toBe(true)
        seen.push(plan.stage.id)
        total += plan.moves.length
        expect(seen.length).toBeLessThanOrEqual(7)
      }
      // Big steps only ever go forward and never repeat.
      const order = CURRICULUM_STAGES.map((s) => s.id as string)
      expect(seen.map((id) => order.indexOf(id))).toEqual([...seen.map((id) => order.indexOf(id))].sort((a, b) => a - b))
      expect(new Set(seen).size).toBe(seen.length)
      expect(total).toBeLessThan(500)
    }
  })

  it('plans only the step the cube is in, even when a later step is already half done', () => {
    const cube = applyMoves(SOLVED, ['R', 'U', "R'", "U'"])
    const plan = planBasicStage(cube, NAMES)!
    expect(plan.stage.id).toBe(basicStageInProgress(cube)!.id)
  })
})
