import { applyMoves, parseAlgorithm } from '../../smart-solver/core/cubie'
import type { CubieState, Face, Move } from '../../smart-solver/core/types'
import { LAST_EDGES, edgeDone, topCrossDone } from '../goals'
import { edgeCell } from '../cells'
import type { ColorNames, GuideStep } from './crossGuide'
import { applyNotation, fromCubie, toCubie } from './physical'

export const LAST_EDGES_RIGHT = parseAlgorithm("R' D2 R D R' D R")
export const LAST_EDGES_LEFT = parseAlgorithm("L D2 L' D' L D' L'")
const SIDES: Face[] = ['F', 'R', 'B', 'L']
const SLOT: Partial<Record<Face, number>> = { R: 4, F: 5, L: 6, B: 7 }
const PREFIXES: Move[][] = [[], ['D'], ["D'"], ['D2']]
export const lastEdgesDone = (s: CubieState) => topCrossDone(s) && LAST_EDGES.every((i) => edgeDone(s, i))
export const matchingLastEdges = (s: CubieState) => LAST_EDGES.filter((i) => edgeDone(s, i))

export const LAST_EDGES_VARIANTS = SIDES.flatMap((front, yaw) => {
  const face = (f: Face): Face => {
    const i = SIDES.indexOf(f)
    return i < 0 ? f : SIDES[(i + yaw) % 4]!
  }
  return ([['right', LAST_EDGES_RIGHT], ['left', LAST_EDGES_LEFT]] as const).map(([direction, base]) => ({
    front, right: face('R'), left: face('L'), back: face('B'), direction,
    anchor: SLOT[front]!,
    moves: base.map((m) => `${face(m[0] as Face)}${m.slice(1)}` as Move)
  }))
})

/** Verified choices: first align D, then hold the matching edge and choose the cycle direction. */
export function lastEdgesCycleOptions(state: CubieState) {
  if (!topCrossDone(state)) return []
  return PREFIXES.flatMap((alignment) => {
    const aligned = applyMoves(state, alignment)
    if (matchingLastEdges(aligned).length !== 1) return []
    return LAST_EDGES_VARIANTS.filter((v) => aligned.ep[v.anchor] === v.anchor && lastEdgesDone(applyMoves(aligned, v.moves)))
      .map((variant) => ({ alignment, state: aligned, variant }))
  })
}

export interface LastEdgesGuide {
  kind: 'align' | 'cycle' | 'prepare'
  front: Face | null
  direction: 'right' | 'left' | null
  formula: string
  title: string
  intro: string
  piece: number
  alignmentSteps: number
  steps: GuideStep[]
  states: CubieState[]
  halves: CubieState[][]
}

/** One round: align D, solve a three-cycle, or prepare the opposite-pair case. */
export function buildLastEdgesGuide(state: CubieState, names: ColorNames): LastEdgesGuide | null {
  if (!topCrossDone(state) || lastEdgesDone(state)) return null
  const alignments = PREFIXES.map((moves) => ({ moves, state: applyMoves(state, moves) }))
  const finished = alignments.find((a) => lastEdgesDone(a.state))
  const choice = lastEdgesCycleOptions(state)[0]
  const aligned = finished ?? (choice ? { moves: choice.alignment, state: choice.state } : alignments[0]!)
  const variant = finished ? null : choice?.variant ?? LAST_EDGES_VARIANTS[0]!
  if (!finished && !variant) return null
  const kind = finished ? 'align' : choice ? 'cycle' : 'prepare'
  const formula = variant?.moves.join(' ').replaceAll("'", '′') ?? aligned.moves.join(' ').replaceAll("'", '′')
  const title = kind === 'align' ? 'Căn tầng đáy để khớp cả 4 cạnh' : kind === 'prepare' ? 'Một lượt chuẩn bị cho hai cạnh đối diện' : 'Giữ cạnh đúng, đổi vòng 3 cạnh còn lại'
  const frame = variant ? `Mốc F của công thức là mặt ${variant.front} (${names[variant.front]}). Giữ cách nhìn khối hiện tại; các ký hiệu hiển thị đã quy đổi sang mặt cố định.` : ''
  const route = variant ? variant.direction === 'right'
    ? `${variant.right} → ${variant.left} → ${variant.back} → ${variant.right}`
    : `${variant.left} → ${variant.right} → ${variant.back} → ${variant.left}` : ''
  const intro = kind === 'align'
    ? 'Các cạnh đã đúng thứ tự quanh tầng đáy. Chỉ cần căn D, không cần làm công thức.'
    : `${kind === 'prepare' ? 'Thử các hướng D vẫn chỉ có hai cạnh khớp đối diện. Làm một lượt chuẩn bị, sau đó tìm một cạnh đúng làm mốc.' : aligned.moves.length ? `Trước tiên căn D bằng ${aligned.moves.join(' ').replaceAll("'", '′')}. Sau bước căn này mới chọn cạnh khớp tâm làm mốc và bắt đầu công thức.` : 'Đã có đúng một cạnh khớp tâm bên hông; giữ cạnh đó làm mốc.'} ${frame} Vòng cạnh: ${route}.`
  const finish = kind === 'prepare' ? 'Đã tạo trường hợp có thể căn D về một cạnh đúng. Dừng quan sát và bấm Gợi ý cho lượt cuối.' : 'Bốn cạnh vàng đã khớp tâm bên hông. Các góc sẽ xử lý ở Bài 7–8.'
  const why = [
    `Mở mặt ${variant?.direction === 'right' ? variant.right : variant?.left} để bắt đầu đường đi của ba cạnh, giữ cạnh ở mặt mốc sau cả lượt.`,
    'D2 là nửa vòng tầng đáy: xoay hai lần cùng chiều, chưa dừng ở một lần xoay.',
    'Trả mặt bên, đưa nhóm cạnh vào đường hoán đổi.',
    'Xoay D để chuyển nhóm cạnh sang vị trí tiếp theo của vòng.',
    'Mở lại mặt bên để tiếp tục đổi vòng ba cạnh.',
    'Xoay tầng đáy lần cuối trong công thức.',
    `Trả mặt bên, khôi phục hai tầng phía trên và dấu cộng vàng. ${finish}`
  ]
  const steps: GuideStep[] = [
    ...aligned.moves.map((notation) => ({ notation, why: finished ? 'Chỉ căn tầng đáy để cả bốn cạnh khớp tâm bên hông.' : `Đây là bước căn D, chưa bắt đầu công thức. Sau bước này, cạnh ở mặt ${variant!.front} (${names[variant!.front]}) khớp tâm: chọn mặt đó làm F mốc, rồi dùng chiều ${variant!.direction === 'right' ? 'R′' : 'L'} theo mốc.` })),
    ...(variant?.moves.map((notation, i) => ({ notation, why: why[i]! })) ?? [])
  ]
  const source = variant ? SLOT[variant.direction === 'right' ? variant.right : variant.left]! : 4
  const piece = aligned.state.ep[source]!
  let physical = fromCubie(state)
  const states: CubieState[] = []
  const halves: CubieState[][] = []
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
  return { kind, front: variant?.front ?? null, direction: variant?.direction ?? null, formula, title, intro, piece, alignmentSteps: aligned.moves.length, steps, states, halves }
}

export function lastEdgesMarks(state: CubieState, guide?: LastEdgesGuide) {
  if (guide) return [edgeCell(state.ep.indexOf(guide.piece))]
  return LAST_EDGES.filter((i) => !edgeDone(state, i)).map(edgeCell)
}
