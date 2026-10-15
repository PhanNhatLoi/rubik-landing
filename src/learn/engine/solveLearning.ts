import { solveBeginner3 } from '../../smart-solver/nxn/beginner'
import type { CubieState } from '../../smart-solver/core/types'
import { learningMoves, learningState } from '../orientation'

/** Reuse the proven solver in a rotated method frame; return actual fixed-position scene moves. */
export function solveLearning3(state: CubieState) {
  return solveBeginner3(learningState(state)).map((step) => ({
    ...step,
    title: ({ cross: 'Dấu cộng mặt trên', corners: 'Góc tầng trắng trên', middle: 'Cạnh tầng giữa', topCross: 'Dấu cộng mặt đáy', topFace: 'Hoàn thành mặt đáy', topCorners: 'Góc tầng đáy', topEdges: 'Cạnh tầng đáy' } as Record<string, string>)[step.stage] ?? step.title,
    moves: learningMoves(step.moves),
    // The solver's named formulas describe its internal frame; display the actual returned formula.
    algorithms: [learningMoves(step.moves).join(' ')]
  }))
}
