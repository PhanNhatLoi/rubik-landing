import { describe, expect, it, vi } from 'vitest'
import { applyMoves, equals, isSolved, SOLVED } from '../smart-solver/core/cubie'
import { MOVES, type Move } from '../smart-solver/core/types'
import { crossDone as legacyCrossDone } from '../smart-solver/nxn/beginner'
import { learningMoves, learningState } from './orientation'
import { solveLearning3 } from './engine/solveLearning'
import { crossDone, firstLayerDone, f2lDone, topCrossDone } from './goals'
import { STAGES } from './stages'
import { buildCrossGuide } from './guide/crossGuide'
import { buildCornerGuide } from './guide/cornerGuide'
import { buildMiddleGuide } from './guide/middleGuide'
import { buildTopCrossGuide } from './guide/topCrossGuide'
import { lastEdgesDone } from './guide/lastEdgesGuide'
import { buildLastEdgesOrderGuide as buildLastEdgesGuide } from './guide/lastEdgesOrder'

const NAMES = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }
function random(seed: number) {
  let s = seed
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32 }
}
const scramble = (rng: () => number): Move[] => Array.from({ length: 20 }, () => MOVES[Math.floor(rng() * MOVES.length)]!)

describe('white-top learning curriculum', () => {
  it('maps states and moves consistently, is reversible, and leaves solved and standard palette intact', () => {
    const rng = random(45)
    expect(equals(learningState(SOLVED), SOLVED)).toBe(true)
    for (let i = 0; i < 100; i += 1) {
      const moves = scramble(rng)
      const state = applyMoves(SOLVED, moves)
      expect(equals(learningState(state), applyMoves(SOLVED, learningMoves(moves)))).toBe(true)
      expect(equals(learningState(learningState(state)), state)).toBe(true)
    }
  })

  it('checks U as the first layer and D as the last, independently of legacy solver goals', () => {
    const bottomTurn = applyMoves(SOLVED, ['D'])
    const topTurn = applyMoves(SOLVED, ['U'])
    expect(crossDone(bottomTurn)).toBe(true)
    expect(firstLayerDone(bottomTurn)).toBe(true)
    expect(f2lDone(bottomTurn)).toBe(true)
    expect(topCrossDone(bottomTurn)).toBe(true)
    expect(crossDone(topTurn)).toBe(false)
    expect(legacyCrossDone(topTurn)).toBe(true)
  })

  it('solves 100 cubes in the new stage order with matching checkpoint goals', () => {
    const rng = random(61)
    for (let i = 0; i < 100; i += 1) {
      let state = applyMoves(SOLVED, scramble(rng))
      const plan = solveLearning3(state)
      for (let j = 0; j < plan.length; j += 1) {
        const step = plan[j]!
        state = applyMoves(state, step.moves)
        if (plan[j + 1]?.stage !== step.stage) {
          const stage = STAGES.find((s) => s.id === step.stage)!
          expect(stage.isDone(state), `stage ${step.stage}`).toBe(true)
        }
      }
      expect(isSolved(state)).toBe(true)
    }
  })

  it('keeps old progress intact and stores the new curriculum separately', async () => {
    const legacy = JSON.stringify({ completed: ['cross', 'corners'], practiced: ['middle'] })
    const storage = new Map([['rubik.learn.progress', legacy]])
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
    try {
      vi.resetModules()
      const progress = await import('./engine/storage')
      expect(progress.getLearnProgress().completed).toEqual([])
      progress.markStageCompleted('cross')
      expect(storage.get('rubik.learn.progress')).toBe(legacy)
      expect(JSON.parse(storage.get('rubik.learn.progress.white-top-v2')!).completed).toEqual(['cross'])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('chains lessons 2–6 on random cubes: white first, middle, yellow cross, then side-matching edges', () => {
    const rng = random(77)
    for (let i = 0; i < 30; i += 1) {
      let state = applyMoves(SOLVED, scramble(rng))
      for (const [build, done, max] of [
        [buildCrossGuide, crossDone, 4],
        [buildCornerGuide, firstLayerDone, 4],
        [buildMiddleGuide, f2lDone, 4]
      ] as const) {
        for (let k = 0; k < max && !done(state); k += 1) {
          const guide = build(state, NAMES)
          expect(guide).not.toBeNull()
          if (!guide) throw new Error('Missing guide')
          state = guide.states.at(-1)!
        }
        expect(done(state)).toBe(true)
      }
      for (let k = 0; k < 2 && !topCrossDone(state); k += 1) {
        const guide = buildTopCrossGuide(state, NAMES, 'dual')
        expect(guide).not.toBeNull()
        if (!guide) throw new Error('Missing last-layer guide')
        state = guide.states.at(-1)!
        expect(f2lDone(state)).toBe(true)
      }
      expect(topCrossDone(state)).toBe(true)
      for (let k = 0; k < 3 && !lastEdgesDone(state); k += 1) {
        const guide = buildLastEdgesGuide(state, NAMES)
        expect(guide).not.toBeNull()
        if (!guide) throw new Error('Missing last-edge guide')
        state = guide.states.at(-1)!
      }
      expect(lastEdgesDone(state)).toBe(true)
    }
  })
})
