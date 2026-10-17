import { applyMoves } from '../../smart-solver/core/cubie'
import type { CubieState, Face, Move } from '../../smart-solver/core/types'
import { EDGE_COLORS } from '../../smart-solver/core/facelets'
import { topCrossDone } from '../goals'
import type { ColorNames } from './crossGuide'
import { LAST_EDGES_VARIANTS, lastEdgesDone, type LastEdgesGuide } from './lastEdgesGuide'
import { applyNotation, fromCubie, toCubie } from './physical'

export const LAST_EDGE_RING = [5, 4, 7, 6] as const // F → R → B → L
const ALIGNMENTS: Move[][] = [[], ['D'], ["D'"], ['D2']]
export const lastEdgesOrderDone = (s: CubieState) => topCrossDone(s) && ALIGNMENTS.some((d) => lastEdgesDone(applyMoves(s, d)))
export const lastEdgesOrderKey = (s: CubieState) => {
  const ring = LAST_EDGE_RING.map((i) => s.ep[i]!)
  const first = ring.indexOf(5)
  return [...ring.slice(first), ...ring.slice(0, first)].join('-')
}
export function lastEdgesOrderOptions(state: CubieState) {
  if (!topCrossDone(state) || lastEdgesOrderDone(state)) return []
  return LAST_EDGES_VARIANTS.filter((v) => lastEdgesOrderDone(applyMoves(state, v.moves)))
}
export function lastEdgesOrderChoices(state: CubieState) {
  if (!topCrossDone(state) || lastEdgesOrderDone(state)) return []
  const direct = lastEdgesOrderOptions(state)
  return direct.length ? direct : LAST_EDGES_VARIANTS.filter((v) => v.direction === 'right')
}

/** Teach cyclic order first. Center alignment is a separate final D turn. */
export function buildLastEdgesOrderGuide(state: CubieState, names: ColorNames, front?: Face): LastEdgesGuide | null {
  if (!topCrossDone(state) || lastEdgesDone(state)) return null
  const ordered = lastEdgesOrderDone(state)
  const direct = lastEdgesOrderOptions(state)
  const choices = lastEdgesOrderChoices(state)
  const variant = ordered ? null : choices.find((v) => v.front === front) ?? choices[0]!
  const moves = ordered ? ALIGNMENTS.find((d) => lastEdgesDone(applyMoves(state, d)))! : variant!.moves
  const kind = ordered ? 'align' : direct.length ? 'cycle' : 'prepare'
  const source = variant ? ({ F: 5, R: 4, B: 7, L: 6 } as Partial<Record<Face, number>>)[variant.direction === 'right' ? variant.right : variant.left]! : 4
  const piece = state.ep[source]!
  const title = ordered ? 'Thứ tự đã đúng — căn D lần cuối' : kind === 'prepare' ? 'Đổi vòng một lượt để tạo tổ hợp giải được' : 'Giữ cạnh mốc, đưa bốn cạnh về đúng thứ tự'
  const intro = ordered
    ? 'Bốn cạnh đã đúng thứ tự quanh đáy. Bây giờ chỉ căn D để chúng về đúng vị trí trên khối; không cần thêm lượt công thức.'
    : `Giữ cạnh ${names[EDGE_COLORS[state.ep[variant!.anchor]!]![1]]} ở vị trí ${variant!.front} làm F mốc, không chọn theo màu tâm. Dùng bản ${variant!.direction === 'right' ? 'R′' : 'L'} theo mốc này. Chuỗi bên dưới đã ghi sẵn theo đúng các mặt của khối bạn đang cầm. ${kind === 'prepare' ? 'Sau lượt này, quan sát thứ tự mới để chọn mốc cho lượt cuối.' : 'Sau lượt này, thứ tự sẽ đúng; nếu cần thì căn D ở cuối.'}`
  const explanations = [
    'Bắt đầu từ mặt bên theo mốc đã chọn. Theo dõi thứ tự cạnh, bỏ qua tâm và các khối khác.',
    'Xoay D2: hai lần cùng chiều để đủ nửa vòng.',
    'Trả mặt bên để đưa cạnh sang phần tiếp theo của đường đi.',
    'Chuyển nhóm cạnh qua tầng đáy.',
    'Mở mặt bên lần nữa để tiếp tục đổi vòng.',
    'Chuyển tầng đáy lần cuối trong công thức.',
    'Trả mặt bên. Dừng quan sát thứ tự bốn cạnh; hai tầng trên và dấu cộng được khôi phục.'
  ]
  const steps = moves.map((notation, i) => ({ notation, why: ordered ? 'Đây chỉ là nước căn D cuối cùng, sau khi thứ tự bốn cạnh đã đúng.' : explanations[i]! }))
  const states: CubieState[] = []
  const halves: CubieState[][] = []
  let physical = fromCubie(state)
  for (let i = 0; i <= steps.length; i += 1) {
    const current = toCubie(physical)
    if (!current) return null
    states.push(current)
    if (i < steps.length) {
      const move = steps[i]!.notation
      halves.push(move.endsWith('2') ? [move[0]!, `${move[0]}'`].map((q) => toCubie(applyNotation(physical, q))).filter((s): s is CubieState => !!s) : [])
      physical = applyNotation(physical, move)
    }
  }
  return { kind, front: variant?.front ?? null, direction: variant?.direction ?? null, formula: moves.join(' ').replaceAll("'", '′'), title, intro, piece, alignmentSteps: 0, steps, states, halves }
}
