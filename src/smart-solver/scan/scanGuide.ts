import type { Face } from '../core/types'

/**
 * Geometry of the guided scan. Faces are named in the standard scheme
 * (U white, D yellow, F green, B blue, R red, L orange); the user holds the cube
 * green to the camera with yellow on top, so red is on the left and orange on the right.
 */

/** How the cube is held: which face points at the camera and which points up. */
export interface Hold {
  front: Face
  top: Face
}

export type Slot = 'center' | 'left' | 'right' | 'back' | 'top' | 'bottom'

type Vec = readonly [number, number, number]

const NORMAL: Record<Face, Vec> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1]
}

const FACE_LIST: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B']

const neg = (v: Vec): Vec => [-v[0], -v[1], -v[2]]
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const faceOf = (v: Vec): Face => FACE_LIST.find((f) => NORMAL[f].every((x, i) => x === v[i])) as Face
export const opposite = (f: Face): Face => faceOf(neg(NORMAL[f]))

/** Face on the camera's right when `hold.front` faces the camera with `hold.top` up. */
function rightOf(hold: Hold): Face {
  // Screen up × towards the viewer = screen right.
  return faceOf(cross(NORMAL[hold.top], NORMAL[hold.front]))
}

/** Where every face sits in the on-screen net for a given hold. */
export function slotsFor(hold: Hold): Record<Face, Slot> {
  const right = rightOf(hold)
  return {
    [hold.front]: 'center',
    [opposite(hold.front)]: 'back',
    [hold.top]: 'top',
    [opposite(hold.top)]: 'bottom',
    [right]: 'right',
    [opposite(right)]: 'left'
  } as Record<Face, Slot>
}

// Neighbours along each face's edges in its standard facelet layout: top, right, bottom, left.
const EDGES: Record<Face, readonly [Face, Face, Face, Face]> = {
  U: ['B', 'R', 'F', 'L'],
  R: ['U', 'B', 'D', 'F'],
  F: ['U', 'R', 'D', 'L'],
  D: ['F', 'R', 'B', 'L'],
  L: ['U', 'F', 'D', 'B'],
  B: ['U', 'L', 'D', 'R']
}

/**
 * Clockwise quarter turns that take a face's standard layout to how it looks
 * when seen with `up` at the top of the picture.
 */
export function viewRotation(face: Face, up: Face): number {
  const i = EDGES[face].indexOf(up)
  if (i < 0) throw new Error(`${up} is not next to ${face}`)
  return (4 - i) % 4
}

/**
 * Rotation of `face` as drawn in the net for `hold`: side faces keep the hold's top up;
 * the top face is folded over the front face, the bottom face hangs under it.
 */
export function displayRotation(face: Face, hold: Hold): number {
  const slot = slotsFor(hold)[face]
  if (slot === 'top') return viewRotation(face, opposite(hold.front))
  if (slot === 'bottom') return viewRotation(face, hold.front)
  return viewRotation(face, hold.top)
}

export interface ScanStep {
  face: Face
  /** Hold the net shows (and the user keeps) while this face is scanned. */
  hold: Hold
  instruction: string
}

// Yellow up for the whole scan.
const SIDE = { top: 'D' } as const

/** Around the side ring turning the cube right (left face comes forward), then top and bottom. */
export const SCAN_STEPS: readonly ScanStep[] = [
  { face: 'F', hold: { front: 'F', top: SIDE.top }, instruction: 'Hướng mặt xanh lá vào camera, mặt vàng ở trên.' },
  { face: 'R', hold: { front: 'R', top: SIDE.top }, instruction: 'Xoay cả khối sang phải 90°: mặt đỏ (bên trái) ra trước, vàng vẫn ở trên.' },
  { face: 'B', hold: { front: 'B', top: SIDE.top }, instruction: 'Tiếp tục xoay sang phải: mặt xanh dương ra trước.' },
  { face: 'L', hold: { front: 'L', top: SIDE.top }, instruction: 'Tiếp tục xoay sang phải: mặt cam ra trước.' },
  {
    face: 'D',
    hold: { front: 'L', top: SIDE.top },
    instruction: 'Lật mặt trên về phía camera: mặt vàng đối diện, cam ở dưới, xanh lá bên trái.'
  },
  {
    face: 'U',
    hold: { front: 'L', top: SIDE.top },
    instruction: 'Lật khối 180° (giữ xanh lá bên trái): mặt trắng đối diện, cam ở trên.'
  }
]

export const SCAN_ORDER: readonly Face[] = SCAN_STEPS.map((s) => s.face)

export function stepFor(face: Face): ScanStep {
  return SCAN_STEPS.find((s) => s.face === face) as ScanStep
}

/** The camera image of `face` during its step is its standard layout turned by this many clockwise quarters. */
export function cameraRotation(face: Face): number {
  return displayRotation(face, stepFor(face).hold)
}

/** ROTATION[t][k]: image cell that becomes standard cell k when the image is turned t clockwise quarters. */
export const ROTATION: readonly (readonly number[])[] = [0, 1, 2, 3].map((t) =>
  Array.from({ length: 9 }, (_, k) => {
    let idx = k
    for (let i = 0; i < t; i += 1) {
      const r = Math.floor(idx / 3)
      const c = idx % 3
      idx = (2 - c) * 3 + r
    }
    return idx
  })
)

/** Turns `cells` (row-major 3x3) clockwise by t quarter turns. */
export function rotateCells<T>(cells: readonly T[], t: number): T[] {
  const map = ROTATION[((t % 4) + 4) % 4] as readonly number[]
  return map.map((i) => cells[i] as T)
}

/** Converts a camera image of `face` (taken during its step) to the face's standard layout. */
export function toStandard<T>(face: Face, cells: readonly T[]): T[] {
  return rotateCells(cells, 4 - cameraRotation(face))
}
