import type { CubieState, Move } from '../../smart-solver/core/types'
import { CURRICULUM_STAGES } from '../curriculum'
import type { StageDef, StageId } from '../stages'
import type { ColorNames } from '../guide/crossGuide'
import { buildCrossGuide } from '../guide/crossGuide'
import { buildCornerGuide } from '../guide/cornerGuide'
import { buildMiddleGuide } from '../guide/middleGuide'
import { buildTopCrossGuide } from '../guide/topCrossGuide'
import { buildLastEdgesOrderGuide } from '../guide/lastEdgesOrder'
import { buildLastCornersGuide } from '../guide/lastCornersGuide'
import { buildLastFaceGuide } from '../guide/lastFaceGuide'

/** One big step of the basic 3x3 solution: the moves are computed only when the step starts. */
export interface BasicStagePlan {
  stage: StageDef
  moves: Move[]
  /** Why each move is made, taken from the lesson guide that produced it. */
  whys: string[]
}

interface PieceGuide {
  steps: readonly { notation: string; why: string }[]
  states: readonly CubieState[]
}

/** The same per-piece guides the lessons use, one per big step. */
const GUIDES: Record<StageId, (state: CubieState, names: ColorNames) => PieceGuide | null> = {
  cross: (state, names) => buildCrossGuide(state, names),
  corners: (state, names) => buildCornerGuide(state, names),
  middle: (state, names) => buildMiddleGuide(state, names),
  topCross: (state, names) => buildTopCrossGuide(state, names, 'single'),
  topEdges: (state, names) => buildLastEdgesOrderGuide(state, names),
  topCorners: (state, names) => buildLastCornersGuide(state, names),
  topFace: (state) => buildLastFaceGuide(state)
}

/** The big step the cube is in: the first of the seven lesson goals it has not reached (null once solved). */
export const basicStageInProgress = (state: CubieState): StageDef | null =>
  CURRICULUM_STAGES.find((stage) => !stage.isDone(state)) ?? null

/** Plans only the big step the cube is in, by running its lesson guide piece by piece until the goal is reached. */
export function planBasicStage(state: CubieState, names: ColorNames): BasicStagePlan | null {
  const stage = basicStageInProgress(state)
  if (!stage) return null
  const moves: Move[] = []
  const whys: string[] = []
  let current = state
  for (let round = 0; round < 80 && !stage.isDone(current); round += 1) {
    const guide = GUIDES[stage.id](current, names)
    if (!guide || !guide.steps.length) return null
    for (const step of guide.steps) {
      moves.push(step.notation as Move)
      whys.push(step.why)
    }
    current = guide.states[guide.states.length - 1]!
  }
  return stage.isDone(current) ? { stage, moves, whys } : null
}
