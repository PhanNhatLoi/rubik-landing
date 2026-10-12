import { describe, expect, it } from 'vitest'
import { rotateGridIndex, rotateStickers, type Stickers } from '../../rubikLogic'
import { getEngine } from '../nxn/engine'
import { layerTurnToToken, sceneToStickers, stickersToScene, tokenToLayerTurn, type MultiLayerTurn } from './nxnModel'
import type { StickerCubie } from './stickerModel'

function sceneOf(stickers: Uint8Array, n: number): StickerCubie<number>[] {
  return [...stickersToScene(stickers, n)].map(([k, s]) => {
    const [x, y, z] = k.split(',').map(Number) as [number, number, number]
    return { grid: { x, y, z }, stickers: s }
  })
}

/** The same steps App.jsx takes when it finishes a turn. */
function turnScene(cubies: StickerCubie<number>[], turn: MultiLayerTurn, n: number): StickerCubie<number>[] {
  return cubies.map((c) => {
    if (!turn.layers.includes(c.grid[turn.axis])) return c
    let { grid, stickers } = c
    const dir = Math.sign(turn.steps)
    for (let i = 0; i < Math.abs(turn.steps); i += 1) {
      grid = rotateGridIndex(grid, turn.axis, dir, n)
      stickers = rotateStickers(stickers, turn.axis, dir) as Stickers<number>
    }
    return { grid, stickers }
  })
}

describe('nxnModel', () => {
  for (const n of [2, 3, 4, 5]) {
    it(`scene turns match the ${n}x${n} engine`, () => {
      const e = getEngine(n)
      const tokens = ['U', "R'", 'F2', 'D', 'L', "B'", 'x', "y'", 'z2']
      if (n >= 3) tokens.push('2R', "2U'", '2F2')
      if (n >= 4) tokens.push('Rw', "Uw'", 'r2', '3Rw', '3L')
      let stickers = e.solved()
      for (let k = 0; k < 40; k += 1) stickers = e.apply(stickers, tokens[(k * 7) % tokens.length] as string)
      for (const token of tokens) {
        const viaScene = sceneToStickers(turnScene(sceneOf(stickers, n), tokenToLayerTurn(token, n), n), n, (s) => s)
        expect(Array.from(viaScene), token).toEqual(Array.from(e.apply(stickers, token)))
      }
    })

    it(`dragged layers on ${n}x${n} read back as the same turn`, () => {
      const e = getEngine(n)
      const start = e.apply(e.apply(e.solved(), 'R'), 'U')
      for (const axis of ['x', 'y', 'z'] as const) {
        for (let layer = 0; layer < n; layer += 1) {
          for (const steps of [1, -1, 2]) {
            const token = layerTurnToToken({ axis, layer, steps }, n) as string
            const viaScene = sceneToStickers(turnScene(sceneOf(start, n), { axis, layers: [layer], steps }, n), n, (s) => s)
            expect(Array.from(viaScene), token).toEqual(Array.from(e.apply(start, token)))
          }
        }
      }
    })
  }
})
