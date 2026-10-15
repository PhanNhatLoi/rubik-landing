import { describe, expect, it } from 'vitest'
import { applyMoves, equals, SOLVED } from '../../smart-solver/core/cubie'
import type { CubieState, Move } from '../../smart-solver/core/types'
import { LAST_EDGES_ORDER_CASES, generateLastEdgesCaseScramble, generateLastEdgesOrderScramble } from '../copy/lesson6'
import { lastEdgesDone } from './lastEdgesGuide'
import { buildLastEdgesOrderGuide, lastEdgesOrderChoices, lastEdgesOrderDone, lastEdgesOrderKey, lastEdgesOrderOptions } from './lastEdgesOrder'
import { topCrossDone } from '../goals'
import { locateOnGuide } from './follow'
import { applyNotation, fromCubie, toCubie } from './physical'

const NAMES = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }
const permutations = (xs: number[]): number[][] => xs.length ? xs.flatMap((x) => permutations(xs.filter((y) => y !== x)).map((p) => [x, ...p])) : [[]]

describe('lesson 6 cyclic order without center matching', () => {
  it('loads every selected combination with exactly the pictured edge positions and follows its chosen frames', () => {
    for (let index = 0; index < LAST_EDGES_ORDER_CASES.length; index += 1) {
      const c = LAST_EDGES_ORDER_CASES[index]!
      let previous: Move[] | undefined
      for (let i = 0; i < 30; i += 1) {
        const setup = generateLastEdgesCaseScramble(index, () => i / 30, previous)
        const start = applyMoves(SOLVED, setup)
        expect([5, 4, 7, 6].map((slot) => start.ep[slot])).toEqual(c.ring)
        expect(topCrossDone(start)).toBe(true)
        if (previous) expect(equals(start, applyMoves(SOLVED, previous))).toBe(false)
        for (const first of lastEdgesOrderChoices(c.state)) {
          const guide = buildLastEdgesOrderGuide(start, NAMES, first.front)!
          expect(guide.front).toBe(first.front)
          expect(guide.direction).toBe(first.direction)
          expect(guide.steps.map((step) => step.notation)).toEqual(first.moves)
          const after = guide.states.at(-1)!
          // The corner randomization cannot change the illustrated second-round choices.
          const picturedAfter = applyMoves(c.state, first.moves)
          expect(lastEdgesOrderChoices(after).map((v) => [v.front, v.direction])).toEqual(lastEdgesOrderChoices(picturedAfter).map((v) => [v.front, v.direction]))
          for (const second of lastEdgesOrderChoices(picturedAfter)) {
            const next = buildLastEdgesOrderGuide(after, NAMES, second.front)!
            expect(next.front).toBe(second.front)
            expect(next.steps.map((step) => step.notation)).toEqual(second.moves)
            expect(lastEdgesOrderDone(next.states.at(-1)!)).toBe(true)
          }
        }
        previous = setup
      }
    }
  })
  it('covers exactly six D-equivalent combinations: one ordered, four with two anchor choices, one requiring preparation', () => {
    expect(LAST_EDGES_ORDER_CASES).toHaveLength(6)
    expect(new Set(LAST_EDGES_ORDER_CASES.map((c) => lastEdgesOrderKey(c.state))).size).toBe(6)
    expect(LAST_EDGES_ORDER_CASES.map((c) => c.rounds).sort()).toEqual([0, 1, 1, 1, 1, 2])
    for (const c of LAST_EDGES_ORDER_CASES) {
      expect(equals(c.state, applyMoves(SOLVED, c.setup))).toBe(true)
      expect(topCrossDone(c.state)).toBe(true)
      for (const d of [[], ['D'], ["D'"], ['D2']] as Move[][]) expect(lastEdgesOrderKey(applyMoves(c.state, d))).toBe(lastEdgesOrderKey(c.state))
      if (c.rounds !== 1) continue
      const options = lastEdgesOrderOptions(c.state)
      expect(options).toHaveLength(2)
      expect(new Set(options.map((v) => v.front)).size).toBe(2)
      for (const v of options) expect(lastEdgesOrderDone(applyMoves(c.state, v.moves))).toBe(true)
    }
  })

  it('validates every selectable anchor and solves all 24 permutations in two formula rounds plus final D alignment', () => {
    const seen = new Map<string, number>()
    for (const p of permutations([4, 5, 6, 7])) {
      const parity = p.reduce((n, x, i) => n + p.slice(i + 1).filter((y) => x > y).length, 0) % 2
      let state: CubieState = { ...SOLVED, ep: [...SOLVED.ep.slice(0, 4), ...p, ...SOLVED.ep.slice(8)], cp: parity ? [0, 1, 2, 3, 5, 4, 6, 7] : SOLVED.cp }
      const key = lastEdgesOrderKey(state)
      seen.set(key, (seen.get(key) ?? 0) + 1)
      const direct = lastEdgesOrderOptions(state)
      for (const v of lastEdgesOrderChoices(state)) {
        const after = applyMoves(state, v.moves)
        expect(topCrossDone(after)).toBe(true)
        expect(after.ep[v.anchor]).toBe(state.ep[v.anchor])
        if (direct.length) expect(lastEdgesOrderDone(after)).toBe(true)
        else expect(lastEdgesOrderOptions(after)).toHaveLength(2)
        expect(buildLastEdgesOrderGuide(state, NAMES, v.front)!.front).toBe(v.front)
      }
      let rounds = 0
      for (let j = 0; j < 3 && !lastEdgesDone(state); j += 1) {
        const guide = buildLastEdgesOrderGuide(state, NAMES)!
        expect(guide).not.toBeNull()
        if (guide.kind !== 'align') rounds += 1
        let physical = fromCubie(state)
        for (let i = 0; i < guide.steps.length; i += 1) {
          const move = guide.steps[i]!.notation
          expect(locateOnGuide(guide, guide.states[i]!)).toEqual({ kind: 'step', index: i, quarterDone: false })
          if (move.endsWith('2')) for (const half of guide.halves[i]!) expect(locateOnGuide(guide, half)).toEqual({ kind: 'step', index: i, quarterDone: true })
          physical = applyNotation(physical, move)
          expect(equals(toCubie(physical)!, guide.states[i + 1]!)).toBe(true)
        }
        state = guide.states.at(-1)!
        expect(topCrossDone(state)).toBe(true)
        expect(locateOnGuide(guide, state)).toEqual({ kind: 'done' })
      }
      expect(rounds).toBeLessThanOrEqual(2)
      expect(lastEdgesDone(state)).toBe(true)
    }
    expect([...seen.values()]).toEqual([4, 4, 4, 4, 4, 4])
  })

  it('generates valid practice states for the new order-based levels and always rerolls a different cube', () => {
    let seed = 13
    const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 }
    for (const level of ['easy', 'medium', 'hard'] as const) {
      let previous: Move[] | undefined
      for (let i = 0; i < 40; i += 1) {
        const setup = generateLastEdgesOrderScramble(level, rng, previous)
        let state = applyMoves(SOLVED, setup)
        if (previous) expect(equals(state, applyMoves(SOLVED, previous))).toBe(false)
        expect(topCrossDone(state)).toBe(true)
        expect(lastEdgesDone(state)).toBe(false)
        let rounds = 0
        for (let j = 0; j < 3 && !lastEdgesDone(state); j += 1) {
          const guide = buildLastEdgesOrderGuide(state, NAMES)!
          if (guide.kind !== 'align') rounds += 1
          state = guide.states.at(-1)!
        }
        expect(rounds).toBe(level === 'easy' ? 0 : level === 'medium' ? 1 : 2)
        expect(lastEdgesDone(state)).toBe(true)
        previous = setup
      }
    }
  })
})
