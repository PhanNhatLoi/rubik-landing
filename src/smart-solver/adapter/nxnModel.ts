import type { Axis, Grid, StickerKey, Stickers } from '../../rubikLogic'
import { getEngine, parseTurn, type FaceName } from '../nxn/engine'
import { gridKey, type StickerCubie } from './stickerModel'

/**
 * N×N cubes in the scene frame (U = +y, R = +x, F = +z, never re-read from centers: even cubes
 * have none). Sticker labels are face indices in URFDLB order, as in nxn/engine.
 */

/** One animated turn: these layers of an axis together, `steps` quarter turns about +axis. */
export interface MultiLayerTurn {
  axis: Axis
  layers: number[]
  steps: number
}

const FACE_AXIS: Record<FaceName, { axis: Axis; positive: boolean }> = {
  U: { axis: 'y', positive: true },
  D: { axis: 'y', positive: false },
  R: { axis: 'x', positive: true },
  L: { axis: 'x', positive: false },
  F: { axis: 'z', positive: true },
  B: { axis: 'z', positive: false }
}

const AXIS_FACES: Record<Axis, [FaceName, FaceName]> = { x: ['R', 'L'], y: ['U', 'D'], z: ['F', 'B'] }

const KEY_OF_NORMAL: Record<string, StickerKey> = {
  '1,0,0': 'px',
  '-1,0,0': 'nx',
  '0,1,0': 'py',
  '0,-1,0': 'ny',
  '0,0,1': 'pz',
  '0,0,-1': 'nz'
}

/** Scene turn for a move token of the n×n engine (outer, inner kX, wide Xw/kXw, x y z). */
export function tokenToLayerTurn(token: string, n: number): MultiLayerTurn {
  const parsed = parseTurn(token, n)
  const all = Array.from({ length: n }, (_, i) => i)
  if ('rotation' in parsed) {
    const axis = (['x', 'y', 'z'] as const)[parsed.rotation]
    // x, y, z follow R, U, F: clockwise seen from the positive face.
    return { axis, layers: all, steps: parsed.turns === 2 ? -2 : parsed.turns === 1 ? -1 : 1 }
  }
  const { axis, positive } = FACE_AXIS[parsed.face]
  const layers: number[] = []
  for (let d = parsed.from; d <= parsed.to; d += 1) layers.push(positive ? n - d : d - 1)
  // Clockwise seen from the face is -90° about its outward normal.
  const cw = positive ? -1 : 1
  return { axis, layers, steps: parsed.turns === 2 ? cw * 2 : parsed.turns === 1 ? cw : -cw }
}

/** Token for one dragged layer, named from the nearer face (5x5 middle layer from R, U, F). */
export function layerTurnToToken(turn: { axis: Axis; layer: number; steps: number }, n: number): string | null {
  const steps = ((turn.steps % 4) + 4) % 4
  if (!steps) return null
  const [pos, neg] = AXIS_FACES[turn.axis]
  const fromPositive = turn.layer >= (n - 1) / 2
  const depth = fromPositive ? n - turn.layer : turn.layer + 1
  // Steps about +axis seen from the named face: positive face → -1 is clockwise.
  const cwSteps = fromPositive ? (4 - steps) % 4 : steps
  const suffix = cwSteps === 1 ? '' : cwSteps === 2 ? '2' : "'"
  return `${depth === 1 ? '' : depth}${fromPositive ? pos : neg}${suffix}`
}

/** Reads the scene as engine stickers; `toLabel` maps a sticker color to its face index (or -1). */
export function sceneToStickers<T>(cubies: readonly StickerCubie<T>[], n: number, toLabel: (sticker: T) => number): Uint8Array {
  const e = getEngine(n)
  const byGrid = new Map(cubies.map((c) => [gridKey(c.grid), c]))
  const out = new Uint8Array(e.stickers)
  for (let i = 0; i < e.stickers; i += 1) {
    const p = e.position[i] as readonly number[]
    const key = KEY_OF_NORMAL[(e.normal[i] as readonly number[]).join(',')] as StickerKey
    const sticker = byGrid.get(`${p[0]},${p[1]},${p[2]}`)?.stickers[key]
    const label = sticker == null ? -1 : toLabel(sticker)
    out[i] = label < 0 ? 255 : label
  }
  return out
}

/** Sticker labels for every outer grid position, keyed by "x,y,z". */
export function stickersToScene(stickers: Uint8Array, n: number): Map<string, Stickers<number>> {
  const e = getEngine(n)
  const map = new Map<string, Stickers<number>>()
  for (let i = 0; i < e.stickers; i += 1) {
    const p = e.position[i] as readonly number[]
    const grid: Grid = { x: p[0] as number, y: p[1] as number, z: p[2] as number }
    const k = gridKey(grid)
    const entry = map.get(k) ?? { px: null, nx: null, py: null, ny: null, pz: null, nz: null }
    entry[KEY_OF_NORMAL[(e.normal[i] as readonly number[]).join(',')] as StickerKey] = stickers[i] as number
    map.set(k, entry)
  }
  return map
}

/** The token that turns the same layer back: R ↔ R', R2 stays. */
export const inverseToken = (token: string): string =>
  token.endsWith("'") ? token.slice(0, -1) : token.endsWith('2') ? token : `${token}'`
