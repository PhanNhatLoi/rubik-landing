import { describe, expect, it } from 'vitest'
import { applyMoves, equals, parseAlgorithm, SOLVED } from '../../smart-solver/core/cubie'
import { f2lDone, topCrossDone } from '../../smart-solver/nxn/beginner'
import { layerTurnToEvent, readOrientation } from '../../smart-solver/adapter/stickerModel'
import { generateTopCrossScramble, getLesson5Pages, topCrossPracticeRoute, TOP_CROSS_LEVELS, TOP_CROSS_PICTURE_SCRAMBLE } from '../copy/lesson5'
import { buildTopCrossGuide, topCrossPattern, TOP_CROSS_ALG, TOP_CROSS_L_ALG, BOTTOM_CROSS_L_ALG, type TopCrossMethod, type TopCrossPattern } from './topCrossGuide'
import { applyNotation, fromCubie, notationToTurn } from './physical'
import { locateOnGuide } from './follow'
import { edgeCell } from '../cells'
import { getEngine } from '../../smart-solver/nxn/engine'
import { fromFacelets, toFacelets } from '../../smart-solver/core/facelets'
import { FACES } from '../../smart-solver/core/types'

const NAMES = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }
function rng(seed: number) {
  let s = seed
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32 }
}

describe('lesson 5 top cross', () => {
  it('recognises every legal orientation pattern independently of edge permutation and corner orientation', () => {
    for (let mask = 0; mask < 16; mask += 1) {
      const eo = [0, 1, 2, 3].map((i) => (mask >> i) & 1)
      if (eo.reduce((a, b) => a + b, 0) % 2) continue
      const state = { ...SOLVED, eo: [...eo, ...SOLVED.eo.slice(4)] }
      const count = eo.filter((o) => o === 0).length
      expect(topCrossPattern(state)).toBe(count === 4 ? 'cross' : count === 0 ? 'dot' : eo[0] === eo[2] ? 'line' : 'elbow')
      if (count === 4) continue
      for (const method of ['single', 'dual'] as const) expect(buildTopCrossGuide(state, NAMES, method)).not.toBeNull()
    }
    const u = applyMoves(SOLVED, ['U'])
    expect(topCrossDone(u)).toBe(true)
    expect(buildTopCrossGuide(u, NAMES)).toBeNull()
  })

  it.each(['single', 'dual'] as const)('follows the %s method on 300 cubes, preserving lower layers and undo recovery', (method: TopCrossMethod) => {
    const random = rng(31)
    const patterns = new Set<TopCrossPattern>()
    for (let i = 0; i < 300; i += 1) {
      const level = TOP_CROSS_LEVELS[i % 3]!
      const setup = generateTopCrossScramble(level.id, random)
      let state = applyMoves(SOLVED, setup)
      expect(f2lDone(state)).toBe(true)
      expect(topCrossPattern(state)).toBe(level.pattern)
      // Mix top corner orientation and top permutation independently of the sample catalog.
      if (i % 2 === 0) state = applyMoves(state, parseAlgorithm("R U R' U R U2 R'"))
      expect(equals(state, applyMoves(SOLVED, generateTopCrossScramble(level.id, random, setup)))).toBe(false)
      const rounds = method === 'single'
        ? { line: 1, elbow: 2, dot: 3, cross: 0 }[topCrossPattern(state)]
        : { line: 1, elbow: 1, dot: 2, cross: 0 }[topCrossPattern(state)]
      for (let round = 0; round < rounds; round += 1) {
        const guide = buildTopCrossGuide(state, NAMES, method)
        expect(guide).not.toBeNull()
        if (!guide) throw new Error('Missing guide')
        patterns.add(guide.kind)
        expect(guide.method).toBe(method)
        const algorithm = method === 'dual' && guide.kind !== 'line' ? TOP_CROSS_L_ALG : TOP_CROSS_ALG
        expect(guide.steps.slice(-algorithm.length).map((step) => step.notation)).toEqual(algorithm)
        expect(guide.formula).toBe(algorithm.join(' ').replaceAll("'", '′'))
        expect(guide.intro).toContain(guide.formula)
        expect(guide.next).toBe(guide.kind === 'dot' ? 'elbow' : guide.kind === 'elbow' && method === 'single' ? 'line' : 'cross')
        const aligned = guide.steps.length > algorithm.length ? guide.states[1]! : state
        if (guide.kind === 'line') expect([0, 2].every((slot) => aligned.eo[slot] === 0)).toBe(true)
        if (guide.kind === 'elbow') expect((method === 'dual' ? [0, 3] : [2, 3]).every((slot) => aligned.eo[slot] === 0)).toBe(true)
        expect(guide.steps.length).toBeLessThanOrEqual(algorithm.length + 1)
        let physical = fromCubie(state)
        let tracked = state
        for (let k = 0; k < guide.steps.length; k += 1) {
          const step = guide.steps[k]!
          expect(step.why.length).toBeGreaterThan(20)
          expect(guide.marks[k]).toEqual([[1, 2, 1], edgeCell(tracked.ep.indexOf(guide.piece))])
          if (step.notation.endsWith('2')) {
            expect(guide.halves[k]).toHaveLength(2)
            for (const half of guide.halves[k]!) expect(locateOnGuide(guide, half)).toEqual({ kind: 'step', index: k, quarterDone: true })
          }
          const orientation = readOrientation(physical, (s) => s)!
          tracked = applyMoves(tracked, layerTurnToEvent(notationToTurn(step.notation), orientation)!.moves)
          physical = applyNotation(physical, step.notation)
          expect(equals(tracked, guide.states[k + 1]!)).toBe(true)
          expect(locateOnGuide(guide, guide.states[k]!)).toEqual({ kind: 'step', index: k, quarterDone: false })
        }
        state = guide.states.at(-1)!
        expect(f2lDone(state)).toBe(true)
        expect(topCrossPattern(state)).toBe(guide.next)
        expect(state.eo[state.ep.indexOf(guide.piece)]).toBe(0)
        expect(locateOnGuide(guide, state)).toEqual({ kind: 'done' })
        expect(locateOnGuide(guide, applyMoves(guide.states[0]!, ['D']))).toEqual({ kind: 'off' })
      }
      expect(topCrossDone(state)).toBe(true)
    }
    expect([...patterns].sort()).toEqual(['dot', 'elbow', 'line'])
  })

  it('teaches the chosen formulas and accurately describes both routes from dot', () => {
    expect(getLesson5Pages(null).some((p) => p.id === 'formula')).toBe(false)
    const single = getLesson5Pages('single').find((p) => p.id === 'formula')!
    const dual = getLesson5Pages('dual').find((p) => p.id === 'formula')!
    expect(single.formulas?.map((f) => f.formula)).toEqual(['F R U R′ U′ F′'])
    expect(dual.formulas?.map((f) => f.formula)).toEqual(['F R U R′ U′ F′', 'L′ B′ U B L F U′ F′'])
    expect(single.body.join(' ')).toContain('Tổng cộng 3 lượt')
    expect(dual.body.join(' ')).toContain('Tổng cộng 2 lượt')
    expect(topCrossPracticeRoute('medium', 'single')).toBe('Chữ L → hai cạnh đối → dấu cộng · 2 lượt')
    expect(topCrossPracticeRoute('medium', 'dual')).toBe('Chữ L → dấu cộng · 1 lượt')
    expect(topCrossPracticeRoute('hard', 'single')).toBe('Chấm → chữ L → hai cạnh đối → dấu cộng · 3 lượt')
    expect(topCrossPracticeRoute('hard', 'dual')).toBe('Chấm → chữ L → dấu cộng · 2 lượt')
  })

  it('uses the user formula as a proper whole-cube reorientation, with no change to the line formula', () => {
    expect(BOTTOM_CROSS_L_ALG).toEqual(["L'", "F'", 'D', 'F', 'L', 'B', "D'", "B'"])
    expect(TOP_CROSS_ALG).toEqual(['F', 'R', 'U', "R'", "U'", "F'"])
    const engine = getEngine(3)
    const flipped = engine.applyAll(engine.solved(), ['x2', ...BOTTOM_CROSS_L_ALG, 'x2'])
    expect(Array.from(flipped, (n) => FACES[n]).join('')).toBe(toFacelets(applyMoves(SOLVED, TOP_CROSS_L_ALG)))
    const card = getLesson5Pages('dual').find((p) => p.id === 'formula')!.formulas![1]!
    expect(card.source).toContain('L′ F′ D F L B D′ B′')
    expect(card.alignment).toContain('UB và UR')
  })

  it('replays the supplied bottom-face log and keeps its two completed upper layers', () => {
    const start = fromFacelets('UUUUUUUUURRRRRRFBBFFFFFFFLLRDDFDDRRDLLLLLLDDDBBBBBBLDB')
    if (!start.ok) throw new Error('Invalid supplied cube')
    const end = applyMoves(start.state, BOTTOM_CROSS_L_ALG)
    expect(equals(end, SOLVED)).toBe(true)
    const upperTwo = (state: typeof SOLVED) => [0, 1, 2, 3].every((i) => state.cp[i] === i && state.co[i] === 0 && state.ep[i] === i && state.eo[i] === 0) && [8, 9, 10, 11].every((i) => state.ep[i] === i && state.eo[i] === 0)
    // Exhaust the eight legal bottom-edge orientation patterns, independent of the log's corner case.
    for (let mask = 0; mask < 16; mask += 1) {
      const orientations = [0, 1, 2, 3].map((i) => (mask >> i) & 1)
      if (orientations.reduce((a, b) => a + b, 0) % 2) continue
      const cube = { ...SOLVED, eo: [...SOLVED.eo.slice(0, 4), ...orientations, ...SOLVED.eo.slice(8)] }
      expect(upperTwo(applyMoves(cube, BOTTOM_CROSS_L_ALG))).toBe(true)
    }
  })

  it('uses the new L formula twice from dot without any alignment in between', () => {
    const state = applyMoves(SOLVED, TOP_CROSS_PICTURE_SCRAMBLE)
    const first = buildTopCrossGuide(state, NAMES, 'dual')!
    expect(first.steps.map((s) => s.notation)).toEqual(TOP_CROSS_L_ALG)
    const second = buildTopCrossGuide(first.states.at(-1)!, NAMES, 'dual')!
    expect(second.steps.map((s) => s.notation)).toEqual(TOP_CROSS_L_ALG)
    expect(topCrossDone(second.states.at(-1)!)).toBe(true)
  })

  it('rejects unfinished lower layers and uses an actual dot for the before picture', () => {
    expect(buildTopCrossGuide(applyMoves(SOLVED, parseAlgorithm('R')), NAMES)).toBeNull()
    const before = applyMoves(SOLVED, TOP_CROSS_PICTURE_SCRAMBLE)
    expect(f2lDone(before)).toBe(true)
    expect(topCrossPattern(before)).toBe('dot')
  })
})
