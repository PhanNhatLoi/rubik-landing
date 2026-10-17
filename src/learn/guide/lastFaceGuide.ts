import { applyMoves, parseAlgorithm, SOLVED } from '../../smart-solver/core/cubie'
import { CORNER_FACELETS, toFacelets } from '../../smart-solver/core/facelets'
import type { CubieState, Face, Move } from '../../smart-solver/core/types'
import { lastCornersPositionDone } from './lastCornersGuide'
import { applyNotation, fromCubie, toCubie } from './physical'

// Keep the two halves together: only the full pair restores all four edges.
export const LAST_FACE_RIGHT = parseAlgorithm("R' D' D' R D R' D R L D D L' D' L D' L'")
export const LAST_FACE_LEFT = parseAlgorithm("L D D L' D' L D' L' R' D' D' R D R' D R")
const SIDES: Face[] = ['F', 'R', 'B', 'L']
export const lastFaceDone = (s: CubieState) => lastCornersPositionDone(s) && s.co.every((v) => v === 0)
export const LAST_FACE_VARIANTS = SIDES.flatMap((front, yaw) => (['right', 'left'] as const).map((side) => {
  const moves = (side === 'right' ? LAST_FACE_RIGHT : LAST_FACE_LEFT).map((m) => {
    const i = SIDES.indexOf(m[0] as Face)
    return `${i < 0 ? m[0] : SIDES[(i + yaw) % 4]}${m.slice(1)}` as Move
  })
  const effect = applyMoves(SOLVED, moves)
  const affected = [4, 5, 6, 7].filter((i) => effect.co[i] !== 0)
  // The front corner is identified by its position's F sticker, independent of its current twist.
  const frontCorner = affected.find((i) => CORNER_FACELETS[i]!.some((f) => Math.floor(f / 9) === 'URFDLB'.indexOf(front)))!
  return { id: `${front}-${side}`, front, side, moves, affected, corner: frontCorner, effect }
}))
export type LastFaceVariant = typeof LAST_FACE_VARIANTS[number]
const key = (s: CubieState) => s.co.slice(4).join('')
const routes = new Map<string, Move[]>([['0000', []]])
const states = new Map<string, CubieState>([['0000', SOLVED]])
const queue = [SOLVED]
for (let i = 0; i < queue.length; i++) for (const v of LAST_FACE_VARIANTS) {
  const state = applyMoves(queue[i]!, v.moves)
  if (routes.has(key(state))) continue
  routes.set(key(state), [...routes.get(key(queue[i]!))!, ...v.moves]); states.set(key(state), state); queue.push(state)
}
export const LAST_FACE_SAMPLES = [...states.values()].map((state) => ({ state, setup: routes.get(key(state))!, wrong: state.co.slice(4).filter(Boolean).length }))
export function lastFaceChoices(s: CubieState) {
  if (!lastCornersPositionDone(s) || lastFaceDone(s)) return []
  const facelets = toFacelets(s)
  return LAST_FACE_VARIANTS.filter((v) => facelets[CORNER_FACELETS[v.corner]![0]] === v.front)
    .sort((a, b) => routes.get(key(applyMoves(s, a.moves)))!.length - routes.get(key(applyMoves(s, b.moves)))!.length)
}
export function buildLastFaceGuide(state: CubieState, preferred?: string) {
  const choices = lastFaceChoices(state)
  const variant = choices.find((v) => v.id === preferred) ?? choices[0]
  if (!variant) return null
  let physical = fromCubie(state)
  const states: CubieState[] = [state]
  const steps = variant.moves.map((notation, i) => {
    physical = applyNotation(physical, notation)
    states.push(toCubie(physical)!)
    return { notation, why: i === 7 ? 'Xong nửa đầu: cạnh còn đang đổi chỗ. Tiếp tục ngay nửa đối diện.' : i === 15 ? 'Đủ hai nửa: cạnh và vị trí góc đã trở lại. Quan sát mặt dưới để chọn lượt tiếp theo.' : i < 8 ? 'Làm nửa đầu từ phía đã chọn.' : 'Làm nửa đối diện để trả các cạnh về đúng chỗ.' }
  })
  return { variant, steps, states, halves: steps.map(() => [] as CubieState[]), formula: compactHalfTurns(variant.moves).replaceAll("'", '′') }
}

/** The formula as the learner reads it: a pair of equal quarter turns of D is one half turn ("D D" is D2, "D' D'" is D2'). */
export interface FormulaToken { token: string; from: number; to: number }
export function formulaTokens(moves: readonly string[]): FormulaToken[] {
  const tokens: FormulaToken[] = []
  for (let i = 0; i < moves.length; i += 1) {
    const move = moves[i]!
    if ((move === 'D' || move === "D'") && moves[i + 1] === move) {
      tokens.push({ token: move === 'D' ? 'D2' : "D2'", from: i, to: i + 1 })
      i += 1
    } else tokens.push({ token: move, from: i, to: i })
  }
  return tokens
}
export const compactHalfTurns = (moves: readonly string[]): string => formulaTokens(moves).map((t) => t.token).join(' ')
