import { describe, expect, it } from 'vitest'
import type { Move } from '../smart-solver/core/types'
import { applyMoves, isSolved, parseAlgorithm, SOLVED } from '../smart-solver/core/cubie'
import { guideReducer, INITIAL_GUIDE_STATE, type GuideEvent, type GuideState } from '../smart-solver/guidance/fsm'
import { solveBeginner3 } from '../smart-solver/nxn/beginner'
import { STAGES } from './stages'
import {
  RoadmapView,
  NotationView,
  StepView,
  CheckpointView,
  PracticeSourceView,
  PracticeView,
  PracticeDoneView,
  PreconditionView
} from './ui'
import { getMove, getStage, format } from './copy/copy'
import {
  PRACTICE_SAMPLES,
  buildPracticeState,
  checkPrecondition,
  stageProgress,
  nextHint
} from './engine/practice'
import { getLearnProgress, markStageCompleted, markStagePracticed } from './engine/storage'

describe('Learn Mode: Beginner Flow, Checkpoints, & Practice (Phases 3, 4, 5)', () => {
  describe('Component exports', () => {
    it('exports all Beginner Mode UI components (N1–N8)', () => {
      expect(typeof RoadmapView).toBe('function')
      expect(typeof NotationView).toBe('function')
      expect(typeof StepView).toBe('function')
      expect(typeof CheckpointView).toBe('function')
      expect(typeof PracticeSourceView).toBe('function')
      expect(typeof PracticeView).toBe('function')
      expect(typeof PracticeDoneView).toBe('function')
      expect(typeof PreconditionView).toBe('function')
    })
  })

  describe('N1: Roadmap data integration', () => {
    it('maps all 7 stages with valid copy for N1 cards', () => {
      for (const stage of STAGES) {
        const copy = getStage(stage.id)
        expect(copy.title).toBeTruthy()
        expect(copy.goal).toBeTruthy()
        expect(copy.why).toBeTruthy()
        expect(copy.check.length).toBeGreaterThan(0)
      }
    })

    it('correctly reports isDone for stages on solved and scrambled cubes', () => {
      expect(STAGES[0]!.isDone(SOLVED)).toBe(true)
      const brokenCross = applyMoves(SOLVED, parseAlgorithm('D'))
      expect(STAGES[0]!.isDone(brokenCross)).toBe(false)
    })
  })

  describe('N2: Notation reference & move details', () => {
    it('provides copy title and hint for all 18 moves', () => {
      const faces = ['R', 'L', 'U', 'D', 'F', 'B'] as const
      for (const f of faces) {
        for (const suffix of ['', "'", '2'] as const) {
          const m = `${f}${suffix}` as const
          const moveCopy = getMove(m)
          expect(moveCopy.title).toBeTruthy()
          expect(moveCopy.hint).toBeTruthy()
        }
      }
    })
  })

  describe('N3: StepView & FSM guidance integration', () => {
    it('advances step on expected move (button click or 3D drag)', () => {
      const moves: Move[] = ['R', 'U', "R'", "U'"]
      const startState = applyMoves(SOLVED, parseAlgorithm("U R U' R'"))

      let state: GuideState = {
        ...INITIAL_GUIDE_STATE,
        phase: 'GUIDING',
        cube: startState,
        solution: moves,
        index: 0
      }

      // First step: 'R'
      state = guideReducer(state, { type: 'MOVES_DONE', moves: ['R'] })
      expect(state.index).toBe(1)
      expect(state.phase).toBe('GUIDING')

      // Second step: 'U'
      state = guideReducer(state, { type: 'MOVES_DONE', moves: ['U'] })
      expect(state.index).toBe(2)
      expect(state.phase).toBe('GUIDING')
    })

    it('inserts recovery / undo move when user turns wrong move', () => {
      const sample = PRACTICE_SAMPLES.cross[0]!
      const startState = buildPracticeState('cross', sample)
      const steps = solveBeginner3(startState)
      const moves = steps.flatMap((s) => s.moves)

      let state: GuideState = {
        ...INITIAL_GUIDE_STATE,
        phase: 'GUIDING',
        cube: startState,
        solution: moves,
        index: 0
      }

      // User turns wrong move 'B2' instead of expected move
      state = guideReducer(state, { type: 'MOVES_DONE', moves: ['B2'] })
      expect(state.phase).toBe('RECOVERING')
      // The wrong move B2 is inverted with B2 at the front of the recovery solution
      expect(state.solution[0]).toBe('B2')
      expect(isSolved(applyMoves(state.cube!, state.solution))).toBe(true)
    })
  })

  describe('N4: CheckpointView & Stage Verification (Phase 4)', () => {
    it('verifies all 7 stages have check criteria and localized copy', () => {
      expect(STAGES.length).toBe(7)
      for (const stage of STAGES) {
        const copy = getStage(stage.id)
        expect(copy.check.length).toBeGreaterThanOrEqual(1)
        for (const item of copy.check) {
          expect(item.trim().length).toBeGreaterThan(0)
        }
      }
    })

    it('auto-verifies isDone returns true on solved cube for all stages', () => {
      for (const stage of STAGES) {
        expect(stage.isDone(SOLVED)).toBe(true)
      }
    })

    it('returns isDone = false for practice sample of each stage', () => {
      for (const stage of STAGES) {
        const sample = PRACTICE_SAMPLES[stage.id][0]!
        const state = buildPracticeState(stage.id, sample)
        expect(stage.isDone(state)).toBe(false)
      }
    })

    it('supports stage progression sequence from cross to topEdges', () => {
      for (let i = 0; i < STAGES.length - 1; i++) {
        const current = STAGES[i]!
        const next = STAGES[i + 1]!
        expect(next.index).toBe(current.index + 1)
        expect(next.prerequisite).toBe(current.id)
      }
    })

    it('formats checkpoint copy strings with situation tokens', () => {
      expect(format('checkMatch')).toBe('Giống rồi')
      expect(format('needFix')).toBe('Chưa giống — giúp mình sửa')
      expect(format('checkpointTitle')).toBe('Kiểm tra giai đoạn')
      expect(format('autoCheckPassed')).toContain('Hệ thống')
      const formattedDone = format('stageDone', { stage: 'Chữ thập' })
      expect(formattedDone).toContain('Chữ thập')
    })
  })

  describe('Phase 5: Practice (N5–N8) & Precondition Verification', () => {
    it('verifies all 21 practice samples satisfy their stage precondition', () => {
      for (const stage of STAGES) {
        const samples = PRACTICE_SAMPLES[stage.id]
        expect(samples.length).toBeGreaterThanOrEqual(3)
        for (const sample of samples) {
          const state = buildPracticeState(stage.id, sample)
          const precond = checkPrecondition(stage, state)
          expect(precond.ok).toBe(true)
          expect(precond.missing).toEqual([])
        }
      }
    })

    it('identifies missing prerequisites when scanned cube is incomplete (N8)', () => {
      // Cube with broken cross
      const brokenCross = applyMoves(SOLVED, parseAlgorithm("D R U R' D'"))
      const precond = checkPrecondition(STAGES[2]!, brokenCross) // stage 'middle' requires cross & corners
      expect(precond.ok).toBe(false)
      expect(precond.missing.length).toBeGreaterThan(0)
    })

    it('calculates stage progress metrics accurately', () => {
      for (const stage of STAGES) {
        const full = stageProgress(stage, SOLVED)
        expect(full.done).toBe(full.total)
        expect(full.total).toBe(4)
      }
    })

    it('provides valid nextHint for practice state', () => {
      const sample = PRACTICE_SAMPLES.cross[0]!
      const state = buildPracticeState('cross', sample)
      const hint = nextHint(STAGES[0]!, state)
      expect(hint).not.toBeNull()
      expect(hint?.stage).toBe('cross')
      expect(hint?.move).toBeTruthy()
    })

    it('safely stores and retrieves learned progress in localStorage', () => {
      const initial = getLearnProgress()
      expect(Array.isArray(initial.completed)).toBe(true)
      expect(Array.isArray(initial.practiced)).toBe(true)

      markStageCompleted('cross')
      markStagePracticed('cross')

      const updated = getLearnProgress()
      expect(updated.completed).toContain('cross')
      expect(updated.practiced).toContain('cross')
    })

    it('formats N5–N8 copy strings correctly', () => {
      expect(format('practiceSourceTitle')).toBe('Chọn nguồn khối luyện tập')
      expect(format('tabPresetSamples')).toBe('Mẫu có sẵn')
      expect(format('tabScanOwnCube')).toBe('Quét khối của mình')
      expect(format('practiceDoneTitle')).toBe('Luyện tập thành công!')
      expect(format('preconditionTitle')).toBe('Chưa đủ điều kiện tiên quyết')
      const formattedDoMissing = format('doMissingStageFirst', { stage: 'Chữ thập mặt đáy' })
      expect(formattedDoMissing).toContain('Chữ thập mặt đáy')
    })
  })

  describe('Phase 6: Accessibility (a11y) & Mobile 360px Robustness', () => {
    it('verifies all Phase 6 a11y copy strings exist and format with parameters', () => {
      expect(format('backToRoadmapAria')).toBe('Quay lại lộ trình')
      expect(format('backToSourceAria')).toBe('Quay lại chọn nguồn khối')
      expect(format('stopPracticeAria')).toBe('Dừng luyện tập và quay lại')
      expect(format('viewRoadmap')).toBe('Xem lộ trình')
      expect(format('checkStageAria')).toBe('Kiểm tra hoàn thành giai đoạn')

      const stepAria = format('stepCardAria', { step: 3, total: 10, title: 'Phải lên' })
      expect(stepAria).toBe('Bước 3 trên 10: Phải lên')

      const learnBeforeAria = format('learnStageBefore', { stage: 'Góc mặt đáy' })
      expect(learnBeforeAria).toBe('Học giai đoạn Góc mặt đáy trước')

      const selectMoveAria = format('selectMoveAria', { move: "R'" })
      expect(selectMoveAria).toBe("Xem phép xoay R'")
    })

    it('ensures zero unlocalized raw strings in all 18 moves', () => {
      const faces = ['R', 'L', 'U', 'D', 'F', 'B'] as const
      for (const f of faces) {
        for (const suffix of ['', "'", '2'] as const) {
          const move = `${f}${suffix}` as Move
          const copy = getMove(move)
          expect(copy.title).not.toMatch(/^\{.*\}$/)
          expect(copy.hint).not.toMatch(/^\{.*\}$/)
        }
      }
    })

    it('ensures all 7 stages have complete and localized criteria', () => {
      for (const stage of STAGES) {
        const copy = getStage(stage.id)
        expect(copy.check.length).toBeGreaterThanOrEqual(1)
        for (const criterion of copy.check) {
          expect(criterion.length).toBeGreaterThan(5)
        }
      }
    })
  })
})

