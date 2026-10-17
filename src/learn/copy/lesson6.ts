import { applyMoves, equals, invertMoves, SOLVED } from '../../smart-solver/core/cubie'
import type { CubieState, Move } from '../../smart-solver/core/types'
import { LAST_EDGES_LEFT, LAST_EDGES_RIGHT, LAST_EDGES_VARIANTS, matchingLastEdges } from '../guide/lastEdgesGuide'
import { LAST_EDGE_RING, lastEdgesOrderDone, lastEdgesOrderOptions } from '../guide/lastEdgesOrder'
import type { LessonPage } from '../ui/LessonPlayer'

export type LastEdgesLevel = 'easy' | 'medium' | 'hard'
export const LAST_EDGES_LEVELS = [
  { id: 'easy', label: 'Dễ', desc: 'Một cạnh đúng · chọn mốc và chiều · 1 lượt' },
  { id: 'medium', label: 'Trung bình', desc: 'Hai cạnh đúng kề nhau · căn D, chọn mặt mốc và chiều · 1 lượt công thức' },
  { id: 'hard', label: 'Khó', desc: 'Hai cạnh đúng đối diện · chuẩn bị rồi chọn mốc · 2 lượt' }
] as const
export function lastEdgesLevel(state: CubieState): LastEdgesLevel | null {
  const correct = matchingLastEdges(state)
  if (correct.length === 1) return 'easy'
  if (correct.length === 2) return Math.abs(correct[0]! - correct[1]!) === 2 ? 'hard' : 'medium'
  return null
}
const pools: Record<LastEdgesLevel, Move[][]> = { easy: [], medium: [], hard: [] }
let frontier: Move[][] = [[]]
for (let depth = 0; depth < 2; depth += 1) {
  const next: Move[][] = []
  for (const setup of frontier) for (const v of LAST_EDGES_VARIANTS) for (const d of [[], ['D'], ["D'"], ['D2']] as Move[][]) {
    const moves = [...setup, ...invertMoves(v.moves), ...d]
    const level = lastEdgesLevel(applyMoves(SOLVED, moves))
    if (level) pools[level].push(moves)
    next.push(moves)
  }
  frontier = next
}
export function generateLastEdgesScramble(level: LastEdgesLevel, rng: () => number = Math.random, avoid?: Move[]): Move[] {
  const previous = avoid ? applyMoves(SOLVED, avoid) : null
  const choices = pools[level].filter((moves) => !previous || !equals(applyMoves(SOLVED, moves), previous))
  return choices[Math.max(0, Math.min(choices.length - 1, Math.floor(rng() * choices.length)))]!.slice()
}

// Show the lesson goal: all four edges correctly placed, with corners left for later lessons.
const edgesMatchedCornersUnfinished = applyMoves(SOLVED, [...LAST_EDGES_RIGHT, ...LAST_EDGES_LEFT])
const pictureBefore = applyMoves(edgesMatchedCornersUnfinished, invertMoves(LAST_EDGES_LEFT))
export const LAST_EDGES_EXCHANGE_PICTURE = {
  before: pictureBefore,
  after: applyMoves(pictureBefore, LAST_EDGES_LEFT),
  moves: LAST_EDGES_LEFT
}
export const LAST_EDGES_FORMULA_PICTURES = ([
  { direction: 'right', moves: LAST_EDGES_RIGHT, route: 'R → L → B → R' },
  { direction: 'left', moves: LAST_EDGES_LEFT, route: 'L → R → B → L' }
] as const).map((example) => {
  const before = applyMoves(edgesMatchedCornersUnfinished, invertMoves(example.moves))
  return { ...example, before, after: applyMoves(before, example.moves) }
})

const circularPermutations = (xs: number[]): number[][] => xs.length ? xs.flatMap((x) => circularPermutations(xs.filter((y) => y !== x)).map((p) => [x, ...p])) : [[]]
const catalog = [[], ...frontier].map((setup) => {
  const state = applyMoves(SOLVED, setup)
  const rounds = lastEdgesOrderDone(state) ? 0 : lastEdgesOrderOptions(state).length ? 1 : 2
  return { setup, state, rounds }
})
export const LAST_EDGES_ORDER_CASES = circularPermutations([4, 7, 6]).map((rest, i) => {
  const ring = [5, ...rest]
  const sample = catalog.find(({ state }) => LAST_EDGE_RING.every((slot, n) => state.ep[slot] === ring[n]))!
  const rounds = lastEdgesOrderDone(sample.state) ? 0 : lastEdgesOrderOptions(sample.state).length ? 1 : 2
  return { id: `order-${i}`, ring, state: sample.state, setup: sample.setup, rounds }
})
const caseCornerVariants = [[], [...LAST_EDGES_RIGHT, ...LAST_EDGES_LEFT], [...LAST_EDGES_RIGHT, ...LAST_EDGES_LEFT, ...LAST_EDGES_RIGHT, ...LAST_EDGES_LEFT]]
const casePools = LAST_EDGES_ORDER_CASES.map((c) => catalog
  .filter(({ state }) => LAST_EDGE_RING.every((slot, i) => state.ep[slot] === c.ring[i]))
  .flatMap((entry) => caseCornerVariants.map((extra) => ({
    setup: [...entry.setup, ...extra], state: applyMoves(entry.state, extra)
  }))).filter((entry) => !equals(entry.state, SOLVED)))

/** Match all four physical edge positions in the selected illustration, not just its difficulty. */
export function generateLastEdgesCaseScramble(caseIndex: number, rng: () => number = Math.random, avoid?: Move[]): Move[] {
  const previous = avoid ? applyMoves(SOLVED, avoid) : null
  const choices = casePools[caseIndex]!.filter((entry) => !previous || !equals(entry.state, previous))
  return choices[Math.max(0, Math.min(choices.length - 1, Math.floor(rng() * choices.length)))]!.setup.slice()
}

export const LAST_EDGES_FINAL_ALIGNMENT_NOTE = 'Sau khi bốn cạnh đúng thứ tự, chỉ căn D để chúng về đúng vị trí trên khối. Bấm Thực hành để luyện; Gợi ý cũng chọn mốc theo thứ tự, không dùng cạnh khớp tâm làm điều kiện.'

export const LAST_EDGES_ORDER_LEVELS = [
  { id: 'easy', label: 'Dễ', desc: 'Thứ tự đúng: chỉ cần căn D ở cuối' },
  { id: 'medium', label: 'Trung bình', desc: 'Chọn một trong hai mốc · 1 lượt công thức' },
  { id: 'hard', label: 'Khó', desc: 'Lượt chuẩn bị rồi chọn lại mốc · 2 lượt công thức' }
] as const
const orderPools = { easy: [], medium: [], hard: [] } as Record<LastEdgesLevel, { setup: Move[]; state: CubieState }[]>
for (const entry of catalog) for (const d of [[], ['D'], ["D'"], ['D2']] as Move[][]) {
  const setup = [...entry.setup, ...d]
  const state = applyMoves(SOLVED, setup)
  if (entry.rounds === 0 && LAST_EDGE_RING.every((slot) => state.ep[slot] === slot)) continue
  orderPools[entry.rounds === 0 ? 'easy' : entry.rounds === 1 ? 'medium' : 'hard'].push({ setup, state })
}
export function generateLastEdgesOrderScramble(level: LastEdgesLevel, rng: () => number = Math.random, avoid?: Move[]): Move[] {
  const previous = avoid ? applyMoves(SOLVED, avoid) : null
  const choices = orderPools[level].filter((entry) => !previous || !equals(entry.state, previous))
  return choices[Math.max(0, Math.min(choices.length - 1, Math.floor(rng() * choices.length)))]!.setup.slice()
}

export const LESSON6_PAGES: readonly (LessonPage & { body: string[]; reason: string })[] = [
  { id: 'goal', section: 'Mục tiêu', title: 'Đưa các cạnh vàng về đúng chỗ', body: [
    'Sau Bài 5, dấu cộng vàng đã có nhưng các cạnh vẫn có thể ở sai vị trí. Hãy so màu bên hông của từng cạnh với tâm cùng mặt.',
    'Học xong bài này, bạn sẽ biết cách xoay để cả bốn cạnh tầng cuối về đúng vị trí: màu bên hông khớp tâm, dấu cộng vàng và hai tầng phía trên vẫn được giữ nguyên. Hai ảnh minh hoạ từ vị trí đang sai đến vị trí đã đúng.',
    'Giữ trắng ở trên, vàng ở dưới. Các góc vàng sẽ học ở Bài 7–8.'
  ], reason: 'Cạnh có mặt vàng hướng xuống vẫn có thể ở sai chỗ. Ta cần đổi thứ tự bốn cạnh quanh đáy trước, rồi căn tầng đáy ở cuối.' },
  { id: 'movement', section: 'Nguyên tắc di chuyển', title: 'Giữ một cạnh, ba cạnh kia đi vòng tròn', body: [
    'Từ đây, giữ màu bốn cạnh cần theo dõi và tâm D vàng ở giữa làm mặt đáy cơ sở; các ô khác đều xám. Chỉ quan tâm thứ tự bốn cạnh quanh tầng đáy; chưa so cạnh với tâm.',
    'Chọn một cạnh làm mốc trước F. Sau trọn lượt, cạnh này giữ nguyên; ba cạnh ở phải R, trái L và sau B đổi chỗ theo vòng.',
    'Có hai chiều: R → L → B → R, hoặc L → R → B → L. Hình giữ màu cả bốn cạnh ở giữa hàng dưới của bốn mặt; ngoài tâm D vàng, mọi ô khác đều xám. Theo dõi ba cạnh R, L và B đi theo mũi tên, còn F giữ nguyên.'
  ], reason: 'Chọn cạnh giữ lại và chiều đi vòng sẽ quyết định thứ tự mới của cả bốn cạnh, không phụ thuộc cạnh nào đang khớp tâm.' },
  { id: 'formulas', section: 'Hai công thức', title: 'Hai chiều đổi cạnh, hai cách xoay', body: [
    'Hai công thức cùng giữ cạnh F và đưa ba cạnh còn lại đi theo hai chiều ngược nhau. F là vị trí mốc được chọn, không gắn cố định với màu tâm.',
    'So thứ tự của cả bốn cạnh có màu trước và sau. Chỉ bốn ô giữa hàng dưới giữ màu; tâm D vàng làm mốc đáy; mọi ô khác đều xám.',
    'D2 là nửa vòng tầng đáy: xoay hai lần cùng chiều. Làm trọn công thức rồi quan sát thứ tự mới.'
  ], reason: 'Cùng một cách đổi vòng, áp dụng từ hai phía. Hình trước/sau gắn mỗi chuỗi xoay với chiều di chuyển cụ thể.' },
  { id: 'practice', section: 'Các thứ tự và áp dụng', title: 'Nhận diện thứ tự, chọn cạnh làm mặt mốc', body: [
    'Đọc bốn màu theo vòng F → R → B → L. Thứ tự chuẩn là xanh lá → đỏ → xanh dương → cam; bắt đầu từ cạnh nào cũng được, miễn giữ đúng chiều đọc.',
    'Khi gom các hình chỉ khác nhau do xoay D, có 6 thứ tự. Một thứ tự đã đúng sẵn (chỉ cần căn D, không cần công thức) nên dưới đây là 5 tổ hợp cần xử lý. Hình dưới đặt cạnh xanh lá ở đầu vòng để dễ so sánh; đây không phải yêu cầu căn cạnh xanh lá khớp tâm.',
    'Lấy tâm D vàng làm mốc đáy để đọc hướng di chuyển. Chọn tổ hợp giống khối của bạn. Nếu có hai cạnh có thể giữ làm mốc, chọn một cạnh: công thức và hình kết quả sẽ đổi theo lựa chọn đó.',
    LAST_EDGES_FINAL_ALIGNMENT_NOTE
  ], reason: 'Bốn cạnh có 24 cách xếp vào bốn vị trí. Mỗi nhóm 4 hình chỉ khác nhau do xoay D có cùng một thứ tự vòng, nên chỉ cần nhận diện 5 tổ hợp cần công thức, cộng một thứ tự đã đúng.' }
]
