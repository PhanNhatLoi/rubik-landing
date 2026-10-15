import type { Face } from '../smart-solver/core/types'

/**
 * Which real face (named by its center, as the 3D cube and solver do) plays each role when the
 * learner holds the cube with `front` towards them. Roles are what the notation letters mean:
 * "R" is whatever face is on the learner's right. Top is chosen so the cube is only turned, never mirrored.
 */
export type Frame = Record<Face, Face>

const FRAMES: Record<Face, Frame> = {
  F: { F: 'F', B: 'B', U: 'U', D: 'D', R: 'R', L: 'L' },
  R: { F: 'R', B: 'L', U: 'U', D: 'D', R: 'B', L: 'F' },
  B: { F: 'B', B: 'F', U: 'U', D: 'D', R: 'L', L: 'R' },
  L: { F: 'L', B: 'R', U: 'U', D: 'D', R: 'F', L: 'B' },
  U: { F: 'U', B: 'D', U: 'B', D: 'F', R: 'R', L: 'L' },
  D: { F: 'D', B: 'U', U: 'F', D: 'B', R: 'R', L: 'L' }
}

export function frameFor(front: Face): Frame {
  return FRAMES[front]
}
