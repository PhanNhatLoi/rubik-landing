import { applyMoves, equals, invertMoves, SOLVED } from '../../smart-solver/core/cubie'
import type { Move } from '../../smart-solver/core/types'
import { f2lDone } from '../goals'
import { TOP_CROSS_ALG, topCrossPattern, type TopCrossMethod, type TopCrossPattern } from '../guide/topCrossGuide'
import type { LessonPage } from '../ui/LessonPlayer'

export interface FormulaCard {
  title: string
  alignment: string
  formula: string
  phases: readonly (readonly [string, string])[]
  explanation: string
  source?: string
  result: string
}
export type Lesson5Page = LessonPage & { body: string[]; reason: string[]; formulas?: readonly FormulaCard[] }

export const TOP_CROSS_METHODS: readonly { id: TopCrossMethod; title: string; desc: string; route: string }[] = [
  {
    id: 'dual', title: 'Học hai công thức',
    desc: 'Dùng công thức L cho chữ L và công thức đối cho hai cạnh đối: trường hợp hai cạnh đối chỉ cần 1 lượt, nhưng cần nhớ thêm một công thức.',
    route: 'Chữ L hoặc hai cạnh đối: 1 lượt là có dấu cộng. Chưa có cạnh nào hướng xuống: 2 lượt.'
  },
  {
    id: 'single', title: 'Học một công thức (chữ L)',
    desc: 'Chỉ nhớ công thức chữ L cho mọi trường hợp, căn lại hình và lặp khi cần.',
    route: 'Chữ L: 1 lượt. Hai cạnh đối hoặc chưa có cạnh nào hướng xuống: 2 lượt.'
  }
]

export const TOP_CROSS_LINE_CARD: FormulaCard = {
  title: 'Hai cạnh đối — công thức đường thẳng',
  alignment: 'Mặt vàng cần lắp ở đáy D. Xoay D để hai cạnh đúng màu hướng xuống nằm trái–phải (DL và DR). Giữ trắng ở trên, xanh lá trước mặt.',
  formula: 'B R D R′ D′ B′',
  phases: [['Mở mặt sau', 'B'], ['Đổi chỗ', 'R D R′ D′'], ['Đóng mặt sau', 'B′']],
  explanation: 'Đây là công thức hai cạnh đối trước đây, được quy đổi theo hướng cầm mới: mặt cần lắp ở đáy. Mở bằng B, cho cạnh đi đường vòng rồi đóng bằng B′ để khôi phục hai tầng phía trên.',
  result: 'Hai cạnh đối → dấu cộng'
}
export const TOP_CROSS_L_CARD: FormulaCard = {
  title: 'Hai cạnh kề nhau — công thức chữ L',
  alignment: 'Giữ trắng ở trên, vàng ở đáy D, xanh lá trước mặt. Xoay D để chữ L nằm trước–phải (DF và DR).',
  formula: 'L′ F′ D F L B D′ B′',
  phases: [['Mở mặt trái', 'L′'], ['Đổi đường qua mặt trước', 'F′ D F'], ['Trả mặt trái', 'L'], ['Hoàn thiện qua mặt sau', 'B D′ B′']],
  explanation: 'Mở mặt trái bằng L′, phối hợp mặt trước và tầng đáy bằng F′ D F, trả mặt trái bằng L. Nhịp B D′ B′ tiếp tục đổi đường đi của các cạnh và khôi phục hai tầng phía trên. Làm hết 8 nước rồi quan sát.',
  result: 'Chữ L → dấu cộng trong 1 lượt. Chấm hoặc hai cạnh đối → chữ L → dấu cộng trong 2 lượt.'
}

export function topCrossPracticeRoute(level: TopCrossLevelId, method: TopCrossMethod): string {
  if (level === 'easy') return method === 'dual' ? 'Hai cạnh đối → dấu cộng · 1 lượt' : 'Hai cạnh đối → chữ L → dấu cộng · 2 lượt'
  return level === 'medium' ? 'Chữ L → dấu cộng · 1 lượt' : 'Chấm → chữ L → dấu cộng · 2 lượt'
}
export type TopCrossLevelId = 'easy' | 'medium' | 'hard'
export const TOP_CROSS_LEVELS = [
  { id: 'easy', label: 'Dễ', desc: 'Hai cạnh đối', pattern: 'line' },
  { id: 'medium', label: 'Trung bình', desc: 'Hai cạnh kề nhau (chữ L)', pattern: 'elbow' },
  { id: 'hard', label: 'Khó', desc: 'Chưa có cạnh nào hướng xuống (chấm)', pattern: 'dot' }
] as const

// A small checked catalog built from inverses of the lesson's own formula; no solver or search at play time.
const pools: Record<Exclude<TopCrossPattern, 'cross'>, Move[][]> = { dot: [], elbow: [], line: [] }
let frontier: Move[][] = [[]]
for (let depth = 0; depth < 3; depth += 1) {
  const next: Move[][] = []
  for (const setup of frontier) {
    for (const u of [[], ['D'], ["D'"], ['D2']] as Move[][]) {
      const moves = [...setup, ...u, ...invertMoves(TOP_CROSS_ALG)]
      const state = applyMoves(SOLVED, moves)
      const pattern = topCrossPattern(state)
      if (f2lDone(state) && pattern !== 'cross') pools[pattern].push(moves)
      next.push(moves)
    }
  }
  frontier = next
}

export const TOP_CROSS_PICTURE_SCRAMBLE: Move[] = pools.dot[0]!

/** Random state of the chosen pattern, with two solved layers and a different cube on each re-roll. */
export function generateTopCrossScramble(level: TopCrossLevelId, rng: () => number = Math.random, avoid?: Move[]): Move[] {
  const pattern = TOP_CROSS_LEVELS.find((l) => l.id === level)!.pattern
  const previous = avoid ? applyMoves(SOLVED, avoid) : null
  const options = pools[pattern].flatMap((setup) =>
    ([[], ['D'], ["D'"], ['D2']] as Move[][]).map((u) => [...setup, ...u])
  ).filter((setup) => !previous || !equals(applyMoves(SOLVED, setup), previous))
  return options[Math.min(options.length - 1, Math.max(0, Math.floor(rng() * options.length)))]!.slice()
}

const BASE_PAGES: readonly Lesson5Page[] = [
  {
    id: 'top-cross', section: 'Dấu cộng tầng đáy', title: 'Tạo dấu cộng ở mặt đáy',
    body: [
      'Mục tiêu: xoay 4 cạnh của tầng đáy để màu của tâm D cùng hướng xuống, tạo dấu cộng quanh tâm. Giữ tầng trắng đã làm ở trên, vàng ở dưới và mặt xanh lá F hướng về bạn.',
      'Khác dấu cộng tầng đầu: bài này chưa cần màu ở bên hông của cạnh khớp tâm. Bốn góc ở mặt đáy cũng chưa cần đúng.'
    ],
    reason: [
      'Hai tầng phía trên đã xong. Ta phối hợp các nước xoay để đổi hướng cạnh tầng đáy và khôi phục hai tầng phía trên khi làm hết công thức.',
      'Làm cạnh trước, góc sau giúp bạn chỉ cần quan sát một nhóm khối mỗi lần.'
    ]
  },
  {
    id: 'patterns', section: 'Nhận diện trường hợp', title: 'Hai trường hợp: chữ L và hai cạnh đối',
    body: [
      'Chỉ nhìn 4 ô cạnh quanh tâm mặt đáy, bỏ qua các góc. Khi có 2 cạnh đúng màu hướng xuống, chúng nằm kề nhau thành chữ L hoặc đối diện nhau thành đường thẳng.',
      'Nếu chưa có cạnh nào hướng xuống, ta gọi là hình chấm. Dùng công thức theo cách học bạn chọn một lượt để tạo chữ L, rồi tiếp tục từ hình mới. Nếu cả 4 cạnh đều hướng xuống thì dấu cộng đã xong.'
    ],
    reason: [
      'Chữ L và hai cạnh đối có vị trí khác nhau nên cần một đường đi khác nhau để các cạnh còn lại hướng xuống. Bạn có thể học hai công thức, hoặc dùng lặp một công thức.',
      'Nếu hai tầng phía trên còn nguyên mà bạn đếm được 1 hoặc 3 cạnh hướng xuống, hãy kiểm tra lại màu hoặc trạng thái khối: đây không phải trường hợp hợp lệ.'
    ]
  },
  {
    id: 'method', section: 'Chọn cách học', title: 'Bạn muốn nhớ ít hay xoay nhanh hơn?',
    body: ['Cả hai cách đều tạo được dấu cộng và giữ nguyên hai tầng phía trên sau mỗi lượt. Chọn cách phù hợp với bạn: phần giải thích công thức và Gợi ý khi thực hành sẽ đi theo lựa chọn này.'],
    reason: ['Bạn không cần học cả hai ngay. Có thể quay lại trang này để đổi cách học; nếu đã luyện, đổi cách sẽ bắt đầu lại khối mẫu đang luyện.']
  }
]

const SHARED_REASON = [
  'Các nước xoay ngược không đơn giản huỷ nước ban đầu: ở giữa có nước xoay mặt khác, làm thay đổi nhóm khối mà nước trả lại tác động lên.',
  'Công thức tác động lên nhóm cạnh. Khi hướng dẫn, chỉ tâm D và một cạnh theo dõi phát sáng để bạn dễ nhìn đường đi.'
]

/** No method is preselected: formula explanations and practice appear only after an explicit pick. */
export function getLesson5Pages(method: TopCrossMethod | null): readonly Lesson5Page[] {
  if (!method) return BASE_PAGES
  return [...BASE_PAGES, {
    id: 'formula', section: 'Công thức và thực hành',
    title: method === 'dual' ? 'Hai công thức cho hai trường hợp' : 'Một công thức, lặp theo hình mới',
    formulas: method === 'dual' ? [TOP_CROSS_LINE_CARD, TOP_CROSS_L_CARD] : [TOP_CROSS_L_CARD],
    body: method === 'dual' ? [
      'Công thức đối vẫn là phương pháp 6 nước, quy đổi sang mặt đích ở đáy D. Công thức chữ L dùng nguyên chuỗi 8 nước với mặt đích ở đáy.',
      'Chữ L hoặc hai cạnh đối: căn đúng hình rồi dùng công thức tương ứng, một lượt là có dấu cộng.',
      'Chưa có cạnh nào hướng xuống: dùng công thức chữ L một lượt, được chữ L ở trước–phải. Lặp lại chính công thức đó một lượt nữa để có dấu cộng, không cần căn D giữa hai lượt. Tổng cộng 2 lượt.'
    ] : [
      'Bạn chỉ cần nhớ công thức chữ L: L′ F′ D F L B D′ B′. Giữ trắng ở trên, vàng ở đáy D và xanh lá trước mặt.',
      'Chữ L: căn trước–phải (DF và DR), làm một lượt sẽ có dấu cộng. Hai cạnh đối: căn trái–phải (DL và DR), làm một lượt sẽ thành chữ L; xoay D để căn chữ L trước–phải rồi lặp cùng công thức. Tổng cộng 2 lượt.',
      'Chưa có cạnh nào hướng xuống: làm một lượt để có chữ L ở trước–phải, rồi lặp lại cùng công thức, không cần căn D giữa hai lượt. Lộ trình: chấm → chữ L → dấu cộng. Tổng cộng 2 lượt.'
    ],
    reason: [...SHARED_REASON,
      'Dừng quan sát sau mỗi lượt, căn lại D nếu cần. Hai tầng phía trên có thể lệch tạm thời trong lượt: làm hết công thức để chúng trở lại. Nếu xoay nhầm, bấm Hoàn tác rồi tiếp tục hướng dẫn.'
    ]
  }]
}
