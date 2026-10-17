import { applyMoves, invertMoves, parseAlgorithm, SOLVED } from '../../smart-solver/core/cubie'
import type { Move } from '../../smart-solver/core/types'
import { formulaPreviewSteps } from '../guide/formulaPreview'

export const formulaPreviewBefore = (moves: readonly string[] | string) =>
  applyMoves(SOLVED, invertMoves(formulaPreviewSteps(moves).steps.map((s) => s.notation as Move)))
export const CORNER_FORMULA_PREVIEWS = [
  { title: 'Lắp góc từ phía phải', moves: parseAlgorithm("R' D' R") },
  { title: 'Lắp góc từ phía trái', moves: parseAlgorithm("L D L'") }
].map((v) => ({ ...v, before: formulaPreviewBefore(v.moves) }))
