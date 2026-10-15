import { describe, expect, it } from 'vitest'
import { applyMoves, parseAlgorithm, SOLVED } from '../smart-solver/core/cubie'
import { solveBeginner3 } from '../smart-solver/nxn/beginner'
import { PRACTICE_SAMPLES, checkPrecondition } from './engine/practice'
import { findStageRange, firstUndoneFrom, groupStageRanges, stageInProgress } from './engine/stagePlan'
import { STAGES } from './stages'

const SCRAMBLE = parseAlgorithm("R U F' D L2 B U2 R' F D'")

describe('stage ranges', () => {
  it('merges steps of one stage into a single range covering the whole solution', () => {
    const steps = solveBeginner3(applyMoves(SOLVED, SCRAMBLE))
    let at = 0
    const withRange = steps.map((st) => {
      const r = { stageId: st.stage, start: at, end: at + st.moves.length }
      at = r.end
      return r
    })
    const ranges = groupStageRanges(withRange)
    expect(new Set(ranges.map((r) => r.stageId)).size).toBe(ranges.length)
    expect(ranges[0]!.start).toBe(0)
    expect(ranges[ranges.length - 1]!.end).toBe(at)
    expect(findStageRange(ranges, 0)?.stageId).toBe(ranges[0]!.stageId)
    expect(findStageRange(ranges, at)).toBeNull()
  })

  it('follows the cube: stageInProgress moves on once a stage is reached', () => {
    const cube = applyMoves(SOLVED, SCRAMBLE)
    const first = stageInProgress(cube)
    expect(first.id).toBe('cross')
    const steps = solveBeginner3(cube)
    const crossMoves = steps.filter((s) => s.stage === 'cross').flatMap((s) => s.moves)
    const after = applyMoves(cube, crossMoves)
    expect(stageInProgress(after).index).toBeGreaterThan(first.index)
    expect(firstUndoneFrom(STAGES[0]!, after)?.index).toBe(stageInProgress(after).index)
    expect(firstUndoneFrom(STAGES[0]!, SOLVED)).toBeNull()
  })

  it('refuses to start a later stage on a cube missing earlier ones', () => {
    const pre = checkPrecondition(STAGES[2]!, applyMoves(SOLVED, SCRAMBLE))
    expect(pre.ok).toBe(false)
    expect(pre.missing[0]).toBe('cross')
  })
})

describe('practice samples', () => {
  it('get harder from A to C (solution length never shrinks) and keep copy outside code', () => {
    for (const s of STAGES) {
      const lens = PRACTICE_SAMPLES[s.id].map((sample) => {
        expect(sample.label).not.toBe(sample.id)
        expect(sample.desc).toBeTruthy()
        const cube = applyMoves(SOLVED, sample.setup)
        return solveBeginner3(cube).filter((st) => st.stage === s.id).flatMap((st) => st.moves).length
      })
      expect(lens[2]!).toBeGreaterThanOrEqual(lens[0]!)
    }
  })
})
