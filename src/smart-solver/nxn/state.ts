import { CORNER_FACELETS } from '../core/facelets'
import { FACES, type CubieState, type Face } from '../core/types'
import { FACE_ORDER, type CubeSize, type FaceName } from './engine'

/** Input format of solveRubik: any color names, faces URFDLB, each face row-major as seen from outside. */
export interface CubeState {
  size: CubeSize
  faces: Record<FaceName, string[]>
}

export type InvalidReason =
  | 'sizeMismatch'
  | 'faceLength'
  | 'colorCount'
  | 'impossibleCorner'
  | 'duplicateCorner'
  | 'cornerTwist'
  | 'unsolvable'

/** The input cannot be a real cube (as opposed to a timeout or a resource problem). */
export class InvalidCubeError extends Error {
  constructor(
    readonly reason: InvalidReason,
    message: string
  ) {
    super(message)
    this.name = 'InvalidCubeError'
  }
}

export interface Normalized {
  n: number
  /** Sticker colors as indices into `colors`. */
  stickers: Uint8Array
  colors: string[]
  /** Color index that belongs on each face once solved. */
  scheme: Record<FaceName, number>
}

/** 3x3 facelet index (face, row, col ∈ 0..2) → n×n sticker index, mapping 0→0, 1→middle, 2→n-1. */
export function stickerIndex(n: number, f3: number): number {
  const face = Math.floor(f3 / 9)
  const r3 = Math.floor((f3 % 9) / 3)
  const c3 = f3 % 3
  const map = (v: number) => (v === 0 ? 0 : v === 2 ? n - 1 : Math.floor((n - 1) / 2))
  return face * n * n + map(r3) * n + map(c3)
}

/** Color triples of the 8 corners, in each corner's clockwise facelet order. */
export function cornerColors(stickers: Uint8Array, n: number): number[][] {
  return CORNER_FACELETS.map((slots) => slots.map((f3) => stickers[stickerIndex(n, f3)] as number))
}

/** Pairs of colors that are on opposite faces: they never meet on a corner. */
function opposites(corners: number[][]): Map<number, number> {
  const meets = new Set<string>()
  corners.forEach((c) => c.forEach((a) => c.forEach((b) => a !== b && meets.add(`${a},${b}`))))
  const out = new Map<number, number>()
  for (let a = 0; a < 6; a += 1) {
    const others = [0, 1, 2, 3, 4, 5].filter((b) => b !== a && !meets.has(`${a},${b}`))
    if (others.length !== 1) throw new InvalidCubeError('impossibleCorner', 'Các góc không tạo thành một bộ màu hợp lệ.')
    out.set(a, others[0] as number)
  }
  return out
}

/**
 * Which color belongs on which face. Odd cubes: the fixed centers. Even cubes have no fixed
 * centers, so the scheme (including its handedness, which decides where red/orange go) is read
 * from the corners: the DBL corner gives D, B and L, opposite colors give U, F and R.
 */
export function deriveScheme(stickers: Uint8Array, n: number): Record<FaceName, number> {
  if (n % 2 === 1) {
    const mid = Math.floor(n / 2)
    return Object.fromEntries(FACE_ORDER.map((f, i) => [f, stickers[i * n * n + mid * n + mid] as number])) as Record<FaceName, number>
  }
  const corners = cornerColors(stickers, n)
  const opp = opposites(corners)
  // DBL corner, facelets [D, B, L].
  const [d, b, l] = corners[6] as [number, number, number]
  return { D: d, B: b, L: l, U: opp.get(d) as number, F: opp.get(b) as number, R: opp.get(l) as number }
}

export function normalize(size: CubeSize, state: CubeState): Normalized {
  if (state.size !== size) throw new InvalidCubeError('sizeMismatch', `Kích thước ${size} không khớp với trạng thái ${state.size}x${state.size}.`)
  const n = size
  const colors: string[] = []
  const stickers = new Uint8Array(6 * n * n)
  FACE_ORDER.forEach((face, fi) => {
    const cells = state.faces[face]
    if (!cells || cells.length !== n * n) throw new InvalidCubeError('faceLength', `Mặt ${face} phải có ${n * n} ô.`)
    cells.forEach((color, k) => {
      let idx = colors.indexOf(color)
      if (idx < 0) {
        idx = colors.length
        colors.push(color)
      }
      stickers[fi * n * n + k] = idx
    })
  })
  if (colors.length !== 6 || colors.some((_, c) => stickers.filter((v) => v === c).length !== n * n)) {
    throw new InvalidCubeError('colorCount', `Cần đúng 6 màu, mỗi màu ${n * n} ô.`)
  }
  const scheme = deriveScheme(stickers, n)
  validateCorners(stickers, n, scheme)
  return { n, stickers, colors, scheme }
}

/** Reads the corners as a cubie state (edges left solved), relative to the scheme. */
export function cornersToCubie(stickers: Uint8Array, n: number, scheme: Record<FaceName, number>): CubieState {
  const label = new Map<number, Face>(FACE_ORDER.map((f) => [scheme[f], f]))
  const target = CORNER_FACELETS.map((slots) => slots.map((f3) => FACES[Math.floor(f3 / 9)] as Face))
  const cp: number[] = []
  const co: number[] = []
  cornerColors(stickers, n).forEach((triple, position) => {
    const faces = triple.map((c) => label.get(c) as Face)
    const ori = faces.findIndex((f) => f === 'U' || f === 'D')
    const rotated = [0, 1, 2].map((k) => faces[(ori + k) % 3])
    const cubie = target.findIndex((t) => t.every((f, k) => f === rotated[k]))
    if (ori < 0 || cubie < 0) throw new InvalidCubeError('impossibleCorner', 'Có một góc không tồn tại trên khối thật.')
    cp.push(cubie)
    co.push(ori)
  })
  return {
    cp,
    co,
    ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  }
}

function validateCorners(stickers: Uint8Array, n: number, scheme: Record<FaceName, number>) {
  const c = cornersToCubie(stickers, n, scheme)
  if (new Set(c.cp).size !== 8) throw new InvalidCubeError('duplicateCorner', 'Có hai góc giống hệt nhau.')
  if (c.co.reduce((a, b) => a + b, 0) % 3 !== 0) throw new InvalidCubeError('cornerTwist', 'Một góc bị xoắn (không thể có trên khối thật).')
}

/** A state from engine stickers (0..5 = URFDLB) for tests and scrambles. */
export function toCubeState(stickers: Uint8Array, n: CubeSize, palette: readonly string[] = FACE_ORDER): CubeState {
  const faces = {} as Record<FaceName, string[]>
  FACE_ORDER.forEach((f, fi) => {
    faces[f] = Array.from(stickers.subarray(fi * n * n, (fi + 1) * n * n), (v) => palette[v] as string)
  })
  return { size: n, faces }
}
