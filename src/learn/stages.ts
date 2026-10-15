import type { CubieState } from '../smart-solver/core/types'
import {
  allDone,
  cornersDone,
  crossDone,
  f2lDone,
  firstLayerDone,
  topCrossDone,
  topFaceDone
} from './goals'

export type StageId = 'cross' | 'corners' | 'middle' | 'topCross' | 'topFace' | 'topCorners' | 'topEdges'

export interface StageDef {
  id: StageId
  index: number // 0..6, hiển thị "Giai đoạn index+1/7"
  prerequisite: StageId | null // giai đoạn phải xong trước (null cho 'cross')
  isDone(state: CubieState): boolean // mục tiêu học: U trước, D cuối (goals.ts)
}

export const STAGES: readonly StageDef[] = [
  {
    id: 'cross',
    index: 0,
    prerequisite: null,
    isDone: crossDone
  },
  {
    id: 'corners',
    index: 1,
    prerequisite: 'cross',
    isDone: firstLayerDone
  },
  {
    id: 'middle',
    index: 2,
    prerequisite: 'corners',
    isDone: f2lDone
  },
  {
    id: 'topCross',
    index: 3,
    prerequisite: 'middle',
    isDone: topCrossDone
  },
  {
    id: 'topFace',
    index: 4,
    prerequisite: 'topCross',
    isDone: topFaceDone
  },
  {
    id: 'topCorners',
    index: 5,
    prerequisite: 'topFace',
    isDone: cornersDone
  },
  {
    id: 'topEdges',
    index: 6,
    prerequisite: 'topCorners',
    isDone: allDone
  }
] as const

const STAGE_BY_ID = new Map<StageId, StageDef>(STAGES.map((s) => [s.id, s]))

export function getStageDef(id: StageId): StageDef {
  const def = STAGE_BY_ID.get(id)
  if (!def) {
    throw new Error(`Unknown stage id: ${id}`)
  }
  return def
}
