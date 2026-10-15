import type { Move } from '../../smart-solver/core/types'
import type { StageId } from '../stages'
import guideData from './guide-copy.vi.json'

export interface MoveCopy {
  title: string
  hint: string
}

export interface StageCopy {
  id: StageId
  title: string
  goal: string
  why: string
  check: string[]
}

export interface GuideCopyData {
  moves: Record<string, MoveCopy>
  stages: StageCopy[]
  situations: Record<string, string>
  practiceSamples: Record<string, { label: string; desc: string }>
}

const copy = guideData as GuideCopyData

const STAGE_COPY_MAP = new Map<StageId, StageCopy>(
  copy.stages.map((s) => [s.id as StageId, s])
)

export function getMove(move: Move): MoveCopy {
  const entry = copy.moves[move]
  if (!entry) {
    return {
      title: move,
      hint: `Xoay nước ${move}`
    }
  }
  return entry
}

export function getStage(id: StageId): StageCopy {
  const entry = STAGE_COPY_MAP.get(id)
  if (!entry) {
    throw new Error(`Unknown stage copy for id: ${id}`)
  }
  return entry
}

export function getSample(id: string): { label: string; desc: string } {
  return copy.practiceSamples[id] ?? { label: id, desc: '' }
}

export function format(key: string, params: Record<string, string | number> = {}): string {
  const template = copy.situations[key] ?? key
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    return token in params ? String(params[token]) : `{${token}}`
  })
}

export { copy as guideCopy }
