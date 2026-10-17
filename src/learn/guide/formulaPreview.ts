import type { CubieState } from '../../smart-solver/core/types'
import { stickerModelToFacelets } from '../../smart-solver/adapter/stickerModel'
import { applyNotation, fromCubie, type Physical } from './physical'

/** Expand half turns for slow quarter-by-quarter playback, retaining the printed token index. */
export function formulaPreviewSteps(moves: readonly string[] | string) {
  const tokens = (typeof moves === 'string' ? moves.split(/\s+/) : [...moves]).filter((m) => m && m !== '·')
  const steps = tokens.flatMap((token, tokenIndex) => {
    const m = /^([URFDLBMES])(2)?(['′])?$/.exec(token)
    if (!m) throw new Error(`Ký hiệu xoay không hợp lệ: ${token}`)
    const notation = `${m[1]}${m[3] ? "'" : ''}`
    return Array.from({ length: m[2] ? 2 : 1 }, () => ({ notation, tokenIndex }))
  })
  return { tokens, steps }
}
export function formulaPreviewFrames(state: CubieState, moves: readonly string[] | string) {
  const { tokens, steps } = formulaPreviewSteps(moves)
  const physical: Physical[] = [fromCubie(state)]
  for (const step of steps) physical.push(applyNotation(physical.at(-1)!, step.notation))
  return { tokens, steps, physical, facelets: physical.map((p) => stickerModelToFacelets(p, (s) => s)) }
}
/** Follow colored pieces by identity, so the glow moves with them throughout a formula. */
export function formulaPreviewCells(start: Physical, current: Physical, cells: readonly number[][]) {
  const identity = (c: Physical[number]) => Object.values(c.stickers).filter(Boolean).sort().join('')
  const tracked = new Set(start.filter((c) => cells.some(([x, y, z]) => c.grid.x === x && c.grid.y === y && c.grid.z === z)).map(identity))
  return current.filter((c) => tracked.has(identity(c))).map((c) => [c.grid.x, c.grid.y, c.grid.z])
}
