import { parseAlgorithm } from '../smart-solver/core/cubie'
import { fromFacelets, toFacelets } from '../smart-solver/core/facelets'
import type { CubieState, Face, Move } from '../smart-solver/core/types'
import { getEngine } from '../smart-solver/nxn/engine'

/** Rotate a method's frame by x2, leaving the scene/palette U-white, D-yellow unchanged. */
export const LEARNING_FRAME: Record<Face, Face> = { U: 'D', D: 'U', F: 'B', B: 'F', R: 'R', L: 'L' }
export const learningMove = (move: Move): Move => `${LEARNING_FRAME[move[0] as Face]}${move.slice(1)}` as Move
export const learningMoves = (moves: readonly Move[]): Move[] => moves.map(learningMove)
export const parseLearningAlgorithm = (text: string): Move[] => learningMoves(parseAlgorithm(text))

/** Relabel colors as well as positions: solved stays solved and this mapping is its own inverse. */
export function learningState(state: CubieState): CubieState {
  const faces = ['U', 'R', 'F', 'D', 'L', 'B'] as const
  const stickers = Uint8Array.from(toFacelets(state), (face) => faces.indexOf(face as Face))
  const rotated = getEngine(3).apply(stickers, 'x2')
  const parsed = fromFacelets(Array.from(rotated, (n) => LEARNING_FRAME[faces[n]!]).join(''))
  if (!parsed.ok) throw new Error('Invalid learning frame')
  return parsed.state
}
