import { applyMoves, parseAlgorithm, SOLVED } from '../../smart-solver/core/cubie'
import { CORNER_COLORS } from '../../smart-solver/core/facelets'
import type { CubieState, Face, Move } from '../../smart-solver/core/types'
import { LAST_CORNERS } from '../goals'
import { lastEdgesDone } from './lastEdgesGuide'
import type { ColorNames, GuideStep } from './crossGuide'
import { applyNotation, fromCubie, toCubie } from './physical'

export const LAST_CORNERS_RIGHT = parseAlgorithm("R' L D' R D L' D' R' D R")
export const LAST_CORNERS_LEFT = parseAlgorithm("L R' D L' D' R D L D' L'")
export const LAST_CORNER_LABEL: Record<number, string> = { 4: 'FR', 5: 'FL', 6: 'BL', 7: 'BR' }
const CORNER_SLOT_FACES: Record<number, readonly Face[]> = { 4: ['D', 'F', 'R'], 5: ['D', 'F', 'L'], 6: ['D', 'B', 'L'], 7: ['D', 'B', 'R'] }
/** A last-layer corner slot named by the three center colors it touches, e.g. "vàng–xanh lá–đỏ". */
export const cornerPlace = (slot: number, names: ColorNames): string => `góc đang ở giữa ba tâm ${cornerName(slot, names)}`
export const cornerName = (slot: number, names: ColorNames): string => CORNER_SLOT_FACES[slot]!.map((f) => names[f]).join('–')
const SIDES: Face[] = ['F', 'R', 'B', 'L']
export const correctLastCorners = (s: CubieState) => LAST_CORNERS.filter((i) => s.cp[i] === i)
export const lastCornersPositionDone = (s: CubieState) => lastEdgesDone(s) && correctLastCorners(s).length === 4
export const sharedCornerColors = (s: CubieState, slot: number): Face[] => CORNER_COLORS[slot]!.filter((f) => CORNER_COLORS[s.cp[slot]!]!.includes(f))
const opposite = (slot: number) => 4 + (slot - 4 + 2) % 4

export const LAST_CORNERS_VARIANTS = SIDES.flatMap((front, yaw) => {
  const face = (f: Face): Face => {
    const i = SIDES.indexOf(f)
    return i < 0 ? f : SIDES[(i + yaw) % 4]!
  }
  return ([['right', LAST_CORNERS_RIGHT], ['left', LAST_CORNERS_LEFT]] as const).map(([side, base]) => {
    const moves = base.map((m) => `${face(m[0] as Face)}${m.slice(1)}` as Move)
    const end = applyMoves(SOLVED, moves)
    const anchor = LAST_CORNERS.find((i) => end.cp[i] === i)!
    const first = LAST_CORNERS.find((i) => i !== anchor)!
    const destination = (source: number) => end.cp.indexOf(source)
    const cycle = [first, destination(first), destination(destination(first))]
    return { id: `${front}-${side}`, front, side, anchor, moves, cycle }
  })
})
export type LastCornersVariant = typeof LAST_CORNERS_VARIANTS[number]

/** The useful neighbor shares yellow + one side color with its current slot, regardless of twist. */
export function lastCornerClue(s: CubieState) {
  const correct = correctLastCorners(s)
  if (correct.length !== 1) return null
  const anchor = correct[0]!
  const destination = opposite(anchor)
  const neighbor = LAST_CORNERS.find((slot) => slot !== anchor && slot !== destination && sharedCornerColors(s, slot).length === 2)
  return neighbor === undefined ? null : { anchor, neighbor, destination, shared: sharedCornerColors(s, neighbor) }
}
export function lastCornersChoices(s: CubieState): LastCornersVariant[] {
  if (!lastEdgesDone(s) || lastCornersPositionDone(s)) return []
  const correct = correctLastCorners(s)
  if (correct.length === 0) return LAST_CORNERS_VARIANTS
  if (correct.length !== 1) return []
  return LAST_CORNERS_VARIANTS.filter((v) => v.anchor === correct[0] && lastCornersPositionDone(applyMoves(s, v.moves)))
}

export interface LastCornersGuide {
  kind: 'prepare' | 'cycle'
  variant: LastCornersVariant
  clue: ReturnType<typeof lastCornerClue>
  piece: number
  formula: string
  title: string
  intro: string
  steps: GuideStep[]
  states: CubieState[]
  halves: CubieState[][]
}
export function buildLastCornersGuide(state: CubieState, names: ColorNames, preferred?: string): LastCornersGuide | null {
  const choices = lastCornersChoices(state)
  const variant = choices.find((v) => v.id === preferred) ?? choices[0]
  if (!variant) return null
  const kind = correctLastCorners(state).length === 0 ? 'prepare' : 'cycle'
  const clue = lastCornerClue(state)
  const piece = state.cp[clue?.neighbor ?? variant.cycle[0]!]!
  const title = kind === 'prepare' ? 'Một lượt chuẩn bị để có góc đúng vị trí' : 'Giữ góc đúng, đổi vòng ba góc còn lại'
  const intro = kind === 'prepare'
    ? `Chưa có góc nào đúng chỗ. Chọn giữ ${cornerPlace(variant.anchor, names)} (khung nét đứt trong hình) cho lượt chuẩn bị; ba góc còn lại đi vòng theo mũi tên. Sau cả lượt sẽ có một góc đúng vị trí để làm mốc.`
    : `Giữ ${cornerPlace(variant.anchor, names)} (khung nét đứt trong hình): khối này đang đúng vị trí. Xét ${cornerPlace(clue!.neighbor, names)} (viền cam): khối đang đứng đó có hai màu thuộc vị trí này: ${clue!.shared.map((f) => names[f]).join(' và ')}. Đưa khối đó sang vị trí giữa ba tâm ${cornerName(clue!.destination, names)}; ba góc đi vòng theo mũi tên. Chưa cần lật mặt vàng xuống.`
  const why = [
    'Mở mặt bên thứ nhất theo phía đã chọn, bắt đầu đường đi của nhóm góc.',
    'Mở mặt bên còn lại. Chỉ dừng quan sát sau khi hoàn tất cả công thức.',
    'Chuyển tầng đáy để đưa nhóm góc sang đường đi tiếp theo.',
    'Trả mặt bên thứ nhất theo chuỗi hướng dẫn.',
    'Chuyển tầng đáy trở lại, phối hợp hai mặt bên.',
    'Trả mặt bên thứ hai để hoàn tất phần mở đầu.',
    'Chuyển tầng đáy để chuẩn bị nhịp kết thúc.',
    'Mở lại mặt bên thứ nhất, tiếp tục đổi vòng ba góc.',
    'Chuyển tầng đáy lần cuối trong công thức.',
    `Trả mặt bên. Các cạnh và hai tầng trên trở lại đúng; góc mốc giữ nguyên. ${kind === 'prepare' ? 'Dừng tìm một góc đúng vị trí rồi chọn chiều cho lượt cuối.' : 'Cả bốn góc đã đúng vị trí; hướng của các góc để Bài 8.'}`
  ]
  const steps = variant.moves.map((notation, i) => ({ notation, why: why[i]! }))
  let physical = fromCubie(state)
  const states: CubieState[] = []
  for (let i = 0; i <= steps.length; i += 1) {
    const s = toCubie(physical)
    if (!s) return null
    states.push(s)
    if (i < steps.length) physical = applyNotation(physical, steps[i]!.notation)
  }
  return { kind, variant, clue, piece, formula: variant.moves.join(' ').replaceAll("'", '′'), title, intro, steps, states, halves: steps.map(() => []) }
}
