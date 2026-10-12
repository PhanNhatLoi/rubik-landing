import type { Axis, Grid, StickerKey, Stickers } from '../../rubikLogic'
import { FACES, type Face, type Facelets, type Move } from '../core/types'
import { formatMove, parseMove } from '../core/cubie'

export interface LayerTurn {
  axis: Axis
  layer: number
  steps: number
}

export interface StickerCubie<T> {
  grid: Grid
  stickers: Stickers<T>
}

/**
 * A turn made in the scene, expressed relative to the centers.
 * Slice turns (M/E/S) move the centers, so they are reported as the two equivalent
 * outer-face turns plus a whole-cube rotation, which center-relative state ignores.
 */
export interface TurnEvent {
  notation: string
  moves: Move[]
}

type Vec = readonly [number, number, number]

const SIZE = 3
const MAX = SIZE - 1
const AXES: readonly Axis[] = ['x', 'y', 'z']

const KEY_NORMAL: Record<StickerKey, Vec> = {
  px: [1, 0, 0],
  nx: [-1, 0, 0],
  py: [0, 1, 0],
  ny: [0, -1, 0],
  pz: [0, 0, 1],
  nz: [0, 0, -1]
}

const FACE_NORMAL: Record<Face, Vec> = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1]
}

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sameVec = (a: Vec, b: Vec) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
const axisVec = (axis: Axis): Vec => KEY_NORMAL[`p${axis}` as StickerKey]

function keyOf(normal: Vec): StickerKey {
  const key = (Object.keys(KEY_NORMAL) as StickerKey[]).find((k) => sameVec(KEY_NORMAL[k], normal))
  if (!key) throw new Error(`not an axis normal: ${normal.join(',')}`)
  return key
}

function faceOf(normal: Vec): Face {
  const face = FACES.find((f) => sameVec(FACE_NORMAL[f], normal))
  if (!face) throw new Error(`not an axis normal: ${normal.join(',')}`)
  return face
}

/**
 * Rotation from the center-relative frame (U = +y, R = +x, F = +z) to the scene frame,
 * stored as the scene normals of the R, U and F centers (the matrix columns).
 */
export interface Orientation {
  readonly r: Vec
  readonly u: Vec
  readonly f: Vec
}

export const IDENTITY_ORIENTATION: Orientation = { r: [1, 0, 0], u: [0, 1, 0], f: [0, 0, 1] }

function toScene(o: Orientation, v: Vec): Vec {
  return [
    v[0] * o.r[0] + v[1] * o.u[0] + v[2] * o.f[0],
    v[0] * o.r[1] + v[1] * o.u[1] + v[2] * o.f[1],
    v[0] * o.r[2] + v[1] * o.u[2] + v[2] * o.f[2]
  ]
}

function toIdentity(o: Orientation, v: Vec): Vec {
  return [dot(o.r, v), dot(o.u, v), dot(o.f, v)]
}

export const gridKey = (g: Grid) => `${g.x},${g.y},${g.z}`

/** Reads where the R, U and F centers currently sit. Returns null if the centers are inconsistent. */
export function readOrientation<T>(cubies: readonly StickerCubie<T>[], toFace: (sticker: T) => Face | null): Orientation | null {
  const byGrid = new Map(cubies.map((c) => [gridKey(c.grid), c]))
  const sceneNormalOf = new Map<Face, Vec>()
  for (const key of Object.keys(KEY_NORMAL) as StickerKey[]) {
    const n = KEY_NORMAL[key]
    const center = byGrid.get(gridKey({ x: 1 + n[0], y: 1 + n[1], z: 1 + n[2] }))
    const sticker = center?.stickers[key]
    const face = sticker == null ? null : toFace(sticker)
    if (!face || sceneNormalOf.has(face)) return null
    sceneNormalOf.set(face, n)
  }
  const r = sceneNormalOf.get('R')
  const u = sceneNormalOf.get('U')
  const f = sceneNormalOf.get('F')
  if (!r || !u || !f) return null
  return { r, u, f }
}

function sideTurn(o: Orientation, sceneNormal: Vec, axis: Axis, steps: number): Move | null {
  // Clockwise seen from outside is -90° around the outward normal.
  const cw = dot(sceneNormal, axisVec(axis)) > 0 ? -1 : 1
  return formatMove(faceOf(toIdentity(o, sceneNormal)), steps * cw)
}

/** Converts a scene layer turn into center-relative moves. Returns null for a zero turn. */
export function layerTurnToEvent(turn: LayerTurn, o: Orientation = IDENTITY_ORIENTATION): TurnEvent | null {
  const a = axisVec(turn.axis)
  const neg: Vec = [-a[0], -a[1], -a[2]]
  if (turn.layer === MAX || turn.layer === 0) {
    const move = sideTurn(o, turn.layer === MAX ? a : neg, turn.axis, turn.steps)
    return move ? { notation: move, moves: [move] } : null
  }

  // A slice turn by s equals a whole-cube turn by s plus both outer layers turned by -s.
  const moves = [sideTurn(o, a, turn.axis, -turn.steps), sideTurn(o, neg, turn.axis, -turn.steps)].filter(
    (m): m is Move => m !== null
  )
  if (!moves.length) return null

  // M follows L (+90° about +x), E follows D (+90° about +y), S follows F (-90° about +z).
  const b = toIdentity(o, a)
  const idAxis = AXES.find((_, i) => b[i] !== 0) as Axis
  const sign = b[AXES.indexOf(idAxis)] as number
  const sliceSteps = turn.steps * sign * (idAxis === 'z' ? -1 : 1)
  const t = ((sliceSteps % 4) + 4) % 4
  const notation = `${{ x: 'M', y: 'E', z: 'S' }[idAxis]}${t === 1 ? '' : t === 2 ? '2' : "'"}`
  return { notation, moves }
}

/** Converts a center-relative move into the scene layer turn that performs it. */
export function moveToLayerTurn(move: Move, o: Orientation = IDENTITY_ORIENTATION): LayerTurn {
  const { face, turns } = parseMove(move)
  const n = toScene(o, FACE_NORMAL[face])
  const axis = AXES.find((_, i) => n[i] !== 0) as Axis
  const positive = dot(n, axisVec(axis)) > 0
  const cw = positive ? -1 : 1
  return { axis, layer: positive ? MAX : 0, steps: turns === 2 ? 2 : turns === 1 ? cw : -cw }
}

// Where facelet (row, col) of each face sits in the grid, in the center-relative frame,
// viewing each face from outside.
const FACE_LAYOUT: Record<Face, { key: StickerKey; at: (r: number, c: number) => Grid }> = {
  U: { key: 'py', at: (r, c) => ({ x: c, y: MAX, z: r }) },
  R: { key: 'px', at: (r, c) => ({ x: MAX, y: MAX - r, z: MAX - c }) },
  F: { key: 'pz', at: (r, c) => ({ x: c, y: MAX - r, z: MAX }) },
  D: { key: 'ny', at: (r, c) => ({ x: c, y: 0, z: MAX - r }) },
  L: { key: 'nx', at: (r, c) => ({ x: 0, y: MAX - r, z: c }) },
  B: { key: 'nz', at: (r, c) => ({ x: MAX - c, y: MAX - r, z: 0 }) }
}

function forEachFacelet(o: Orientation, cb: (index: number, grid: Grid, key: StickerKey) => void) {
  FACES.forEach((face, fi) => {
    const { key, at } = FACE_LAYOUT[face]
    const sceneKey = keyOf(toScene(o, KEY_NORMAL[key]))
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const g = at(r, c)
        const p = toScene(o, [g.x - 1, g.y - 1, g.z - 1])
        cb(fi * 9 + r * 3 + c, { x: p[0] + 1, y: p[1] + 1, z: p[2] + 1 }, sceneKey)
      }
    }
  })
}

/** Reads the scene as center-relative facelets ('?' where a sticker is missing). */
export function stickerModelToFacelets<T>(cubies: readonly StickerCubie<T>[], toFace: (sticker: T) => Face | null): Facelets {
  const o = readOrientation(cubies, toFace) ?? IDENTITY_ORIENTATION
  const byGrid = new Map(cubies.map((c) => [gridKey(c.grid), c]))
  const out = new Array<string>(54).fill('?')
  forEachFacelet(o, (index, grid, key) => {
    const sticker = byGrid.get(gridKey(grid))?.stickers[key]
    const face = sticker == null ? null : toFace(sticker)
    if (face) out[index] = face
  })
  return out.join('')
}

/** Sticker faces for every outer grid position in the standard orientation, keyed by "x,y,z". */
export function faceletsToStickerMap(facelets: Facelets): Map<string, Stickers<Face>> {
  const map = new Map<string, Stickers<Face>>()
  forEachFacelet(IDENTITY_ORIENTATION, (index, grid, key) => {
    const k = gridKey(grid)
    const stickers = map.get(k) ?? { px: null, nx: null, py: null, ny: null, pz: null, nz: null }
    stickers[key] = facelets[index] as Face
    map.set(k, stickers)
  })
  return map
}
