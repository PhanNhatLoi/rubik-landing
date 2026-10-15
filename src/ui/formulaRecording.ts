import type { CubeController } from '../smart-solver/adapter/types'
import { fromFacelets } from '../smart-solver/core/facelets'
import { f2lDone, topCrossDone } from '../smart-solver/nxn/beginner'
import { formulaNotation } from '../learn/guide/formulaLog'

export interface FormulaSnapshot {
  /** Fixed scene frame, engine sticker order, color labels 0..5 = URFDLB. */
  stickers: readonly number[]
  /** Center-relative state; use the fixed stickers for replay when centers have moved. */
  facelets: string
}
export interface RecordedFormulaTurn { token: string; after: FormulaSnapshot }

export function readFormulaSnapshot(controller: Pick<CubeController, 'getStickers' | 'getFacelets'>): FormulaSnapshot {
  return { stickers: Array.from(controller.getStickers()), facelets: controller.getFacelets() }
}

const describe = (state: FormulaSnapshot) => {
  const parsed = fromFacelets(state.facelets)
  return {
    ...state,
    upEdges: ['UR', 'UF', 'UL', 'UB'].filter((_, i) => state.facelets[[5, 7, 3, 1][i]!] === 'U'),
    lowerTwoLayersSolved: parsed.ok ? f2lDone(parsed.state) : null,
    topCrossDone: parsed.ok ? topCrossDone(parsed.state) : null
  }
}

export function formatSceneFormulaLog(start: FormulaSnapshot, turns: readonly RecordedFormulaTurn[]): string {
  return JSON.stringify({
    format: 'rubik-formula-v2', size: 3,
    frame: 'Fixed scene U=top, R=right, F=front. Stickers use engine order and color labels 0..5 = URFDLB. Facelets are center-relative.',
    algorithm: turns.map((t) => formulaNotation(t.token)).join(' '),
    start: describe(start),
    steps: turns.map((t, i) => ({ step: i + 1, notation: formulaNotation(t.token), fixedToken: t.token, after: describe(t.after) })),
    end: describe(turns.at(-1)?.after ?? start)
  }, null, 2)
}
