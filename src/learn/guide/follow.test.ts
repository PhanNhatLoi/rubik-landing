import { describe, expect, it } from 'vitest'
import { applyMoves, invertMove, SOLVED } from '../../smart-solver/core/cubie'
import type { Move } from '../../smart-solver/core/types'
import { buildCrossGuide } from './crossGuide'
import { locateOnGuide } from './follow'

const NAMES = { U: 'a', D: 'b', F: 'c', B: 'd', R: 'e', L: 'f' }

describe('locateOnGuide', () => {
  const start = applyMoves(SOLVED, ['F', 'R', "U'", 'B2'] as Move[])
  const guide = buildCrossGuide(start, NAMES)!

  it('knows every step of the path, the end, and a quarter of a half turn', () => {
    expect(locateOnGuide(guide, guide.states[0]!)).toEqual({ kind: 'step', index: 0, quarterDone: false })
    expect(locateOnGuide(guide, guide.states[guide.steps.length]!)).toEqual({ kind: 'done' })
    guide.halves.forEach((h, k) => h.forEach((q) => expect(locateOnGuide(guide, q)).toEqual({ kind: 'step', index: k, quarterDone: true })))
  })

  it('a wrong turn goes off the path, and undoing it comes back to the same step', () => {
    for (let k = 0; k < guide.steps.length; k += 1) {
      const here = guide.states[k]!
      for (const wrong of ['L', "R'", 'B2'] as Move[]) {
        const off = applyMoves(here, [wrong])
        if (locateOnGuide(guide, off).kind !== 'off') continue
        const back = applyMoves(off, [invertMove(wrong)])
        expect(locateOnGuide(guide, back)).toEqual({ kind: 'step', index: k, quarterDone: false })
      }
    }
  })
})

describe('undo token', () => {
  it('turns the same layer back, for faces and slices', async () => {
    const { layerTurnToToken, tokenToLayerTurn, inverseToken } = await import('../../smart-solver/adapter/nxnModel')
    for (const axis of ['x', 'y', 'z'] as const) {
      for (const layer of [0, 1, 2]) {
        for (const steps of [1, -1, 2]) {
          const token = layerTurnToToken({ axis, layer, steps }, 3)!
          const turn = tokenToLayerTurn(token, 3)
          const back = tokenToLayerTurn(inverseToken(token), 3)
          expect(back.axis).toBe(turn.axis)
          expect(back.layers).toEqual(turn.layers)
          expect(((back.steps + turn.steps) % 4 + 4) % 4).toBe(0)
        }
      }
    }
  })
})
