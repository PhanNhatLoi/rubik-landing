import { STAGES, type StageId } from '../stages'

const STORAGE_KEY = 'rubik.learn.progress.white-top-v2'

export interface LearnProgress {
  completed: StageId[]
  practiced: StageId[]
}

const DEFAULT_PROGRESS: LearnProgress = {
  completed: [],
  practiced: []
}

let inMemoryProgress: LearnProgress = { ...DEFAULT_PROGRESS }

const VALID_IDS = new Set<string>(STAGES.map((st) => st.id))
const onlyStages = (v: unknown): StageId[] =>
  Array.isArray(v) ? v.filter((x): x is StageId => typeof x === 'string' && VALID_IDS.has(x)) : []

export function getLearnProgress(): LearnProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return inMemoryProgress
    const parsed = JSON.parse(raw) as Partial<LearnProgress>
    return {
      completed: onlyStages(parsed.completed),
      practiced: onlyStages(parsed.practiced)
    }
  } catch {
    return inMemoryProgress
  }
}

export function markStageCompleted(stageId: StageId): void {
  try {
    const current = getLearnProgress()
    if (!current.completed.includes(stageId)) {
      current.completed.push(stageId)
      inMemoryProgress = current
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    }
  } catch {
    if (!inMemoryProgress.completed.includes(stageId)) {
      inMemoryProgress.completed.push(stageId)
    }
  }
}

export function markStagePracticed(stageId: StageId): void {
  try {
    const current = getLearnProgress()
    if (!current.practiced.includes(stageId)) {
      current.practiced.push(stageId)
      inMemoryProgress = current
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    }
  } catch {
    if (!inMemoryProgress.practiced.includes(stageId)) {
      inMemoryProgress.practiced.push(stageId)
    }
  }
}
