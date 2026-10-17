import { rotateGridIndex, rotateStickers, type Axis, type Stickers } from '../../rubikLogic'
import { fromFacelets, toFacelets } from '../../smart-solver/core'
import { moveToLayerTurn, faceletsToStickerMap, readOrientation, stickerModelToFacelets, type LayerTurn, type StickerCubie } from '../../smart-solver/adapter/stickerModel'
import type { CubieState, Face, Move } from '../../smart-solver/core/types'

/**
 * The cube as it physically is: every sticker keeps the face letter of the center it came with, and
 * turns act on fixed positions (the bottom layer stays the bottom layer even after a slice turn
 * moved the centers). This is how a learner thinks of "D2" in the middle of "M D2 M'".
 */
export type Physical = StickerCubie<Face>[]

export function fromCubie(state: CubieState): Physical {
  return fromFacelets54(toFacelets(state))
}

/** The cube drawn by a facelet string, with the centers at home. */
export function fromFacelets54(facelets: string): Physical {
  const map = faceletsToStickerMap(facelets)
  const cubies: Physical = []
  for (let x = 0; x < 3; x += 1) {
    for (let y = 0; y < 3; y += 1) {
      for (let z = 0; z < 3; z += 1) {
        const stickers = map.get(`${x},${y},${z}`) ?? { px: null, nx: null, py: null, ny: null, pz: null, nz: null }
        cubies.push({ grid: { x, y, z }, stickers: { ...stickers } as Stickers<Face> })
      }
    }
  }
  return cubies
}

export function turn(cubies: Physical, t: LayerTurn): Physical {
  const dir = Math.sign(t.steps)
  const times = Math.abs(t.steps)
  let next = cubies
  for (let i = 0; i < times; i += 1) {
    next = next.map((c) =>
      c.grid[t.axis as Axis] === t.layer
        ? { grid: rotateGridIndex(c.grid, t.axis as Axis, dir, 3), stickers: rotateStickers(c.stickers, t.axis as Axis, dir) }
        : c
    )
  }
  return next
}

/** Center-relative state of the physical cube (what the rest of the app tracks), or null if invalid. */
export function toCubie(cubies: Physical): CubieState | null {
  const result = fromFacelets(stickerModelToFacelets(cubies, (s) => s))
  return result.ok ? result.state : null
}

/** Where the cube's centers are: false once a slice turn has moved them. */
export function centersHome(cubies: Physical): boolean {
  const o = readOrientation(cubies, (s) => s)
  return !!o && o.r[0] === 1 && o.u[1] === 1 && o.f[2] === 1
}

/** Fixed-position notation: faces U R F D L B, slices M E S, each with ' or 2. */
export function notationToTurn(notation: string): LayerTurn {
  const letter = notation[0] as string
  const suffix = notation.slice(1)
  const quarter = suffix === "'" ? -1 : suffix === '2' ? 2 : 1
  if (letter === 'M') return { axis: 'x', layer: 1, steps: quarter }
  if (letter === 'E') return { axis: 'y', layer: 1, steps: quarter }
  if (letter === 'S') return { axis: 'z', layer: 1, steps: -quarter }
  return moveToLayerTurn(notation as Move)
}

export function applyNotation(cubies: Physical, notation: string): Physical {
  return turn(cubies, notationToTurn(notation))
}

/** The corner piece with these three sticker colors, with where its stickers are. */
export function findCorner(cubies: Physical, colors: readonly Face[]) {
  for (const c of cubies) {
    const entries = Object.entries(c.stickers).filter(([, v]) => v != null) as [keyof Stickers<Face>, Face][]
    if (entries.length !== 3) continue
    if (colors.every((f) => entries.some(([, v]) => v === f))) {
      return { grid: c.grid, keyOf: (f: Face) => entries.find(([, v]) => v === f)![0] }
    }
  }
  return null
}

/** The piece with exactly these two sticker colors, with where its stickers are. */
export function findEdge(cubies: Physical, a: Face, b: Face) {
  for (const c of cubies) {
    const entries = Object.entries(c.stickers).filter(([, v]) => v != null) as [keyof Stickers<Face>, Face][]
    if (entries.length !== 2) continue
    const faces = entries.map(([, v]) => v)
    if (faces.includes(a) && faces.includes(b)) {
      const keyOf = (f: Face) => entries.find(([, v]) => v === f)![0]
      return { grid: c.grid, keyOf }
    }
  }
  return null
}
