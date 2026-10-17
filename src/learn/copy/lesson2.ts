import { parseLearningAlgorithm as parseAlgorithm } from '../orientation'
import { FACES, type Face, type Move } from '../../smart-solver/core/types'
import { applyMoves, SOLVED } from '../../smart-solver/core/cubie'
import { CROSS, edgeDone } from '../goals'
import { FIXED_HOLD_NOTE } from './hold'
import type { LessonPage } from '../ui/LessonPlayer'

export type Lesson2Page = LessonPage & { kind: 'crossIntro' | 'middle' | 'lift' | 'align'; body: string[]; reason: string[] }

/** The picture: all four cross edges are away from the first (U) layer. */
export const CROSS_PICTURE_SCRAMBLE = parseAlgorithm('D B2 F2 R2 D F\'')

export type CrossLevelId = 'easy' | 'medium' | 'hard'

export interface CrossLevel {
  id: CrossLevelId
  label: string
  desc: string
}

export const CROSS_LEVELS: readonly CrossLevel[] = [
  { id: 'easy', label: 'Dễ', desc: 'Chỉ lệch 1 cạnh' },
  { id: 'medium', label: 'Trung bình', desc: 'Lệch 2 cạnh' },
  { id: 'hard', label: 'Khó', desc: 'Lệch cả 4 cạnh' }
]

const SUFFIXES = ['', "'", '2'] as const
const EASY_FACES: readonly Face[] = ['F', 'B', 'R', 'L']
const FALLBACK: Record<CrossLevelId, Move[]> = {
  easy: parseAlgorithm('F'),
  medium: parseAlgorithm("L2 B' L'"),
  hard: parseAlgorithm("R F' U2 L D R' B2 U")
}

/** How many of the four cross edges a scramble leaves in place. */
function crossEdgesInPlace(moves: Move[]): number {
  const state = applyMoves(SOLVED, moves)
  return CROSS.filter((e) => edgeDone(state, e)).length
}

/**
 * A random scramble for the level, checked to leave 3 (easy), 2 (medium) or 0 (hard) cross edges in
 * place; harder levels also turn more. `avoid` is the scramble just played, so a re-roll differs.
 */
export function generateCrossScramble(level: CrossLevelId, rng: () => number = Math.random, avoid?: Move[]): Move[] {
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]!
  const length = level === 'easy' ? 1 : level === 'medium' ? 2 + Math.floor(rng() * 3) : 7 + Math.floor(rng() * 3)
  const wanted = { easy: 3, medium: 2, hard: 0 }[level]
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const moves: Move[] = []
    let last: Face | null = null
    while (moves.length < length) {
      const face: Face = level === 'easy' ? pick(EASY_FACES) : pick(FACES)
      if (face === last) continue
      last = face
      moves.push(`${face}${pick(SUFFIXES)}` as Move)
    }
    if (crossEdgesInPlace(moves) !== wanted) continue
    if (avoid && moves.join(' ') === avoid.join(' ')) continue
    return moves
  }
  return FALLBACK[level]
}

export const LESSON2_PAGES: readonly Lesson2Page[] = [
  {
    id: 'cross', section: 'Mục tiêu', title: 'Đúng mặt trắng và đúng vị trí', kind: 'crossIntro',
    body: [FIXED_HOLD_NOTE,
      'Lắp bốn cạnh có màu trắng để tạo dấu cộng trên U. Một cạnh hoàn thành khi ô trắng hướng lên và màu bên hông khớp tâm cùng mặt.',
      'Cạnh đã đúng cả hai điều kiện thì bỏ qua. Với cạnh chưa đúng: đưa về tầng giữa, chọn cách đưa trắng lên U, căn ô đích rồi mới lắp.'
    ],
    reason: ['Lắp từng cạnh và giữ các cạnh đã đúng. Không cần làm các góc hay những màu còn lại ở bước này.']
  },
  {
    id: 'middle', section: 'Đưa cạnh về tầng giữa', title: 'Đưa cạnh ra hàng giữa ở bên hông', kind: 'middle',
    body: ['Cạnh chưa đúng đang ở U hoặc D? Trước khi xoay mặt bên, kiểm tra ô cạnh của mặt đó trên U: chọn ô đang sai để tránh làm mất cạnh đã đúng. Nếu cạnh đã ở hàng giữa thì bỏ qua bước này.',
      'Trong ví dụ, cạnh trên U của mặt R đang sai. Xoay R′ đưa cạnh trắng–xanh dương xuống hàng giữa và giữ nguyên cạnh trắng–xanh lá đã đúng.'
    ],
    reason: ['Xoay một mặt bên cũng di chuyển ô cạnh của mặt đó trên U. Nếu ô này đã đúng, nó sẽ bị đưa ra khỏi chỗ. Hãy chọn ô đang sai; khi thực hành, Gợi ý có thêm bước căn và trả U nếu cần để giữ các cạnh đã lắp.']
  },
  {
    id: 'lift', section: 'Chọn mặt để đưa cạnh lên', title: 'Cùng một vị trí, hai kết quả khác nhau', kind: 'lift',
    body: ['Tiếp tục phần trước: cạnh vừa được đưa xuống hàng giữa có hai cách để đi lên mặt cần lắp. Hãy chú ý hướng của ô trắng khi xoay nhé.',
      'Bấm R và F′ để so sánh hai cách. Cả hai đều đưa cạnh lên tầng trên, nhưng chỉ một cách đưa ô trắng hướng lên U.',
      'Ở phần này, chúng ta chỉ học cách đưa cạnh lên đúng mặt màu. Cách xác định vị trí cần lắp sẽ học ở phần tiếp theo.'
    ],
    reason: ['Hướng của ô trắng quyết định cách xoay để đưa cạnh lên đúng mặt màu. Hai cách đều bắt đầu từ cùng một khối mẫu, không xoay nối tiếp nhau.']
  },
  {
    id: 'align', section: 'Căn U và thực hành', title: 'Căn ô đích trước, đưa cạnh lên, rồi trả U', kind: 'align',
    body: ['Tiếp tục với cạnh trắng–xanh dương ở phần trước. Nhìn màu xanh dương để biết cạnh này cần vào ô trên U giáp tâm xanh dương ở phía sau (B).',
      'Sau khi biết mặt bên nào đưa trắng lên đúng hướng, tạm xoay U để đưa ô đích tới đường đi lên của cạnh. Tiếp đó xoay mặt bên như đã chọn, rồi trả U bằng nước ngược lại.',
      'Chuỗi minh hoạ: U2 → F′ → U2. Ô có ◎ là vị trí đích ban đầu. U2 (xoay U nửa vòng) đưa ô đích tới đường đi qua F; F′ đưa trắng lên trên; U2 trả cạnh về cạnh tâm xanh dương.',
      'Nếu đường đi đã trùng ô đích thì không cần căn hoặc trả U. Với các cạnh đã đúng, chúng có thể tạm đổi chỗ khi căn U nhưng phải trở lại sau khi hoàn tất chuỗi.',
      'Bấm Thực hành để luyện. Gợi ý đi theo đúng quy trình: đưa về tầng giữa → căn U nếu cần → đưa cạnh lên → trả U.'
    ],
    reason: ['Tâm không đổi chỗ khi xoay U, nhưng bốn ô cạnh trên U đi vòng quanh tâm. Căn U là tạm dời ô đích tới nơi dễ lắp; trả U mới đưa cạnh và các cạnh đã lắp về đúng vị trí theo tâm.']
  }
]
