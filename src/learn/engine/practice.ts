import { parseLearningAlgorithm as parseAlgorithm } from '../orientation'
import { solveLearning3 as solveBeginner3 } from '../engine/solveLearning'
import { applyMoves, equals, SOLVED } from '../../smart-solver/core/cubie'
import type { CubieState, Move } from '../../smart-solver/core/types'
import {
  CROSS,
  FIRST_CORNERS,
  edgeDone,
  cornerDone,
  MIDDLE,
} from '../goals'
import { getSample } from '../copy/copy'
import { STAGES, type StageDef, type StageId } from '../stages'

export interface PracticeSample {
  id: string
  label: string
  desc: string
  stage: StageId
  setup: Move[] /* áp lên SOLVED-đến-prereq */
}

export function buildPracticeState(_stage: StageId, sample: PracticeSample): CubieState {
  return applyMoves(SOLVED, sample.setup)
}

const STAGE_ORDER: StageId[] = [
  'cross',
  'corners',
  'middle',
  'topCross',
  'topFace',
  'topCorners',
  'topEdges'
]

const STAGE_DEF_MAP = new Map<StageId, StageDef>(STAGES.map((s) => [s.id, s]))

export function checkPrecondition(stage: StageDef, state: CubieState): { ok: boolean; missing: StageId[] } {
  const stageIdx = STAGE_ORDER.indexOf(stage.id)
  const missing: StageId[] = []

  for (let i = 0; i < stageIdx; i += 1) {
    const prevId = STAGE_ORDER[i] as StageId
    const prevDef = STAGE_DEF_MAP.get(prevId)
    if (prevDef && !prevDef.isDone(state)) {
      missing.push(prevId)
    }
  }

  return {
    ok: missing.length === 0,
    missing
  }
}

export function stageProgress(stage: StageDef, state: CubieState): { done: number; total: number } {
  switch (stage.id) {
    case 'cross': {
      const done = CROSS.filter((i) => edgeDone(state, i)).length
      return { done, total: 4 }
    }
    case 'corners': {
      const done = FIRST_CORNERS.filter((i) => cornerDone(state, i)).length
      return { done, total: 4 }
    }
    case 'middle': {
      const done = MIDDLE.filter((i) => edgeDone(state, i)).length
      return { done, total: 4 }
    }
    case 'topCross': {
      const done = [4, 5, 6, 7].filter((i) => state.eo[i] === 0).length
      return { done, total: 4 }
    }
    case 'topFace': {
      const done = [4, 5, 6, 7].filter((i) => state.co[i] === 0).length
      return { done, total: 4 }
    }
    case 'topCorners': {
      const done = [4, 5, 6, 7].filter((i) => cornerDone(state, i)).length
      return { done, total: 4 }
    }
    case 'topEdges': {
      const done = [4, 5, 6, 7].filter((i) => edgeDone(state, i)).length
      return { done, total: 4 }
    }
    default:
      return { done: 0, total: 4 }
  }
}

interface CachedPlan {
  stageId: StageId
  expectedCurrentState: CubieState
  remainingMoves: Move[]
}

let activePlan: CachedPlan | null = null

export function resetHintPlan(): void {
  activePlan = null
}

export function nextHint(stage: StageDef, state: CubieState): { move: Move; stage: StageId } | null {
  if (stage.isDone(state)) {
    activePlan = null
    return null
  }

  // If we have an active plan for this stage and the state matches the expected step, follow it.
  if (
    activePlan &&
    activePlan.stageId === stage.id &&
    activePlan.remainingMoves.length > 0 &&
    equals(state, activePlan.expectedCurrentState)
  ) {
    const nextMove = activePlan.remainingMoves[0]!
    activePlan.expectedCurrentState = applyMoves(state, [nextMove])
    activePlan.remainingMoves.shift()
    return { move: nextMove, stage: stage.id }
  }

  // Otherwise, compute a fresh plan from the current state.
  try {
    const steps = solveBeginner3(state)
    const stageSteps = steps.filter((s) => s.stage === stage.id)
    const allMoves = stageSteps.flatMap((s) => s.moves)

    if (allMoves.length === 0) {
      activePlan = null
      return null
    }

    const firstMove = allMoves[0]!
    activePlan = {
      stageId: stage.id,
      expectedCurrentState: applyMoves(state, [firstMove]),
      remainingMoves: allMoves.slice(1)
    }

    return { move: firstMove, stage: stage.id }
  } catch {
    activePlan = null
    return null
  }
}

const RAW_SAMPLES: Record<StageId, Omit<PracticeSample, 'label' | 'desc'>[]> = {
  cross: [
    {
      id: 'cross-a',
      stage: 'cross',
      setup: parseAlgorithm("F")
    },
    {
      id: 'cross-b',
      stage: 'cross',
      setup: parseAlgorithm("F R U'")
    },
    {
      id: 'cross-c',
      stage: 'cross',
      setup: parseAlgorithm("L' D2 F B2")
    }
  ],
  corners: [
    {
      id: 'corners-a',
      stage: 'corners',
      setup: parseAlgorithm("R U R' U'")
    },
    {
      id: 'corners-b',
      stage: 'corners',
      setup: parseAlgorithm("L' U' L U")
    },
    {
      id: 'corners-c',
      stage: 'corners',
      setup: parseAlgorithm("R U R' U' L' U' L U")
    }
  ],
  middle: [
    {
      id: 'middle-a',
      stage: 'middle',
      setup: parseAlgorithm("U R U' R' U' F' U F")
    },
    {
      id: 'middle-b',
      stage: 'middle',
      setup: parseAlgorithm("U' L' U L U F U' F'")
    },
    {
      id: 'middle-c',
      stage: 'middle',
      setup: parseAlgorithm("U R U' R' U' F' U F U' L' U L U F U' F'")
    }
  ],
  topCross: [
    {
      id: 'topCross-a',
      stage: 'topCross',
      setup: parseAlgorithm("F R U R' U' F' U2 F R U R' U' F'")
    },
    {
      id: 'topCross-b',
      stage: 'topCross',
      setup: parseAlgorithm("F R U R' U' F'")
    },
    {
      id: 'topCross-c',
      stage: 'topCross',
      setup: parseAlgorithm("F R U R' U' F' U F R U R' U' F'")
    }
  ],
  topFace: [
    {
      id: 'topFace-a',
      stage: 'topFace',
      setup: parseAlgorithm("R U R' U R U2 R'")
    },
    {
      id: 'topFace-b',
      stage: 'topFace',
      setup: parseAlgorithm("R U R' U R U' R' U R U2 R'")
    },
    {
      id: 'topFace-c',
      stage: 'topFace',
      setup: parseAlgorithm("R U R' U R U2 R' U R U R' U R U2 R'")
    }
  ],
  topCorners: [
    {
      id: 'topCorners-a',
      stage: 'topCorners',
      setup: parseAlgorithm("R' F R' B2 R F' R' B2 R2")
    },
    {
      id: 'topCorners-b',
      stage: 'topCorners',
      setup: parseAlgorithm("R B' R F2 R' B R F2 R2")
    },
    {
      id: 'topCorners-c',
      stage: 'topCorners',
      setup: parseAlgorithm("R' F R' B2 R F' R' B2 R2 U R' F R' B2 R F' R' B2 R2")
    }
  ],
  topEdges: [
    {
      id: 'topEdges-a',
      stage: 'topEdges',
      setup: parseAlgorithm("R U' R U R U R U' R' U' R2")
    },
    {
      id: 'topEdges-b',
      stage: 'topEdges',
      setup: parseAlgorithm("R2 U' R' U' R U R U R U' R")
    },
    {
      id: 'topEdges-c',
      stage: 'topEdges',
      setup: parseAlgorithm("R2 U2 R' U2 R2 U2 R2 U2 R' U2 R2")
    }
  ]
}

export const PRACTICE_SAMPLES: Record<StageId, PracticeSample[]> = Object.fromEntries(
  Object.entries(RAW_SAMPLES).map(([stage, list]) => [stage, list.map((sample) => ({ ...sample, ...getSample(sample.id) }))])
) as Record<StageId, PracticeSample[]>
