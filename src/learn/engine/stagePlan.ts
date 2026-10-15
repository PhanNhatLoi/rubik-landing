import type { CubieState } from '../../smart-solver/core/types'
import { STAGES, type StageDef, type StageId } from '../stages'

export interface StageRange {
  stageId: StageId
  start: number
  end: number
}

/** `solveBeginner3` returns several steps per stage; merge neighbours that share a stage. */
export function groupStageRanges(steps: readonly { stageId?: string; start: number; end: number }[]): StageRange[] {
  const ranges: StageRange[] = []
  for (const st of steps) {
    if (!st.stageId || st.end <= st.start) continue
    const last = ranges[ranges.length - 1]
    if (last && last.stageId === st.stageId && last.end === st.start) last.end = st.end
    else ranges.push({ stageId: st.stageId as StageId, start: st.start, end: st.end })
  }
  return ranges
}

export function findStageRange(ranges: readonly StageRange[], index: number): StageRange | null {
  return ranges.find((r) => index >= r.start && index < r.end) ?? null
}

/** First stage whose goal the cube has not reached yet (the last stage when everything is done). */
export function stageInProgress(state: CubieState): StageDef {
  return STAGES.find((s) => !s.isDone(state)) ?? STAGES[STAGES.length - 1]!
}

/** First unfinished stage at or after `from`, or null when the cube is past all of them. */
export function firstUndoneFrom(from: StageDef, state: CubieState): StageDef | null {
  return STAGES.find((s) => s.index >= from.index && !s.isDone(state)) ?? null
}
