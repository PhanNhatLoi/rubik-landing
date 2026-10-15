import { describe, expect, it } from 'vitest'
import { applyMoves, equals, parseAlgorithm, SOLVED } from '../../smart-solver/core/cubie'
import { layerTurnToEvent, readOrientation } from '../../smart-solver/adapter/stickerModel'
import { CROSS, edgeDone } from '../../smart-solver/nxn/beginner'
import { buildCrossGuide, type CrossCase } from './crossGuide'
import { applyNotation, fromCubie, notationToTurn, toCubie } from './physical'

const NAMES = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }
const FACE_MOVES = ['U', 'D', 'R', 'L', 'F', 'B']
const SUFFIX = ['', "'", '2']

function rng(seed: number) {
  let s = seed
  return (n: number) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return (s >>> 8) % n
  }
}
function scramble(r: (n: number) => number, len: number) {
  const out: string[] = []
  let last = ''
  while (out.length < len) {
    const f = FACE_MOVES[r(6)]!
    if (f === last) continue
    last = f
    out.push(f + SUFFIX[r(3)])
  }
  return out.join(' ')
}

describe('slices', () => {
  it('physical slice turns agree with the app’s center-relative events', () => {
    for (const n of ['M', "M'", 'M2', 'E', "E'", 'S', "S'", 'S2']) {
      const turn = notationToTurn(n)
      const viaEvent = applyMoves(SOLVED, layerTurnToEvent(turn)!.moves)
      expect(equals(viaEvent, toCubie(applyNotation(fromCubie(SOLVED), n))!)).toBe(true)
    }
  })
})

describe('buildCrossGuide', () => {
  it('puts one more edge in place without breaking the others, tracking exactly like the app', () => {
    const r = rng(11)
    const kinds = new Set<CrossCase>()
    let guides = 0
    for (let i = 0; i < 600; i += 1) {
      const state = applyMoves(SOLVED, parseAlgorithm(scramble(r, 1 + r(10))))
      const todo = CROSS.filter((e) => !edgeDone(state, e))
      const guide = buildCrossGuide(state, NAMES)
      if (!todo.length) {
        expect(guide).toBeNull()
        continue
      }
      expect(guide).not.toBeNull()
      guides += 1
      kinds.add(guide!.kind)
      const placed = CROSS.filter((e) => edgeDone(state, e))

      let physical = fromCubie(state)
      let tracked = state
      expect(equals(guide!.states[0]!, state)).toBe(true)
      guide!.steps.forEach((step, k) => {
        const o = readOrientation(physical, (s) => s)!
        const event = layerTurnToEvent(notationToTurn(step.notation), o)!
        tracked = applyMoves(tracked, event.moves)
        physical = applyNotation(physical, step.notation)
        expect(equals(tracked, guide!.states[k + 1]!)).toBe(true)
        if (step.notation.endsWith('2')) {
          // A half turn is made of two quarters: after one, either way, the app must still recognise it.
          const quarters = [step.notation[0]!, `${step.notation[0]}'`].map((q) =>
            applyMoves(guide!.states[k]!, layerTurnToEvent(notationToTurn(q), o)!.moves)
          )
          expect(guide!.halves[k]!.length).toBe(2)
          for (const q of quarters) expect(guide!.halves[k]!.some((h) => equals(h, q))).toBe(true)
        } else expect(guide!.halves[k]).toEqual([])
        expect(step.why.length).toBeGreaterThan(10)
      })
      const end = guide!.states[guide!.states.length - 1]!
      expect(edgeDone(end, guide!.piece)).toBe(true)
      for (const e of placed) expect(edgeDone(end, e)).toBe(true)
      expect(guide!.steps.length).toBeLessThanOrEqual(8)
    }
    expect(guides).toBeGreaterThan(300)
    expect([...kinds].sort()).toEqual(['bottom', 'direct', 'middle', 'top'])
  })
})
