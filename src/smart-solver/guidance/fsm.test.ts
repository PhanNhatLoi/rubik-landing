import { describe, expect, it } from 'vitest'
import { SOLVED, applyMoves, isSolved, parseAlgorithm } from '../core'
import { INITIAL_GUIDE_STATE, expectedMove, guideReducer, needsSolve, nextTurn, wantsOptimal, type GuideEvent, type GuideState } from './fsm'

const run = (events: GuideEvent[], from: GuideState = INITIAL_GUIDE_STATE) => events.reduce(guideReducer, from)

const scramble = parseAlgorithm("R U F'")
const scrambled = applyMoves(SOLVED, scramble)
const solution = parseAlgorithm("F U' R'")

const SCAN_AND_CONFIRM: GuideEvent[] = [
  { type: 'START_SCAN', purpose: 'initial' },
  { type: 'SCANNED', cube: scrambled },
  { type: 'CONFIRM_REVIEW' }
]

function guiding(): GuideState {
  const s = run(SCAN_AND_CONFIRM)
  return guideReducer(s, { type: 'SOLVED', epoch: s.epoch, moves: solution, ms: 5 })
}

describe('guideReducer', () => {
  it('goes from scan to review to solving to guiding', () => {
    const reviewing = run([{ type: 'START_SCAN', purpose: 'initial' }, { type: 'SCANNED', cube: scrambled }])
    expect(reviewing.phase).toBe('REVIEWING')
    expect(needsSolve(reviewing)).toBe(false)
    const scanned = guideReducer(reviewing, { type: 'CONFIRM_REVIEW' })
    expect(scanned.phase).toBe('SOLVING')
    expect(needsSolve(scanned)).toBe(true)
    const g = guideReducer(scanned, { type: 'SOLVED', epoch: scanned.epoch, moves: solution, ms: 5 })
    expect(g.phase).toBe('GUIDING')
    expect(expectedMove(g)).toBe('F')
  })

  it('ignores solutions from an older epoch', () => {
    const scanned = run(SCAN_AND_CONFIRM)
    const stale = guideReducer(scanned, { type: 'SOLVED', epoch: scanned.epoch - 1, moves: solution, ms: 5 })
    expect(stale).toBe(scanned)
  })

  it('advances on the expected move and asks for verification at the end', () => {
    let s = guiding()
    s = guideReducer(s, { type: 'MOVES_DONE', moves: ['F'] })
    expect(s.index).toBe(1)
    s = run([{ type: 'MOVES_DONE', moves: ["U'"] }, { type: 'MOVES_DONE', moves: ["R'"] }], s)
    expect(s.phase).toBe('VERIFYING')
    expect(isSolved(s.cube!)).toBe(true)
    expect(guideReducer(s, { type: 'SKIP_VERIFY' }).phase).toBe('COMPLETED')
  })

  it('recovers from a wrong move with an immediate fallback', () => {
    const before = guiding()
    const s = guideReducer(before, { type: 'MOVES_DONE', moves: ['D2'] })
    expect(s.phase).toBe('RECOVERING')
    expect(s.epoch).toBe(before.epoch + 1)
    expect(s.solution).toEqual(['D2', 'F', "U'", "R'"])
    expect(isSolved(applyMoves(s.cube!, s.solution))).toBe(true)
    expect(needsSolve(s)).toBe(true)
  })

  it('keeps the fallback when the recomputed solution is longer, takes it when shorter', () => {
    const rec = guideReducer(guiding(), { type: 'MOVES_DONE', moves: ['D2'] })
    const longer = guideReducer(rec, { type: 'SOLVED', epoch: rec.epoch, moves: parseAlgorithm('L R U D F B'), ms: 9 })
    expect(longer.phase).toBe('GUIDING')
    expect(longer.solution).toEqual(rec.solution)
    const shorter = guideReducer(rec, { type: 'SOLVED', epoch: rec.epoch, moves: parseAlgorithm("D2 F U'"), ms: 9 })
    expect(shorter.solution).toEqual(["D2", 'F', "U'"])
  })

  it('following the fallback while recovering invalidates the pending solve', () => {
    const rec = guideReducer(guiding(), { type: 'MOVES_DONE', moves: ['D2'] })
    const next = guideReducer(rec, { type: 'MOVES_DONE', moves: ['D2'] })
    expect(next.phase).toBe('RECOVERING')
    expect(next.index).toBe(1)
    expect(next.epoch).toBe(rec.epoch + 1)
    expect(guideReducer(next, { type: 'SOLVED', epoch: rec.epoch, moves: [], ms: 1 })).toBe(next)
  })

  it('verification scan: solved completes, unsolved recovers', () => {
    let s = guiding()
    s = run([{ type: 'MOVES_DONE', moves: ['F'] }, { type: 'MOVES_DONE', moves: ["U'"] }, { type: 'MOVES_DONE', moves: ["R'"] }], s)
    s = guideReducer(s, { type: 'START_SCAN', purpose: 'verify' })
    expect(guideReducer(s, { type: 'SCANNED', cube: SOLVED }).phase).toBe('COMPLETED')
    const off = guideReducer(s, { type: 'SCANNED', cube: applyMoves(SOLVED, ['U']) })
    expect(off.phase).toBe('RECOVERING')
    expect(needsSolve(off)).toBe(true)
  })

  it('reports a solver failure only for the current epoch', () => {
    const scanned = run(SCAN_AND_CONFIRM)
    expect(guideReducer(scanned, { type: 'SOLVE_FAILED', epoch: scanned.epoch, message: 'x' }).phase).toBe('ERROR')
    expect(guideReducer(scanned, { type: 'SOLVE_FAILED', epoch: 0, message: 'x' })).toBe(scanned)
  })

  it('ignores moves outside of guidance', () => {
    expect(guideReducer(INITIAL_GUIDE_STATE, { type: 'MOVES_DONE', moves: ['R'] })).toBe(INITIAL_GUIDE_STATE)
  })

  it('replaces the remaining path with a proven shortest one and keeps it while followed', () => {
    // Two-phase gave a detour: R R' F U' R' (5) for a 3-move distance.
    const scanned = run(SCAN_AND_CONFIRM)
    let s = guideReducer(scanned, { type: 'SOLVED', epoch: scanned.epoch, moves: parseAlgorithm("D D' F U' R'"), ms: 5 })
    expect(wantsOptimal(s)).toBe(true)
    s = guideReducer(s, { type: 'OPTIMAL_FOUND', epoch: s.epoch, index: 0, moves: solution })
    expect(s.solution).toEqual(solution)
    expect(s.optimal).toBe(true)
    expect(wantsOptimal(s)).toBe(false)
    s = guideReducer(s, { type: 'MOVES_DONE', moves: ['F'] })
    expect(s.optimal).toBe(true)
    s = guideReducer(s, { type: 'MOVES_DONE', moves: ['B'] })
    expect(s.optimal).toBe(false)
    expect(wantsOptimal(s)).toBe(true)
  })

  it('drops an optimal result computed for a step the user already left', () => {
    let s = guiding()
    const at = { epoch: s.epoch, index: s.index }
    s = guideReducer(s, { type: 'MOVES_DONE', moves: ['F'] })
    expect(guideReducer(s, { type: 'OPTIMAL_FOUND', ...at, moves: solution })).toBe(s)
  })

  it('only searches when the remaining path is short enough, or at the start', () => {
    const scanned = run(SCAN_AND_CONFIRM)
    const long = parseAlgorithm("R U F' L2 D B' R2 U' F L D2 B R' U2 F2 L' D")
    let s = guideReducer(scanned, { type: 'SOLVED', epoch: scanned.epoch, moves: long, ms: 5 })
    expect(wantsOptimal(s)).toBe(true)
    s = guideReducer(s, { type: 'MOVES_DONE', moves: ['R'] })
    expect(s.solution.length - s.index).toBe(16)
    expect(wantsOptimal(s)).toBe(false)
    s = run([{ type: 'MOVES_DONE', moves: ['U'] }, { type: 'MOVES_DONE', moves: ["F'"] }], s)
    expect(wantsOptimal(s)).toBe(true)
  })

  it('going back from review keeps the same scan; a new scan gets a new id', () => {
    const reviewing = run([{ type: 'START_SCAN', purpose: 'initial' }, { type: 'SCANNED', cube: scrambled }])
    const back = guideReducer(reviewing, { type: 'BACK_TO_SCAN' })
    expect(back.phase).toBe('SCANNING')
    expect(back.scanId).toBe(reviewing.scanId)
    expect(guideReducer(back, { type: 'START_SCAN', purpose: 'initial' }).scanId).toBe(reviewing.scanId + 1)
  })

  it('confirming a solved scan completes right away', () => {
    const s = run([{ type: 'START_SCAN', purpose: 'initial' }, { type: 'SCANNED', cube: SOLVED }, { type: 'CONFIRM_REVIEW' }])
    expect(s.phase).toBe('COMPLETED')
  })
})

describe('half turns', () => {
  // Scramble R2 U, solution U' R2.
  function halfGuide(): GuideState {
    const s = run([{ type: 'START_SCAN', purpose: 'initial' }, { type: 'SCANNED', cube: applyMoves(SOLVED, parseAlgorithm('R2 U')) }, { type: 'CONFIRM_REVIEW' }])
    const g = guideReducer(s, { type: 'SOLVED', epoch: s.epoch, moves: parseAlgorithm("U' R2"), ms: 1 })
    return guideReducer(g, { type: 'MOVES_DONE', moves: ["U'"] })
  }

  for (const quarter of ['R', "R'"] as const) {
    it(`accepts R2 as ${quarter} ${quarter}`, () => {
      let s = guideReducer(halfGuide(), { type: 'MOVES_DONE', moves: [quarter] })
      expect(s.phase).toBe('GUIDING')
      expect(s.partial).toBe(quarter)
      expect(nextTurn(s)).toBe(quarter)
      s = guideReducer(s, { type: 'MOVES_DONE', moves: [quarter] })
      expect(s.phase).toBe('VERIFYING')
      expect(isSolved(s.cube!)).toBe(true)
    })
  }

  it('a quarter turned back starts the half turn over', () => {
    let s = guideReducer(halfGuide(), { type: 'MOVES_DONE', moves: ['R'] })
    s = guideReducer(s, { type: 'MOVES_DONE', moves: ["R'"] })
    expect(s.phase).toBe('GUIDING')
    expect(s.partial).toBeNull()
    expect(expectedMove(s)).toBe('R2')
  })

  it('another face after a quarter undoes both, then the half turn', () => {
    let s = guideReducer(halfGuide(), { type: 'MOVES_DONE', moves: ['R'] })
    s = guideReducer(s, { type: 'MOVES_DONE', moves: ['U'] })
    expect(s.phase).toBe('RECOVERING')
    expect(s.solution).toEqual(["U'", "R'", 'R2'])
    s = run(["U'", "R'", 'R2'].map((m) => ({ type: 'MOVES_DONE', moves: [m] }) as GuideEvent), s)
    expect(isSolved(s.cube!)).toBe(true)
  })
})

describe('reset and re-solve', () => {
  it('reset ends the guidance with a solved cube', () => {
    const s = guideReducer(guiding(), { type: 'RESET_SOLVED' })
    expect(s.phase).toBe('COMPLETED')
    expect(isSolved(s.cube!)).toBe(true)
    expect(s.history).toEqual([])
    expect(expectedMove(s)).toBeNull()
  })

  it('a new method solves the current cube again, dropping the old solution', () => {
    let s = guideReducer(guiding(), { type: 'MOVES_DONE', moves: ['F'] })
    const before = s.epoch
    s = guideReducer(s, { type: 'RESOLVE' })
    expect(s.phase).toBe('SOLVING')
    expect(needsSolve(s)).toBe(true)
    expect(s.epoch).toBeGreaterThan(before)
    expect(s.solution).toEqual([])
    expect(s.history).toEqual(['F'])
  })
})
