import { describe, expect, it } from 'vitest'
import { getEngine } from '../nxn/engine'
import type { SolveResult } from '../nxn/solveRubik'
import { currentStage, expectedTurn, initialNxnGuide, nxnGuideReducer, remainingParts, type NxnGuideEvent, type NxnGuideState } from './nxnGuide'

const run = (s: NxnGuideState, events: NxnGuideEvent[]) => events.reduce(nxnGuideReducer, s)

function guiding(n: number, scramble: string[], solution: string[]): NxnGuideState {
  const e = getEngine(n)
  const result: SolveResult = {
    size: n as 4,
    moves: solution,
    moveCount: solution.length,
    optimal: false,
    algorithm: 'test',
    executionTimeMs: 1,
    steps: [
      { stage: 'a', title: 'A', moves: solution.slice(0, 1), algorithms: [] },
      { stage: 'b', title: 'B', moves: solution.slice(1), algorithms: [] }
    ]
  }
  const s = run(initialNxnGuide(n), [{ type: 'SCANNED', stickers: e.applyAll(e.solved(), scramble) }, { type: 'CONFIRM_REVIEW' }])
  return nxnGuideReducer(s, { type: 'SOLVED', epoch: s.epoch, result })
}

describe('nxnGuide', () => {
  it('follows the solution to completion, with stages', () => {
    let s = guiding(4, ['R', 'Uw'], ["Uw'", "R'"])
    expect(expectedTurn(s)).toBe("Uw'")
    expect(currentStage(s)?.title).toBe('A')
    s = nxnGuideReducer(s, { type: 'TURNED', token: "Uw'" })
    expect(currentStage(s)?.title).toBe('B')
    s = nxnGuideReducer(s, { type: 'TURNED', token: "R'" })
    expect(s.phase).toBe('COMPLETED')
  })

  it('accepts a wide step dragged one layer at a time, in any order', () => {
    let s = guiding(4, ['R', 'Uw'], ["Uw'", "R'"])
    s = nxnGuideReducer(s, { type: 'TURNED', token: "2U'" })
    expect(s.index).toBe(0)
    expect(s.partial).toEqual(["2U'"])
    expect(remainingParts("Uw'", s.partial, 4)).toEqual(["U'"])
    s = nxnGuideReducer(s, { type: 'TURNED', token: "U'" })
    expect(s.index).toBe(1)
    expect(s.partial).toEqual([])
  })

  it('accepts the same layer named from the other side', () => {
    let s = guiding(5, ["3R'", 'U'], ["U'", '3R'])
    s = nxnGuideReducer(s, { type: 'TURNED', token: "U'" })
    // 3R on a 5x5 is the middle layer: 3L' turns it the same way.
    s = nxnGuideReducer(s, { type: 'TURNED', token: "3L'" })
    expect(s.phase).toBe('COMPLETED')
  })

  it('a wrong turn is undone before the next step', () => {
    let s = guiding(4, ['R', 'Uw'], ["Uw'", "R'"])
    s = nxnGuideReducer(s, { type: 'TURNED', token: '2U' })
    expect(s.solution.slice(0, 2)).toEqual(["2U'", "Uw'"])
    expect(currentStage(s)?.title).toBe('A')
    s = run(s, ["2U'", "Uw'", "R'"].map((token) => ({ type: 'TURNED', token }) as NxnGuideEvent))
    expect(s.phase).toBe('COMPLETED')
  })

  it('drops solver results from an older epoch', () => {
    const e = getEngine(3)
    let s = run(initialNxnGuide(3), [{ type: 'SCANNED', stickers: e.apply(e.solved(), 'R') }, { type: 'CONFIRM_REVIEW' }])
    const old = s.epoch
    s = run(s, [{ type: 'START_SCAN' }])
    s = nxnGuideReducer(s, { type: 'SOLVE_FAILED', epoch: old, kind: 'failed', message: 'x' })
    expect(s.phase).toBe('SCANNING')
  })
})

describe('nxnGuide tokens', () => {
  it('names inner layers from the nearer face', () => {
    const s = guiding(5, ['4R', 'U'], ["U'", "4R'"])
    expect(s.solution).toEqual(["U'", '2L'])
  })
})

describe('nxnGuide half turns', () => {
  for (const quarter of ['R', "R'"]) {
    it(`accepts R2 as ${quarter} ${quarter}`, () => {
      let s = guiding(4, ['R2', 'U'], ["U'", 'R2'])
      s = nxnGuideReducer(s, { type: 'TURNED', token: "U'" })
      s = nxnGuideReducer(s, { type: 'TURNED', token: quarter })
      expect(s.partial).toEqual([quarter])
      expect(remainingParts('R2', s.partial, 4)).toEqual([quarter])
      s = nxnGuideReducer(s, { type: 'TURNED', token: quarter })
      expect(s.phase).toBe('COMPLETED')
    })
  }

  it('a wide half turn can be made one quarter of one layer at a time', () => {
    let s = guiding(4, ['Rw2', 'U'], ["U'", 'Rw2'])
    s = nxnGuideReducer(s, { type: 'TURNED', token: "U'" })
    for (const token of ['R', "2R'", 'R', "2R'"]) s = nxnGuideReducer(s, { type: 'TURNED', token })
    expect(s.phase).toBe('COMPLETED')
  })

  it('a quarter turned back is not a mistake; a quarter step turned twice is', () => {
    let s = guiding(4, ['R', 'U'], ["U'", "R'"])
    s = nxnGuideReducer(s, { type: 'TURNED', token: "U'" })
    s = nxnGuideReducer(s, { type: 'TURNED', token: 'R' })
    expect(s.solution.slice(s.index, s.index + 2)).toEqual(["R'", "R'"])
    s = run(s, [{ type: 'TURNED', token: "R'" }, { type: 'TURNED', token: "R'" }])
    expect(s.phase).toBe('COMPLETED')
  })
})

describe('nxnGuide reset', () => {
  it('reset ends the guidance with a solved cube', () => {
    const s = nxnGuideReducer(guiding(4, ['R', 'Uw'], ["Uw'", "R'"]), { type: 'RESET_SOLVED' })
    expect(s.phase).toBe('COMPLETED')
    expect(expectedTurn(s)).toBeNull()
    expect(s.history).toEqual([])
  })
})
