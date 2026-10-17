import { LEARNING_FRAME, learningMoves } from '../orientation'
import type { Face, Move } from '../../smart-solver/core/types'
/**
 * The one middle-layer formula and its mirror. Written with U on top and the front face towards the
 * learner; turning the whole thing around the top (F→R→B→L) gives the same formula for the other
 * three sides, so one formula covers all four middle slots.
 */
const METHOD_RIGHT_ALG = ["U", "R", "U'", "R'", "U'", "F'", "U", "F"] as const
const METHOD_LEFT_ALG = ["U'", "L'", "U", "L", "U", "F", "U'", "F'"] as const

// Actual fixed-position formulas preserve the solved upper layer.
export const RIGHT_ALG = learningMoves(METHOD_RIGHT_ALG)
export const LEFT_ALG = learningMoves(METHOD_LEFT_ALG)

const AROUND_TOP: Record<string, string> = { F: 'R', R: 'B', B: 'L', L: 'F', U: 'U', D: 'D' }

/** The formula as seen with another face in front: `quarters` turns around the top, 0..3. */
export function turnAround(alg: readonly string[], quarters: number): string[] {
  return alg.map((m) => {
    let face = m[0]!
    for (let i = 0; i < quarters; i += 1) face = AROUND_TOP[face]!
    return `${face}${m.slice(1)}`
  })
}

export type Side = 'right' | 'left'

export interface AlgVariant {
  side: Side
  /** Face that plays "front" (the edge's front sticker must match its center). */
  front: string
  /** Face the edge slides into: the right or left neighbour of `front`. */
  target: string
  seq: string[]
}

const FRONT_AFTER = ['F', 'R', 'B', 'L']
const RIGHT_OF: Record<string, string> = { F: 'R', R: 'B', B: 'L', L: 'F' }
const LEFT_OF: Record<string, string> = { F: 'L', R: 'F', B: 'R', L: 'B' }

/** All eight versions: right and left formulas, with each side face as the front. */
export const ALG_VARIANTS: readonly AlgVariant[] = [0, 1, 2, 3].flatMap((k) => {
  const front = FRONT_AFTER[k]!
  return [
    { side: 'right' as const, front, target: RIGHT_OF[front]!, seq: turnAround(METHOD_RIGHT_ALG, k) },
    { side: 'left' as const, front, target: LEFT_OF[front]!, seq: turnAround(METHOD_LEFT_ALG, k) }
  ].map((variant) => ({ ...variant, front: LEARNING_FRAME[variant.front as Face], target: LEARNING_FRAME[variant.target as Face], seq: learningMoves(variant.seq as Move[]) }))
})
