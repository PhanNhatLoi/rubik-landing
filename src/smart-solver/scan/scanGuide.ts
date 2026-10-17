import type { Face } from '../core/types'

/**
 * Geometry of the guided scan. Faces keep their standard names (in the standard scheme
 * U white, D yellow, F green, B blue, R red, L orange); the user holds F towards the
 * camera with U (white) on top, R on the right and L on the left.
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
  /** How the cube is held while this face is scanned (`face` towards the camera); the net mirrors it. */
  hold: Hold
  /** What to do, given the color name of each face in the user's scheme. */
  instruction: (name: (f: Face) => string) => string
}

// Same physical frame as the lessons: white U up, yellow D down, green F initially forward.
const TOP: Face = 'U'

/** Turn the whole cube right around the side ring, then tilt U and D towards the camera. */
export const SCAN_STEPS: readonly ScanStep[] = [
  { face: 'F', hold: { front: 'F', top: TOP }, instruction: (n) => `Hướng mặt ${n('F')} vào camera, mặt ${n('U')} ở trên, ${n('D')} ở dưới.` },
  { face: 'L', hold: { front: 'L', top: TOP }, instruction: (n) => `Xoay cả khối sang phải 90°: mặt ${n('L')} (bên trái) ra trước, ${n('U')} vẫn ở trên.` },
  { face: 'B', hold: { front: 'B', top: TOP }, instruction: (n) => `Tiếp tục xoay sang phải: mặt ${n('B')} ra trước, ${n('U')} vẫn ở trên.` },
  { face: 'R', hold: { front: 'R', top: TOP }, instruction: (n) => `Tiếp tục xoay sang phải: mặt ${n('R')} ra trước, ${n('U')} vẫn ở trên.` },
  { face: 'U', hold: { front: 'U', top: 'L' }, instruction: (n) => `Lật mặt trên về phía camera: mặt ${n('U')} đối diện, ${n('R')} ở dưới, ${n('F')} bên trái.` },
  { face: 'D', hold: { front: 'D', top: 'R' }, instruction: (n) => `Lật khối 180° (giữ ${n('F')} bên trái): mặt ${n('D')} đối diện camera, ${n('R')} ở trên.` }
]

export const SCAN_ORDER: readonly Face[] = SCAN_STEPS.map((s) => s.face)

/** Even cubes use the same holds; face numbers follow this scan order. */
export const EVEN_INSTRUCTIONS: Record<Face, string> = {
  F: 'Cầm khối theo cách bất kỳ: mặt hướng vào camera là mặt 1. Giữ mặt đang ở trên (mặt 5) ở trên trong các bước 1–4.',
  L: 'Xoay cả khối sang phải 90°: mặt bên trái (mặt 2) ra trước, mặt 5 vẫn ở trên.',
  B: 'Tiếp tục xoay sang phải: mặt 3 ra trước, mặt 5 vẫn ở trên.',
  R: 'Tiếp tục xoay sang phải: mặt 4 ra trước, mặt 5 vẫn ở trên.',
  U: 'Lật mặt trên (mặt 5) về phía camera: mặt 4 ở dưới, mặt 1 bên trái.',
  D: 'Lật khối 180° (giữ mặt 1 bên trái): mặt còn lại (mặt 6) đối diện camera, mặt 4 ở trên.'
}

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

/** Image cell that becomes cell k of an n×n face after one clockwise quarter turn. */
export function clockwiseMap(n: number): number[] {
  return Array.from({ length: n * n }, (_, k) => (n - 1 - (k % n)) * n + Math.floor(k / n))
}

/** Turns `cells` (row-major n×n, n from the length) clockwise by t quarter turns. */
export function rotateCells<T>(cells: readonly T[], t: number): T[] {
  const cw = clockwiseMap(Math.round(Math.sqrt(cells.length)))
  let out = [...cells]
  for (let i = 0; i < ((t % 4) + 4) % 4; i += 1) {
    const prev = out
    out = cw.map((j) => prev[j] as T)
  }
  return out
}

/** Converts a camera image of `face` (taken during its step) to the face's standard layout. */
export function toStandard<T>(face: Face, cells: readonly T[]): T[] {
  return rotateCells(cells, 4 - cameraRotation(face))
}
