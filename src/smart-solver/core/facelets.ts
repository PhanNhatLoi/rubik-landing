import { permutationParity } from './cubie'
import { FACES, type CubieState, type Face, type Facelets, type ValidationError } from './types'

// Facelet index = faceIndex * 9 + row * 3 + col, faces in URFDLB order.
export const CORNER_FACELETS: readonly (readonly [number, number, number])[] = [
  [8, 9, 20], // URF
  [6, 18, 38], // UFL
  [0, 36, 47], // ULB
  [2, 45, 11], // UBR
  [29, 26, 15], // DFR
  [27, 44, 24], // DLF
  [33, 53, 42], // DBL
  [35, 17, 51] // DRB
]

export const EDGE_FACELETS: readonly (readonly [number, number])[] = [
  [5, 10], // UR
  [7, 19], // UF
  [3, 37], // UL
  [1, 46], // UB
  [32, 16], // DR
  [28, 25], // DF
  [30, 43], // DL
  [34, 52], // DB
  [23, 12], // FR
  [21, 41], // FL
  [50, 39], // BL
  [48, 14] // BR
]

export const CORNER_COLORS: readonly (readonly [Face, Face, Face])[] = [
  ['U', 'R', 'F'],
  ['U', 'F', 'L'],
  ['U', 'L', 'B'],
  ['U', 'B', 'R'],
  ['D', 'F', 'R'],
  ['D', 'L', 'F'],
  ['D', 'B', 'L'],
  ['D', 'R', 'B']
]

export const EDGE_COLORS: readonly (readonly [Face, Face])[] = [
  ['U', 'R'],
  ['U', 'F'],
  ['U', 'L'],
  ['U', 'B'],
  ['D', 'R'],
  ['D', 'F'],
  ['D', 'L'],
  ['D', 'B'],
  ['F', 'R'],
  ['F', 'L'],
  ['B', 'L'],
  ['B', 'R']
]

export const SOLVED_FACELETS: Facelets = FACES.map((f) => f.repeat(9)).join('')

export function toFacelets(state: CubieState): Facelets {
  const out: string[] = SOLVED_FACELETS.split('')
  CORNER_FACELETS.forEach((slots, i) => {
    const cubie = state.cp[i] as number
    const ori = state.co[i] as number
    for (let n = 0; n < 3; n += 1) {
      out[slots[(n + ori) % 3] as number] = (CORNER_COLORS[cubie] as readonly Face[])[n] as Face
    }
  })
  EDGE_FACELETS.forEach((slots, i) => {
    const cubie = state.ep[i] as number
    const ori = state.eo[i] as number
    for (let n = 0; n < 2; n += 1) {
      out[slots[(n + ori) % 2] as number] = (EDGE_COLORS[cubie] as readonly Face[])[n] as Face
    }
  })
  return out.join('')
}

export type FromFaceletsResult =
  | { ok: true; state: CubieState }
  | { ok: false; errors: ValidationError[] }

export function fromFacelets(facelets: Facelets): FromFaceletsResult {
  const errors: ValidationError[] = []
  if (facelets.length !== 54) return { ok: false, errors: [{ kind: 'length', length: facelets.length }] }

  const f = facelets.split('') as Face[]
  f.forEach((char, index) => {
    if (!(FACES as readonly string[]).includes(char)) errors.push({ kind: 'invalidChar', index, char })
  })
  if (errors.length) return { ok: false, errors }

  if (FACES.some((face, i) => f[i * 9 + 4] !== face)) return { ok: false, errors: [{ kind: 'centers' }] }
  FACES.forEach((face) => {
    const count = f.filter((c) => c === face).length
    if (count !== 9) errors.push({ kind: 'colorCount', face, count })
  })

  const cp: number[] = []
  const co: number[] = []
  CORNER_FACELETS.forEach((slots, position) => {
    const colors = slots.map((s) => f[s] as Face)
    const ori = colors.findIndex((c) => c === 'U' || c === 'D')
    const c1 = colors[(ori + 1) % 3]
    const c2 = colors[(ori + 2) % 3]
    const cubie = ori < 0 ? -1 : CORNER_COLORS.findIndex((cc) => cc[0] === colors[ori] && cc[1] === c1 && cc[2] === c2)
    if (cubie < 0) errors.push({ kind: 'invalidCorner', position })
    cp.push(cubie)
    co.push(Math.max(ori, 0))
  })

  const ep: number[] = []
  const eo: number[] = []
  EDGE_FACELETS.forEach((slots, position) => {
    const [a, b] = slots.map((s) => f[s] as Face)
    let cubie = -1
    let ori = 0
    EDGE_COLORS.forEach((ec, j) => {
      if (ec[0] === a && ec[1] === b) {
        cubie = j
        ori = 0
      } else if (ec[0] === b && ec[1] === a) {
        cubie = j
        ori = 1
      }
    })
    if (cubie < 0) errors.push({ kind: 'invalidEdge', position })
    ep.push(cubie)
    eo.push(ori)
  })

  if (errors.length) return { ok: false, errors }

  const structural = validateState({ cp, co, ep, eo })
  if (structural.length) return { ok: false, errors: structural }
  return { ok: true, state: { cp, co, ep, eo } }
}

/** Checks that a cubie state is reachable from solved by legal face turns. */
export function validateState(state: CubieState): ValidationError[] {
  const errors: ValidationError[] = []
  const dupes = (perm: readonly number[], size: number) =>
    Array.from({ length: size }, (_, j) => j).filter((j) => perm.filter((p) => p === j).length !== 1)

  dupes(state.cp, 8).forEach((cubie) => errors.push({ kind: 'duplicateCorner', cubie }))
  dupes(state.ep, 12).forEach((cubie) => errors.push({ kind: 'duplicateEdge', cubie }))
  if (errors.length) return errors

  if (state.co.reduce((a, b) => a + b, 0) % 3 !== 0) errors.push({ kind: 'cornerTwist' })
  if (state.eo.reduce((a, b) => a + b, 0) % 2 !== 0) errors.push({ kind: 'edgeFlip' })
  if (permutationParity(state.cp) !== permutationParity(state.ep)) errors.push({ kind: 'parity' })
  return errors
}
