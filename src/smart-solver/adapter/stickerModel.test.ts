import { describe, expect, it } from 'vitest'
import { rotateGridIndex, rotateStickers, type Stickers } from '../../rubikLogic'
import { MOVES, SOLVED, SOLVED_FACELETS, applyMoves, fromFacelets, toFacelets, type Face, type Move } from '../core'
import {
  faceletsToStickerMap,
  gridKey,
  layerTurnToEvent,
  moveToLayerTurn,
  readOrientation,
  stickerModelToFacelets,
  type LayerTurn,
  type StickerCubie
} from './stickerModel'

const SIZE = 3

// Mirrors createCubie in App.jsx: +x R, -x L, +y U, -y D, +z F, -z B.
function solvedSceneModel(): StickerCubie<Face>[] {
  const cubies: StickerCubie<Face>[] = []
  for (let x = 0; x < SIZE; x += 1) {
    for (let y = 0; y < SIZE; y += 1) {
      for (let z = 0; z < SIZE; z += 1) {
        const stickers: Stickers<Face> = {
          px: x === SIZE - 1 ? 'R' : null,
          nx: x === 0 ? 'L' : null,
          py: y === SIZE - 1 ? 'U' : null,
          ny: y === 0 ? 'D' : null,
          pz: z === SIZE - 1 ? 'F' : null,
          nz: z === 0 ? 'B' : null
        }
        cubies.push({ grid: { x, y, z }, stickers })
      }
    }
  }
  return cubies
}

// Mirrors App.jsx attachLayerByIndex + applyRotationToState.
function applySceneTurn(cubies: StickerCubie<Face>[], turn: LayerTurn): StickerCubie<Face>[] {
  const { axis, layer, steps } = turn
  const dir = Math.sign(steps)
  return cubies.map((c) => {
    if (c.grid[axis] !== layer) return c
    let { grid, stickers } = c
    for (let i = 0; i < Math.abs(steps); i += 1) {
      grid = rotateGridIndex(grid, axis, dir, SIZE)
      stickers = rotateStickers(stickers, axis, dir)
    }
    return { grid, stickers }
  })
}

const applySceneMove = (cubies: StickerCubie<Face>[], move: Move) => applySceneTurn(cubies, moveToLayerTurn(move))

const identity = (f: Face) => f

function randomMoves(n: number, seed: number): Move[] {
  let s = seed
  return Array.from({ length: n }, () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return MOVES[Math.floor((s / 2147483648) * MOVES.length)] as Move
  })
}

describe('scene model ↔ facelets', () => {
  it('solved scene reads as solved facelets', () => {
    expect(stickerModelToFacelets(solvedSceneModel(), identity)).toBe(SOLVED_FACELETS)
  })

  it('every single move matches the cubie model', () => {
    for (const m of MOVES) {
      const scene = applySceneMove(solvedSceneModel(), m)
      expect(stickerModelToFacelets(scene, identity), m).toBe(toFacelets(applyMoves(SOLVED, [m])))
    }
  })

  it('random sequences match the cubie model', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const seq = randomMoves(30, seed)
      const scene = seq.reduce(applySceneMove, solvedSceneModel())
      expect(stickerModelToFacelets(scene, identity)).toBe(toFacelets(applyMoves(SOLVED, seq)))
    }
  })

  it('faceletsToStickerMap is the inverse of stickerModelToFacelets', () => {
    const f = toFacelets(applyMoves(SOLVED, randomMoves(25, 7)))
    const map = faceletsToStickerMap(f)
    expect(map.size).toBe(26)
    const cubies = [...map.entries()].map(([k, stickers]) => {
      const [x, y, z] = k.split(',').map(Number) as [number, number, number]
      return { grid: { x, y, z }, stickers }
    })
    expect(stickerModelToFacelets(cubies, identity)).toBe(f)
    expect(map.get(gridKey({ x: 1, y: 1, z: 1 }))).toBeUndefined()
  })
})

function randomTurns(n: number, seed: number): LayerTurn[] {
  let s = seed
  const next = () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
  return Array.from({ length: n }, () => ({
    axis: (['x', 'y', 'z'] as const)[Math.floor(next() * 3)] as 'x' | 'y' | 'z',
    layer: Math.floor(next() * 3),
    steps: ([1, -1, 2] as const)[Math.floor(next() * 3)] as number
  }))
}

describe('move ↔ layer turn', () => {
  it('round-trips all 18 moves', () => {
    for (const m of MOVES) expect(layerTurnToEvent(moveToLayerTurn(m))).toEqual({ notation: m, moves: [m] })
  })

  it('maps R to -90° on the +x outer layer', () => {
    expect(moveToLayerTurn('R')).toEqual({ axis: 'x', layer: 2, steps: -1 })
    expect(moveToLayerTurn("R'")).toEqual({ axis: 'x', layer: 2, steps: 1 })
    expect(moveToLayerTurn('L')).toEqual({ axis: 'x', layer: 0, steps: 1 })
  })

  it('reports slices with their notation and equivalent face moves', () => {
    expect(layerTurnToEvent({ axis: 'y', layer: 1, steps: 1 })).toEqual({ notation: 'E', moves: ['U', "D'"] })
    expect(layerTurnToEvent({ axis: 'y', layer: 1, steps: -1 })).toEqual({ notation: "E'", moves: ["U'", 'D'] })
    expect(layerTurnToEvent({ axis: 'x', layer: 1, steps: 1 })).toEqual({ notation: 'M', moves: ['R', "L'"] })
    expect(layerTurnToEvent({ axis: 'z', layer: 1, steps: -1 })).toEqual({ notation: 'S', moves: ["F'", 'B'] })
    expect(layerTurnToEvent({ axis: 'x', layer: 1, steps: 2 })).toEqual({ notation: 'M2', moves: ['R2', 'L2'] })
  })

  it('returns null for zero turns', () => {
    expect(layerTurnToEvent({ axis: 'y', layer: 2, steps: 0 })).toBeNull()
    expect(layerTurnToEvent({ axis: 'y', layer: 1, steps: 0 })).toBeNull()
  })
})

describe('turns that move the centers', () => {
  it('tracks random face and slice turns relative to the centers', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      let scene = solvedSceneModel()
      let state = SOLVED
      for (const turn of randomTurns(30, seed)) {
        const o = readOrientation(scene, identity)
        expect(o).not.toBeNull()
        const event = layerTurnToEvent(turn, o ?? undefined)
        scene = applySceneTurn(scene, turn)
        state = applyMoves(state, event?.moves ?? [])
      }
      const facelets = stickerModelToFacelets(scene, identity)
      expect(facelets).toBe(toFacelets(state))
      expect(fromFacelets(facelets).ok).toBe(true)
    }
  })

  it('plays center-relative moves correctly after the centers moved', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      // Rotate the centers with a few slices, then play moves through the orientation.
      let scene = randomTurns(6, seed)
        .map((t) => ({ ...t, layer: 1 }))
        .reduce(applySceneTurn, solvedSceneModel())
      let state = fromFacelets(stickerModelToFacelets(scene, identity))
      expect(state.ok).toBe(true)
      if (!state.ok) continue
      let s = state.state
      for (const m of randomMoves(20, seed + 1000)) {
        const o = readOrientation(scene, identity) ?? undefined
        scene = applySceneTurn(scene, moveToLayerTurn(m, o))
        s = applyMoves(s, [m])
      }
      expect(stickerModelToFacelets(scene, identity)).toBe(toFacelets(s))
    }
  })
})
