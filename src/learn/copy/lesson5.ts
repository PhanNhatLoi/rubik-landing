import { applyMoves, equals, invertMoves, SOLVED } from '../../smart-solver/core/cubie'
import type { Move } from '../../smart-solver/core/types'
import { f2lDone } from '../../smart-solver/nxn/beginner'
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
    desc: 'Mỗi trường hợp một công thức: nhanh hơn, nhưng cần nhớ thêm một công thức.',
    route: 'Chữ L hoặc hai cạnh đối: 1 lượt là có dấu cộng. Chưa có cạnh nào hướng lên: 2 lượt.'
  },
  {
    id: 'single', title: 'Học một công thức',
    desc: 'Dễ nhớ hơn: dùng cùng một công thức cho mọi trường hợp, căn lại hình và lặp khi cần.',
    route: 'Hai cạnh đối: 1 lượt. Chữ L: 2 lượt. Chưa có cạnh nào hướng lên: 3 lượt.'
  }
]

export const TOP_CROSS_LINE_CARD: FormulaCard = {
  title: 'Hai cạnh đối — công thức đường thẳng',
  alignment: 'Xoay U để hai cạnh đúng màu hướng lên nằm trái–phải (UL và UR). Giữ mặt trước F hướng về bạn.',
  formula: 'F R U R′ U′ F′',
  phases: [['Mở mặt trước', 'F'], ['Đổi chỗ', 'R U R′ U′'], ['Đóng mặt trước', 'F′']],
  explanation: 'Mở bằng F, cho các cạnh đi đường vòng ở nhịp giữa rồi đóng bằng F′. Tầng trên đã xoay giữa R và R′ nên nước trả lại tác động lên một nhóm khối khác.',
  result: 'Hai cạnh đối → dấu cộng'
}
export const TOP_CROSS_L_CARD: FormulaCard = {
  title: 'Hai cạnh kề nhau — công thức chữ L',
  alignment: 'Trong Bài 5 hiện tại, mặt cần lắp vẫn ở trên U: xoay U để chữ L nằm sau–phải (UB và UR).',
  formula: 'L′ B′ U B L F U′ F′',
  phases: [['Mở mặt trái', 'L′'], ['Đổi đường qua mặt sau', 'B′ U B'], ['Trả mặt trái', 'L'], ['Hoàn thiện qua mặt trước', 'F U′ F′']],
  explanation: 'Mở mặt trái bằng L′, phối hợp mặt sau với tầng trên bằng B′ U B, rồi trả mặt trái bằng L. Nhịp F U′ F′ tiếp tục đổi đường đi của các cạnh và khôi phục hai tầng dưới. Hãy làm hết cả 8 nước rồi mới quan sát kết quả.',
  source: 'Công thức gốc của bạn khi mặt cần lắp ở đáy D: L′ F′ D F L B D′ B′, chữ L ở trước–phải (DF và DR). Để dùng cùng hướng hiện tại của Bài 5, quy đổi qua một phép lật cả khối nửa vòng quanh trục trái–phải: D ↔ U, F ↔ B. Vì vậy các tên mặt trong công thức đổi như trên. Khi thực hành ở trang này, dùng chuỗi có U với chữ L ở sau–phải.',
  result: 'Chữ L → dấu cộng; chấm → chữ L rồi lặp thêm 1 lượt → dấu cộng'
}

export function topCrossPracticeRoute(level: TopCrossLevelId, method: TopCrossMethod): string {
  if (level === 'easy') return 'Hai cạnh đối → dấu cộng · 1 lượt'
  if (method === 'dual') return level === 'medium' ? 'Chữ L → dấu cộng · 1 lượt' : 'Chấm → chữ L → dấu cộng · 2 lượt'
  return level === 'medium' ? 'Chữ L → hai cạnh đối → dấu cộng · 2 lượt' : 'Chấm → chữ L → hai cạnh đối → dấu cộng · 3 lượt'
}
export type TopCrossLevelId = 'easy' | 'medium' | 'hard'
export const TOP_CROSS_LEVELS = [
  { id: 'easy', label: 'Dễ', desc: 'Hai cạnh đối', pattern: 'line' },
  { id: 'medium', label: 'Trung bình', desc: 'Hai cạnh kề nhau (chữ L)', pattern: 'elbow' },
  { id: 'hard', label: 'Khó', desc: 'Chưa có cạnh nào hướng lên (chấm)', pattern: 'dot' }
] as const

// A small checked catalog built from inverses of the lesson's own formula; no solver or search at play time.
const pools: Record<Exclude<TopCrossPattern, 'cross'>, Move[][]> = { dot: [], elbow: [], line: [] }
let frontier: Move[][] = [[]]
for (let depth = 0; depth < 3; depth += 1) {
  const next: Move[][] = []
  for (const setup of frontier) {
    for (const u of [[], ['U'], ["U'"], ['U2']] as Move[][]) {
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
    ([[], ['U'], ["U'"], ['U2']] as Move[][]).map((u) => [...setup, ...u])
  ).filter((setup) => !previous || !equals(applyMoves(SOLVED, setup), previous))
  return options[Math.min(options.length - 1, Math.max(0, Math.floor(rng() * options.length)))]!.slice()
}

const BASE_PAGES: readonly Lesson5Page[] = [
  {
    id: 'top-cross', section: 'Dấu cộng tầng trên', title: 'Tạo dấu cộng ở mặt trên',
    body: [
      'Mục tiêu: xoay 4 cạnh của tầng trên để màu của tâm U cùng hướng lên, tạo dấu cộng quanh tâm. Giữ mặt đáy đã làm ở dưới và mặt trước F hướng về bạn.',
      'Khác dấu cộng tầng đầu: bài này chưa cần màu ở bên hông của cạnh khớp tâm. Bốn góc ở mặt trên cũng chưa cần đúng.'
    ],
    reason: [
      'Hai tầng dưới đã xong. Ta phối hợp các nước xoay để đổi hướng cạnh tầng trên và khôi phục hai tầng dưới khi làm hết công thức.',
      'Làm cạnh trước, góc sau giúp bạn chỉ cần quan sát một nhóm khối mỗi lần.'
    ]
  },
  {
    id: 'patterns', section: 'Nhận diện trường hợp', title: 'Hai trường hợp: chữ L và hai cạnh đối',
    body: [
      'Chỉ nhìn 4 ô cạnh quanh tâm mặt trên, bỏ qua các góc. Khi có 2 cạnh đúng màu hướng lên, chúng nằm kề nhau thành chữ L hoặc đối diện nhau thành đường thẳng.',
      'Nếu chưa có cạnh nào hướng lên, ta gọi là hình chấm. Dùng công thức theo cách học bạn chọn một lượt để tạo chữ L, rồi tiếp tục từ hình mới. Nếu cả 4 cạnh đều hướng lên thì dấu cộng đã xong.'
    ],
    reason: [
      'Chữ L và hai cạnh đối có vị trí khác nhau nên cần một đường đi khác nhau để các cạnh còn lại hướng lên. Bạn có thể học hai công thức, hoặc dùng lặp một công thức.',
      'Nếu hai tầng dưới còn nguyên mà bạn đếm được 1 hoặc 3 cạnh hướng lên, hãy kiểm tra lại màu hoặc trạng thái khối: đây không phải trường hợp hợp lệ.'
    ]
  },
  {
    id: 'method', section: 'Chọn cách học', title: 'Bạn muốn nhớ ít hay xoay nhanh hơn?',
    body: ['Cả hai cách đều tạo được dấu cộng và giữ nguyên hai tầng dưới sau mỗi lượt. Chọn cách phù hợp với bạn: phần giải thích công thức và Gợi ý khi thực hành sẽ đi theo lựa chọn này.'],
    reason: ['Bạn không cần học cả hai ngay. Có thể quay lại trang này để đổi cách học; nếu đã luyện, đổi cách sẽ bắt đầu lại khối mẫu đang luyện.']
  }
]

const SHARED_REASON = [
  'Các nước xoay ngược không đơn giản huỷ nước ban đầu: ở giữa có nước xoay mặt khác, làm thay đổi nhóm khối mà nước trả lại tác động lên.',
  'Công thức tác động lên nhóm cạnh. Khi hướng dẫn, chỉ tâm U và một cạnh theo dõi phát sáng để bạn dễ nhìn đường đi.'
]

/** No method is preselected: formula explanations and practice appear only after an explicit pick. */
export function getLesson5Pages(method: TopCrossMethod | null): readonly Lesson5Page[] {
  if (!method) return BASE_PAGES
  return [...BASE_PAGES, {
    id: 'formula', section: 'Công thức và thực hành',
    title: method === 'dual' ? 'Hai công thức cho hai trường hợp' : 'Một công thức, lặp theo hình mới',
    formulas: method === 'dual' ? [TOP_CROSS_LINE_CARD, TOP_CROSS_L_CARD] : [TOP_CROSS_LINE_CARD],
    body: method === 'dual' ? [
      'Công thức hai cạnh đối giữ nguyên 6 nước. Công thức chữ L dùng chuỗi 8 nước bạn đã cung cấp, được quy đổi để mặt cần lắp vẫn ở trên U trong Bài 5 hiện tại.',
      'Chữ L hoặc hai cạnh đối: căn đúng hình rồi dùng công thức tương ứng, một lượt là có dấu cộng.',
      'Chưa có cạnh nào hướng lên: dùng công thức chữ L một lượt, được chữ L ở sau–phải. Lặp lại chính công thức đó một lượt nữa để có dấu cộng, không cần căn U giữa hai lượt. Tổng cộng 2 lượt.'
    ] : [
      'Bạn chỉ cần nhớ F R U R′ U′ F′ theo ba nhịp: mở mặt trước F → R U R′ U′ → đóng mặt trước F′.',
      'Hai cạnh đối: căn trái–phải, làm một lượt sẽ có dấu cộng. Chữ L: căn sau–trái, làm một lượt sẽ thành hai cạnh đối; căn lại trái–phải rồi làm thêm một lượt.',
      'Chưa có cạnh nào hướng lên: làm một lượt để có chữ L, rồi theo hai bước trên. Lộ trình: chấm → chữ L → hai cạnh đối → dấu cộng. Tổng cộng 3 lượt.'
    ],
    reason: [...SHARED_REASON,
      'Dừng quan sát sau mỗi lượt, căn lại U nếu cần. Hai tầng dưới có thể lệch tạm thời trong lượt: làm hết công thức để chúng trở lại. Nếu xoay nhầm, bấm Hoàn tác rồi tiếp tục hướng dẫn.'
    ]
  }]
}
