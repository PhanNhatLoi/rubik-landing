import type { CubieState } from '../smart-solver/core/types'
import { EDGE_COLORS } from '../smart-solver/core/facelets'
import { CROSS, FIRST_CORNERS, MIDDLE } from './goals'

/** Position of a piece in the 3x3x3 grid: x right, y up, z towards the front; 0..2 each. */
export type Cell = [number, number, number]

/** Grid cell of an edge slot (slots are named by the faces they touch, e.g. D+F). */
export function edgeCell(slot: number): Cell {
  const cell: Cell = [1, 1, 1]
  for (const face of EDGE_COLORS[slot] ?? []) {
    if (face === 'U') cell[1] = 2
    else if (face === 'D') cell[1] = 0
    else if (face === 'R') cell[0] = 2
    else if (face === 'L') cell[0] = 0
    else if (face === 'F') cell[2] = 2
    else cell[2] = 0
  }
  return cell
}

const CORNER_CELLS: readonly Cell[] = [
  [2, 2, 2], // URF
  [0, 2, 2], // UFL
  [0, 2, 0], // ULB
  [2, 2, 0], // UBR
  [2, 0, 2], // DFR
  [0, 0, 2], // DLF
  [0, 0, 0], // DBL
  [2, 0, 0] // DRB
]

/** Grid cell of a corner slot (URF UFL ULB UBR DFR DLF DBL DRB). */
export const cornerCell = (slot: number): Cell => CORNER_CELLS[slot] ?? [1, 1, 1]

/** Where the four first-layer (U) corner pieces currently are, wherever they sit. */
export function firstCornerCells(state: CubieState): Cell[] {
  return FIRST_CORNERS.map((piece) => cornerCell(state.cp.indexOf(piece)))
}

/** Where the four middle-layer edge pieces currently are, wherever they sit. */
export function middleEdgeCells(state: CubieState): Cell[] {
  return MIDDLE.map((piece) => edgeCell(state.ep.indexOf(piece)))
}

/** Where the four cross edges currently are, wherever they sit. */
export function crossEdgeCells(state: CubieState): Cell[] {
  return CROSS.map((edge) => edgeCell(state.ep.indexOf(edge)))
}
