import { applyMoves, parseAlgorithm } from '../../smart-solver/core/cubie'
import type { CubieState, Move } from '../../smart-solver/core/types'
import { EDGE_COLORS } from '../../smart-solver/core/facelets'
import { f2lDone } from '../goals'
import { edgeCell } from '../cells'
import type { ColorNames, GuideStep } from './crossGuide'
import { applyNotation, fromCubie, toCubie } from './physical'

export type TopCrossMethod = 'single' | 'dual'

/** User's formula: target cross on D, correctly facing down at DF–DR. */
export const BOTTOM_CROSS_L_ALG = parseAlgorithm("L' F' D F L B D' B'")
/** Stage id stays topCross for compatibility; the last layer is physically D now. */
export const TOP_CROSS_L_ALG: Move[] = [...BOTTOM_CROSS_L_ALG]
export const TOP_CROSS_ALG = parseAlgorithm("B R D R' D' B'")
export const TOP_SLOTS = [4, 5, 6, 7] as const // DR, DF, DL, DB
export type TopCrossPattern = 'dot' | 'elbow' | 'line' | 'cross'
export const PATTERN_LABEL: Record<TopCrossPattern, string> = {
  dot: 'Chấm', elbow: 'Chữ L', line: 'Hai cạnh đối', cross: 'Dấu cộng'
}

/** Only orientation matters here. Side colors and the four corners belong to later lessons. */
export function topCrossPattern(state: CubieState): TopCrossPattern {
  const up = TOP_SLOTS.filter((i) => state.eo[i] === 0)
  if (up.length === 4) return 'cross'
  if (up.length === 0) return 'dot'
  return up.length === 2 && Math.abs(up[0]! - up[1]!) === 2 ? 'line' : 'elbow'
}

const PREFIXES: readonly Move[][] = [[], ['D'], ["D'"], ['D2']]

export interface TopCrossGuide {
  method: TopCrossMethod
  formula: string
  piece: number
  edge: string
  kind: Exclude<TopCrossPattern, 'cross'>
  next: TopCrossPattern
  title: string
  intro: string
  steps: GuideStep[]
  states: CubieState[]
  halves: CubieState[][]
  marks: number[][][]
}

/** One teaching round: single always uses L; dual uses the line formula for opposite edges. */
export function buildTopCrossGuide(state: CubieState, names: ColorNames, method: TopCrossMethod = 'single'): TopCrossGuide | null {
  if (!f2lDone(state)) return null
  const kind = topCrossPattern(state)
  if (kind === 'cross') return null
  const useL = method === 'single' || kind !== 'line'
  const algorithm = useL ? TOP_CROSS_L_ALG : TOP_CROSS_ALG
  const expected: TopCrossPattern = useL && kind !== 'elbow' ? 'elbow' : 'cross'
  const formula = algorithm.join(' ').replaceAll("'", '′')
  // Align using D only; the learner keeps the cube facing forward.
  const prefix = PREFIXES.find((p) => {
    const aligned = applyMoves(state, p)
    if (kind === 'elbow' && ![4, 5].every((slot) => aligned.eo[slot] === 0)) return false
    if (kind === 'line' && ![4, 6].every((slot) => aligned.eo[slot] === 0)) return false
    const end = applyMoves(aligned, algorithm)
    return f2lDone(end) && topCrossPattern(end) === expected
  })
  if (!prefix) return null
  const end = applyMoves(state, [...prefix, ...algorithm])
  const next = topCrossPattern(end)
  // Follow one previously sideways edge that this round turns face-up.
  const slot = TOP_SLOTS.find((i) => state.eo[i] !== 0 && end.eo[end.ep.indexOf(state.ep[i]!)] === 0)!
  const piece = state.ep[slot]!
  const pair = EDGE_COLORS[piece]!
  const edge = `${names[pair[0]]}–${names[pair[1]]}`
  const align = kind === 'line'
    ? 'Đặt hai cạnh đang hướng xuống thành hàng trái–phải (DL và DR), nhìn theo mặt trước F.'
    : 'Đặt hai cạnh đang hướng xuống ở phía trước và bên phải (DF và DR): chữ L ở trước–phải.'
  const finish = `Hai tầng phía trên được khôi phục. Nhìn mặt đáy: từ ${PATTERN_LABEL[kind].toLowerCase()} đã thành ${PATTERN_LABEL[next].toLowerCase()}. Dừng ở đây để quan sát.`
  const explanations = useL ? [
    `Mở mặt trái bằng L′ (${names.L}) để tạo đường đi cho các cạnh. Một phần hai tầng phía trên đi theo tạm thời; mình sẽ trả mặt trái bằng L.`,
    `Xoay mặt trước F′ (${names.F}) để bắt đầu nhịp F′ D F, phối hợp mặt trước và tầng đáy.`,
    'Xoay tầng đáy D để đưa nhóm cạnh sang vị trí mới trước khi trả mặt trước về.',
    'Trả mặt trước bằng F. Vì tầng đáy đã xoay ở giữa nên F đưa một nhóm khối khác trở lại, không đơn giản huỷ F′ ban đầu.',
    'Trả mặt trái bằng L. Chưa dừng: còn nhịp B D′ B′ để hoàn thiện và khôi phục đủ hai tầng phía trên.',
    `Xoay mặt sau B (${names.B}) để mở đường cho nhịp cuối B D′ B′.`,
    'Xoay tầng đáy ngược lại bằng D′ để đưa nhóm cạnh về đường đi đóng mặt sau.',
    `Trả mặt sau bằng B′. ${finish}`
  ] : [
    `Xoay mặt sau B (${names.B}) để mở đường cho cạnh ${edge} đổi hướng. Mình sẽ trả mặt sau ở cuối công thức.`,
    `Xoay mặt phải R (${names.R}) để bắt đầu nhịp R D R′ D′. Các khối tầng trên ở mặt này đi theo tạm thời.`,
    'Xoay tầng đáy D để đưa các cạnh sang vị trí mới, trước khi trả mặt phải về.',
    'Trả mặt phải bằng R′. Tầng đáy đã xoay ở giữa nên nước này tác động lên nhóm khối khác, không đơn giản huỷ R ban đầu.',
    'Xoay tầng đáy ngược lại bằng D′ để kết thúc nhịp giữa, chuẩn bị đóng mặt sau.',
    `Trả mặt sau bằng B′. ${finish}`
  ]
  const steps: GuideStep[] = [
    ...prefix.map((notation) => ({ notation, why: `Chỉ xoay tầng đáy, giữ nguyên cách cầm khối. ${align} Hai tầng phía trên không bị ảnh hưởng.` })),
    ...algorithm.map((notation, i) => ({ notation, why: explanations[i]! }))
  ]
  const states: CubieState[] = []
  const halves: CubieState[][] = []
  const marks: number[][][] = []
  let physical = fromCubie(state)
  for (let i = 0; i <= steps.length; i += 1) {
    const current = toCubie(physical)
    if (!current) return null
    states.push(current)
    marks.push([[1, 0, 1], edgeCell(current.ep.indexOf(piece))])
    if (i < steps.length) {
      const token = steps[i]!.notation
      halves.push(token.endsWith('2')
        ? [token[0]!, `${token[0]}'`].map((q) => toCubie(applyNotation(physical, q))).filter((s): s is CubieState => s !== null)
        : [])
      physical = applyNotation(physical, token)
    }
  }
  return {
    method, formula, piece, edge, kind, next, title: `${PATTERN_LABEL[kind]} → ${PATTERN_LABEL[next]}`,
    intro: `Chỉ nhìn tâm và 4 cạnh màu ${names.D} ở mặt đáy D, bỏ qua các góc. ${kind === 'dot' ? 'Chưa có cạnh nào hướng xuống; không cần căn tầng đáy.' : align} Làm một lượt ${formula} rồi dừng. Cạnh ${edge} được đánh dấu để bạn theo dõi; công thức tác động lên cả nhóm cạnh, không lắp riêng từng cạnh như bài 2.`,
    steps, states, halves, marks
  }
}
