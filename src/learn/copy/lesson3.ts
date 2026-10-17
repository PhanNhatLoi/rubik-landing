import { parseLearningAlgorithm as parseAlgorithm } from '../orientation'
import { applyMoves, SOLVED } from '../../smart-solver/core/cubie'
import type { Move } from '../../smart-solver/core/types'
import { FIRST_CORNERS, cornerDone, crossDone } from '../goals'
import type { LessonPage } from '../ui/LessonPlayer'

export type Lesson3Page = LessonPage & { kind: 'cornersIntro'; body: string[]; reason: string[] }

export type CornerLevelId = 'easy' | 'medium' | 'hard'

export interface CornerLevel {
  id: CornerLevelId
  label: string
  desc: string
}

export const CORNER_LEVELS: readonly CornerLevel[] = [
  { id: 'easy', label: 'Dễ', desc: 'Chỉ lệch 1 góc' },
  { id: 'medium', label: 'Trung bình', desc: 'Lệch 2 góc' },
  { id: 'hard', label: 'Khó', desc: 'Lệch cả 4 góc' }
]

const SIDES = ['R', "R'", 'L', "L'", 'F', "F'", 'B', "B'"] as const
const TOPS = ['U', "U'", 'U2'] as const
const FALLBACK: Record<CornerLevelId, Move[]> = {
  easy: parseAlgorithm("R U R'"),
  medium: parseAlgorithm("R U R' F U F'"),
  hard: parseAlgorithm("R U' R' U' L' U2 L U B U' B' U B' U' B")
}

/** The picture: the cross is done and all four first-layer corners sit in the bottom layer. */
export const CORNER_PICTURE_SCRAMBLE = parseAlgorithm("B U' B' R U2 R' B' U B L' U' L")

/** How many first-layer corners a scramble leaves in place (0 when it breaks the cross). */
function cornersInPlace(moves: Move[]): number {
  const state = applyMoves(SOLVED, moves)
  return crossDone(state) ? FIRST_CORNERS.filter((c) => cornerDone(state, c)).length : -1
}

/**
 * A random scramble that keeps the cross and leaves 3 (easy), 2 (medium) or 0 (hard) first-layer corners in
 * place. It is built from "a side face, a top turn, the side face back", which never breaks the cross.
 * `avoid` is the scramble just played, so a re-roll differs.
 */
export function generateCornerScramble(level: CornerLevelId, rng: () => number = Math.random, avoid?: Move[]): Move[] {
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]!
  const wanted = { easy: 3, medium: 2, hard: 0 }[level]
  const blocks = level === 'easy' ? 1 : level === 'medium' ? 2 + Math.floor(rng() * 2) : 4 + Math.floor(rng() * 3)
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const text: string[] = []
    for (let i = 0; i < blocks; i += 1) {
      const side = pick(SIDES)
      const inverse = side.endsWith("'") ? side[0]! : `${side}'`
      text.push(side, pick(TOPS), inverse)
      if (rng() < 0.5) text.push(pick(TOPS))
    }
    const moves = parseAlgorithm(text.join(' '))
    if (cornersInPlace(moves) !== wanted) continue
    if (avoid && moves.join(' ') === avoid.join(' ')) continue
    return moves
  }
  return FALLBACK[level]
}

export const LESSON3_PAGES: readonly Lesson3Page[] = [
  {
    id: 'corners',
    section: 'Lắp góc',
    title: 'Lắp 4 góc của tầng đầu',
    kind: 'cornersIntro',
    body: [
      'Mục tiêu của bài này: đưa 4 khối góc về đúng chỗ ở mặt trên, hoàn thành cả tầng đầu tiên.',
      'Mỗi góc có 3 màu: một màu thuộc mặt trên, hai màu còn lại phải khớp với tâm của hai mặt bên cạnh nó.'
    ],
    reason: [
      'Có dấu cộng rồi, bốn góc sẽ làm tròn tầng đầu: cả mặt trên đúng và mỗi mặt bên đều có một hàng đúng ở trên.',
      'Mỗi góc dùng cùng một công thức 3 nước: xoay một mặt bên để mở chỗ trống, xoay mặt trắng hoặc mặt vàng cho góc tới đúng chỗ, rồi trả mặt bên về. Góc nằm cạnh mặt vàng thì lắp lên; góc đang ở mặt trắng nhưng sai chỗ thì đưa xuống rồi lắp lại.',
      'Xong bước này, các bước sau chỉ làm việc ở phần còn lại của khối, không phá tầng đầu.'
    ]
  }
]
