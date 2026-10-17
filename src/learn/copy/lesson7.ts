import { applyMoves, equals, invertMoves, SOLVED } from '../../smart-solver/core/cubie'
import type { CubieState, Move } from '../../smart-solver/core/types'
import { LAST_CORNERS_VARIANTS, LAST_CORNERS_RIGHT, LAST_CORNERS_LEFT, correctLastCorners } from '../guide/lastCornersGuide'
import type { LessonPage } from '../ui/LessonPlayer'

export type LastCornersCase = 'done' | 'one' | 'none'
export const LAST_CORNERS_CASES = [
  { id: 'done', label: '4 góc đúng', desc: 'Đã đúng vị trí · không làm công thức', rounds: 0 },
  { id: 'one', label: '1 góc đúng', desc: 'Giữ góc đúng, chọn chiều theo góc bên cạnh · 1 lượt', rounds: 1 },
  { id: 'none', label: '0 góc đúng', desc: 'Một lượt chuẩn bị → có góc đúng → lượt cuối · 2 lượt', rounds: 2 }
] as const
export function lastCornersCase(s: CubieState): LastCornersCase {
  const count = correctLastCorners(s).length
  return count === 4 ? 'done' : count === 1 ? 'one' : 'none'
}
let frontier: Move[][] = [[]]
const catalog: { setup: Move[]; state: CubieState }[] = [{ setup: [], state: SOLVED }]
for (let depth = 0; depth < 3; depth += 1) {
  const next: Move[][] = []
  for (const setup of frontier) for (const v of LAST_CORNERS_VARIANTS) {
    const moves = [...setup, ...v.moves]
    catalog.push({ setup: moves, state: applyMoves(SOLVED, moves) })
    next.push(moves)
  }
  frontier = next
}
const permutations = new Map<string, typeof catalog[number]>()
for (const entry of catalog) {
  const key = entry.state.cp.slice(4).join('-')
  if (!permutations.has(key) || (equals(permutations.get(key)!.state, SOLVED) && !equals(entry.state, SOLVED))) permutations.set(key, entry)
}
export const LAST_CORNERS_COMBINATIONS = [...permutations.values()].map((entry, i) => ({ ...entry, id: `corners-${i}`, kind: lastCornersCase(entry.state) }))
export const LAST_CORNERS_DEFAULT_COMBINATION = LAST_CORNERS_COMBINATIONS.findIndex((c) => c.kind === 'one')
export function generateLastCornersScramble(combinationIndex: number, rng: () => number = Math.random, avoid?: Move[]): Move[] {
  const c = LAST_CORNERS_COMBINATIONS[combinationIndex]!
  const previous = avoid ? applyMoves(SOLVED, avoid) : null
  const choices = catalog.filter((entry) => entry.state.cp.slice(4).every((p, i) => p === c.state.cp[i + 4]) && !equals(entry.state, SOLVED) && (!previous || !equals(entry.state, previous)))
  return choices[Math.max(0, Math.min(choices.length - 1, Math.floor(rng() * choices.length)))]!.setup.slice()
}
const orientedLater: CubieState = { ...SOLVED, co: [0, 0, 0, 0, 1, 2, 0, 0] }
export const LAST_CORNERS_FORMULA_PICTURES = [
  { side: 'right', moves: LAST_CORNERS_RIGHT, anchor: 4 },
  { side: 'left', moves: LAST_CORNERS_LEFT, anchor: 5 }
].map((v) => {
  const before = applyMoves(orientedLater, invertMoves(v.moves))
  return { ...v, before, after: applyMoves(before, v.moves) }
})

export const LESSON7_PAGES: readonly (LessonPage & { body: string[]; reason: string })[] = [
  { id: 'goal', section: 'Mục tiêu', title: 'Đưa bốn góc vàng về đúng vị trí', body: [
    'Bài 6 đã xong các cạnh, gồm bước căn D cuối. Bài này chỉ đổi vị trí bốn khối góc tầng đáy, giữ nguyên các cạnh và hai tầng trên sau mỗi công thức.',
    'Đúng vị trí khác đúng mặt: góc vàng–xanh lá–đỏ thuộc chỗ giao của ba mặt D–F–R, dù ô vàng còn quay sang bên. Chưa lật góc trong bài này.'
  ], reason: 'Mỗi góc được nhận diện bằng bộ ba màu. Vị trí đúng khi đủ ba màu thuộc đúng ba mặt giao nhau; hướng của các ô màu để Bài 8.' },
  { id: 'recognize', section: 'Nhận diện góc và chọn chiều', title: 'Tìm góc đúng, rồi nhìn hai góc bên cạnh', body: [
    'Trong hình, tên ghi trên mỗi góc là ba tâm mà vị trí đó chạm vào, ví dụ “vàng–xanh lá–đỏ” là vị trí giữa ba tâm vàng, xanh lá và đỏ; màu của khối đang đứng ở đó có thể khác và được vẽ trong hình. Mặt mốc là mặt đang hướng về bạn; hai góc ở phía bạn là hai góc trước, hai góc còn lại ở phía sau.',
    'Tìm một góc có đủ bộ ba màu thuộc đúng vị trí. Lấy góc đó làm mốc giữ lại; không yêu cầu màu vàng hướng xuống.',
    'Trong hai góc bên cạnh mốc, có đúng một góc chia sẻ 2/3 màu với vị trí đang đứng: màu vàng và một màu bên. Hãy đưa góc vừa tìm sang góc đối diện mốc; chiều đổi vòng được xác định từ đường đi đó.',
    '“2/3 màu đúng” là xét bộ màu của khối so với vị trí, không đếm hai ô đang hướng đúng mặt. Ô vàng có thể đang ở bên hông.'
  ], reason: 'Khi giữ một góc đúng, ba góc còn lại chỉ có hai chiều đổi vòng. Góc bên cạnh có hai màu chung giúp nhận ra chiều cần dùng mà không phải thử công thức.' },
  { id: 'formula', section: 'Công thức và đường đi', title: 'Một công thức, áp dụng từ hai phía', body: [
    'Bản bắt đầu R′ giữ góc trước–bên phải (khung nét đứt trong hình), ba góc còn lại đi vòng theo mũi tên. Bản đối xứng bắt đầu L giữ góc trước–bên trái và đi vòng theo chiều ngược lại.',
    'Nếu góc đúng ở vị trí khác, đổi mặt mốc để góc đó nằm ở phía trước, bên phải hoặc bên trái. App sẽ chỉ rõ mốc và ghi sẵn các nước theo đúng mặt của khối bạn đang cầm, không cần tự đổi.',
    'Không xoay D riêng để đổi chỗ mốc: các cạnh vừa làm ở Bài 6 phải giữ đúng. Làm hết 10 nước của công thức rồi quan sát.'
  ], reason: 'Công thức giữ một góc, hoán đổi ba góc còn lại. Từ hai phía, đường đi đổi chiều; các góc có thể đổi hướng nhưng việc lật chúng chưa phải mục tiêu.' },
  { id: 'practice', section: 'Tổ hợp và thực hành', title: 'Ba trường hợp: 4 đúng, 1 đúng, chưa có góc đúng', body: [
    'Bốn góc đúng vị trí: xong Bài 7, không làm công thức dù mặt vàng chưa kín.',
    'Một góc đúng vị trí: giữ nó làm mốc, tìm góc bên cạnh có vàng và thêm một màu thuộc vị trí đó, rồi dùng chiều đưa góc ấy sang vị trí đối diện mốc. Cần 1 lượt công thức.',
    'Không có góc đúng vị trí: chọn một góc giữ lại và làm 1 lượt chuẩn bị. Lúc này có một góc đúng; áp dụng trường hợp trên cho lượt cuối. Tối đa 2 lượt.',
    'Chọn một trong ba trường hợp để xem mẫu và cách xử lý đề xuất. Khi cần đối chiếu thêm, mở “Xem thêm tổ hợp khác”. Thực hành tải đúng bố trí góc đang xem; Gợi ý theo lựa chọn mốc của bạn. Màu các góc được giữ, các phần không cần nhìn tô xám.'
  ], reason: 'Với các cạnh đã đúng như cuối Bài 6, chỉ có 4, 1 hoặc 0 góc đúng vị trí. Không có trường hợp hợp lệ đúng riêng 2 hay 3 góc.' }
]
