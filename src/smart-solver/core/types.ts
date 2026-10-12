export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const
export type Face = (typeof FACES)[number]

export type MoveSuffix = '' | "'" | '2'
export type Move = `${Face}${MoveSuffix}`

export const MOVES: readonly Move[] = FACES.flatMap((f) => [f, `${f}'`, `${f}2`] as Move[])

/**
 * Cubie-level state using Kociemba's "replaced-by" convention:
 * cp[i] is the corner currently sitting at position i, co[i] its twist (0..2).
 * Corner order: URF UFL ULB UBR DFR DLF DBL DRB.
 * Edge order: UR UF UL UB DR DF DL DB FR FL BL BR.
 */
export interface CubieState {
  readonly cp: readonly number[]
  readonly co: readonly number[]
  readonly ep: readonly number[]
  readonly eo: readonly number[]
}

/** 54 face letters in URFDLB order, 9 per face, row-major as seen from outside. */
export type Facelets = string

export type ValidationError =
  | { kind: 'length'; length: number }
  | { kind: 'invalidChar'; index: number; char: string }
  | { kind: 'colorCount'; face: Face; count: number }
  | { kind: 'centers' }
  | { kind: 'invalidCorner'; position: number }
  | { kind: 'invalidEdge'; position: number }
  | { kind: 'duplicateCorner'; cubie: number }
  | { kind: 'duplicateEdge'; cubie: number }
  | { kind: 'cornerTwist' }
  | { kind: 'edgeFlip' }
  | { kind: 'parity' }
