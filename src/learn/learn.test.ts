import { describe, expect, it } from 'vitest'
import { applyMoves, parseAlgorithm, SOLVED } from '../smart-solver/core/cubie'
import { MOVES, type Move } from '../smart-solver/core/types'
import { format, getMove, getStage } from './copy/copy'
import { solveBeginner3 } from '../smart-solver/nxn/beginner'
import {
  buildPracticeState,
  checkPrecondition,
  nextHint,
  PRACTICE_SAMPLES,
  resetHintPlan,
  stageProgress
} from './engine/practice'
import { STAGES } from './stages'

describe('Phase 1: Engine + Copy', () => {
  describe('(a) Copy requirements: 18 moves & 7 stages', () => {
    it('has title and hint for all 18 moves', () => {
      expect(MOVES.length).toBe(18)
      for (const m of MOVES) {
        const copy = getMove(m as Move)
        expect(copy.title, `Move ${m} has title`).toBeTruthy()
        expect(copy.hint, `Move ${m} has hint`).toBeTruthy()
      }
    })

    it('has title, goal, why, and check items for all 7 stages', () => {
      expect(STAGES.length).toBe(7)
      for (const s of STAGES) {
        const copy = getStage(s.id)
        expect(copy.id).toBe(s.id)
        expect(copy.title, `Stage ${s.id} title`).toBeTruthy()
        expect(copy.goal, `Stage ${s.id} goal`).toBeTruthy()
        expect(copy.why, `Stage ${s.id} why`).toBeTruthy()
        expect(copy.check.length, `Stage ${s.id} check list`).toBeGreaterThanOrEqual(1)
      }
    })

    it('formats situations with parameters correctly', () => {
      expect(format('stepCounter', { step: 3, total: 12 })).toBe('Bước 3/12')
      expect(format('moveCounter', { count: 15 })).toBe('15 nước đi')
      expect(format('stageDone', { stage: 'Chữ thập mặt đáy' })).toBe('Bạn vừa hoàn thành giai đoạn Chữ thập mặt đáy!')
    })
  })

  describe('(b) StageDef.isDone verification', () => {
    it('returns true for all stages on SOLVED cube', () => {
      for (const s of STAGES) {
        expect(s.isDone(SOLVED), `Stage ${s.id} isDone on SOLVED`).toBe(true)
      }
    })

    it('returns false for each stage when its goal is specifically broken', () => {
      const brokenStates = [
        { id: 'cross', state: applyMoves(SOLVED, ['D']) },
        { id: 'corners', state: applyMoves(SOLVED, parseAlgorithm("R U R' U'")) },
        { id: 'middle', state: applyMoves(SOLVED, parseAlgorithm("U R U' R' U' F' U F")) },
        { id: 'topCross', state: applyMoves(SOLVED, parseAlgorithm("F R U R' U' F'")) },
        { id: 'topFace', state: applyMoves(SOLVED, parseAlgorithm("R U R' U R U2 R'")) },
        { id: 'topCorners', state: applyMoves(SOLVED, parseAlgorithm("R' F R' B2 R F' R' B2 R2")) },
        { id: 'topEdges', state: applyMoves(SOLVED, parseAlgorithm("R U' R U R U R U' R' U' R2")) }
      ]

      for (const { id, state } of brokenStates) {
        const def = STAGES.find((s) => s.id === id)!
        expect(def.isDone(state), `Stage ${id} should not be done`).toBe(false)
      }
    })
  })

  describe('(c) PracticeSample verification: satisfies checkPrecondition and !isDone', () => {
    it('verifies every practice sample satisfies precondition and is not yet done', () => {
      for (const s of STAGES) {
        const samples = PRACTICE_SAMPLES[s.id]
        expect(samples.length, `Stage ${s.id} has >= 3 samples`).toBeGreaterThanOrEqual(3)

        for (const sample of samples) {
          const state = buildPracticeState(s.id, sample)
          const pre = checkPrecondition(s, state)

          expect(pre.ok, `Sample ${sample.id} precondition ok`).toBe(true)
          expect(pre.missing, `Sample ${sample.id} missing empty`).toEqual([])
          expect(s.isDone(state), `Sample ${sample.id} isDone is false`).toBe(false)

          const prog = stageProgress(s, state)
          expect(prog.total).toBe(4)
          expect(prog.done).toBeLessThan(4)
        }
      }
    })

    it('correctly reports missing precondition when earlier stage is broken', () => {
      // Break cross
      const brokenCross = applyMoves(SOLVED, ['D'])
      const middleDef = STAGES.find((s) => s.id === 'middle')!
      const pre = checkPrecondition(middleDef, brokenCross)

      expect(pre.ok).toBe(false)
      expect(pre.missing).toContain('cross')
    })
  })

  describe('(d) Repeated nextHint application leads to isDone === true', () => {
    it('solves each sample by repeatedly applying nextHint moves', () => {
      for (const s of STAGES) {
        const samples = PRACTICE_SAMPLES[s.id]

        for (const sample of samples) {
          resetHintPlan()
          let state = buildPracticeState(s.id, sample)
          let stepsTaken = 0
          const maxSteps = 60

          while (!s.isDone(state) && stepsTaken < maxSteps) {
            const hint = nextHint(s, state)
            expect(hint, `Hint for ${sample.id} at step ${stepsTaken}`).not.toBeNull()
            expect(hint!.stage).toBe(s.id)

            state = applyMoves(state, [hint!.move])
            stepsTaken += 1
          }

          expect(s.isDone(state), `Sample ${sample.id} reached isDone within ${stepsTaken} steps`).toBe(true)
        }
      }
    })
  })
})
