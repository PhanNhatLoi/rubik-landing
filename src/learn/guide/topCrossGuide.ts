import { applyMoves, parseAlgorithm } from '../../smart-solver/core/cubie'
import type { CubieState, Move } from '../../smart-solver/core/types'
import { EDGE_COLORS } from '../../smart-solver/core/facelets'
import { f2lDone } from '../../smart-solver/nxn/beginner'
import { edgeCell } from '../cells'
import type { ColorNames, GuideStep } from './crossGuide'
import { applyNotation, fromCubie, toCubie } from './physical'

export type TopCrossMethod = 'single' | 'dual'

/** User's formula: target cross on D, correctly facing down at DF–DR. */
export const BOTTOM_CROSS_L_ALG = parseAlgorithm("L' F' D F L B D' B'")
/** Same method with the target on U, rotated 180° about the left–right axis: D↔U, F↔B. */
const FLIPPED_FACE: Record<string, string> = { U: 'D', D: 'U', F: 'B', B: 'F', R: 'R', L: 'L' }
export const TOP_CROSS_L_ALG: Move[] = BOTTOM_CROSS_L_ALG.map((move) => `${FLIPPED_FACE[move[0]!]!}${move.slice(1)}` as Move)
export const TOP_CROSS_ALG = parseAlgorithm("F R U R' U' F'")
export const TOP_SLOTS = [0, 1, 2, 3] as const // UR, UF, UL, UB
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

const PREFIXES: readonly Move[][] = [[], ['U'], ["U'"], ['U2']]

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

/** One teaching round; the chosen method decides whether L goes directly to the cross. */
export function buildTopCrossGuide(state: CubieState, names: ColorNames, method: TopCrossMethod = 'single'): TopCrossGuide | null {
  if (!f2lDone(state)) return null
  const kind = topCrossPattern(state)
  if (kind === 'cross') return null
  const useL = method === 'dual' && kind !== 'line'
  const directL = useL && kind === 'elbow'
  const algorithm = useL ? TOP_CROSS_L_ALG : TOP_CROSS_ALG
  const expected: TopCrossPattern = kind === 'dot' ? 'elbow' : kind === 'line' || directL ? 'cross' : 'line'
  const formula = algorithm.join(' ').replaceAll("'", '′')
  // Try the four ways to hold the pattern using U only; the learner keeps the cube facing forward.
  const prefix = PREFIXES.find((p) => {
    const aligned = applyMoves(state, p)
    if (kind === 'elbow' && !(useL ? [0, 3] : [2, 3]).every((slot) => aligned.eo[slot] === 0)) return false
    if (kind === 'line' && ![0, 2].every((slot) => aligned.eo[slot] === 0)) return false
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
    ? 'Đặt hai cạnh đang hướng lên thành hàng ngang trái–phải (UL và UR), nhìn từ mặt trước F.'
    : useL
      ? 'Đặt hai cạnh đang hướng lên ở phía sau và bên phải (UB và UR), nhìn từ mặt trước F: chữ L nằm ở góc sau–phải.'
      : 'Đặt hai cạnh đang hướng lên ở phía sau và bên trái (UB và UL), nhìn từ mặt trước F: chữ L nằm ở góc sau–trái.'
  const finish = `Hai tầng dưới được khôi phục. Nhìn lại mặt trên: từ ${PATTERN_LABEL[kind].toLowerCase()} đã thành ${PATTERN_LABEL[next].toLowerCase()}. Dừng ở đây để quan sát.`
  const explanations = useL ? [
    `Mở mặt trái bằng L′ (${names.L}) để tạo đường đi cho các cạnh. Một phần hai tầng dưới đi theo tạm thời; mình sẽ trả mặt trái về bằng L.`,
    `Xoay mặt sau B′ (${names.B}) để bắt đầu nhịp B′ U B. Nhịp này phối hợp mặt sau với tầng trên để các cạnh đổi đường đi.`,
    'Xoay tầng trên U để chuyển nhóm cạnh sang vị trí mới trước khi trả mặt sau về.',
    'Trả mặt sau bằng B. Vì tầng trên đã xoay ở giữa nên B tác động lên nhóm khối khác, không đơn giản huỷ B′ ban đầu.',
    'Trả mặt trái bằng L để đóng phần đã mở lúc đầu. Chưa dừng: vẫn còn nhịp F U′ F′ để khôi phục đủ hai tầng dưới.',
    `Xoay mặt trước F (${names.F}) để mở đường cho nhịp cuối F U′ F′.`,
    'Xoay tầng trên ngược lại bằng U′, đưa nhóm cạnh về đường đi để đóng mặt trước.',
    `Trả mặt trước bằng F′. ${finish}`
  ] : [
    `Xoay mặt trước F (${names.F}) để mở đường cho cạnh ${edge} đổi hướng. Một phần hai tầng dưới đi theo tạm thời; mình sẽ trả lại ở cuối công thức.`,
    `Xoay mặt phải R (${names.R}) trước để đưa các cạnh vào vị trí làm việc. Nhịp giữa của công thức này là R U R′ U′.`,
    'Xoay tầng trên U để đưa cạnh vừa nâng lên sang vị trí mới, trước khi trả mặt phải về.',
    'Trả mặt phải bằng R′. Vì tầng trên đã xoay ở giữa nên R′ đưa một nhóm khối khác trở lại, không huỷ đơn giản nước R ban đầu.',
    'Xoay tầng trên ngược lại bằng U′ để kết thúc nhịp giữa, chuẩn bị đóng mặt trước.',
    `Trả mặt trước bằng F′. ${finish}`
  ]
  const steps: GuideStep[] = [
    ...prefix.map((notation) => ({ notation, why: `Chỉ xoay tầng trên, giữ nguyên cách cầm khối. ${align} Hai tầng dưới không bị ảnh hưởng.` })),
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
    marks.push([[1, 2, 1], edgeCell(current.ep.indexOf(piece))])
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
    intro: `Chỉ nhìn tâm và 4 cạnh màu ${names.U} trên mặt U, bỏ qua các góc. ${kind === 'dot' ? 'Chưa có cạnh nào hướng lên; không cần căn tầng trên.' : align} Làm một lượt ${formula} rồi dừng. Cạnh ${edge} được đánh dấu để bạn theo dõi; công thức tác động lên cả nhóm cạnh, không lắp riêng từng cạnh như bài 2.`,
    steps, states, halves, marks
  }
}
