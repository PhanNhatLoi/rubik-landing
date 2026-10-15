import { FACES, type Face, type Move } from '../../smart-solver/core/types'
import { applyMoves, parseAlgorithm, SOLVED } from '../../smart-solver/core/cubie'
import { CROSS, edgeDone } from '../../smart-solver/nxn/beginner'
import type { LessonPage } from '../ui/LessonPlayer'

export type Lesson2Page = LessonPage & { kind: 'crossIntro'; body: string[]; reason: string[] }

/** The picture: all four cross edges are away from the bottom layer, and visible from above. */
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
    id: 'cross',
    section: 'Dấu cộng',
    title: 'Dấu cộng ở tầng đầu',
    kind: 'crossIntro',
    body: [
      'Mục tiêu của bài này: đưa 4 cạnh của mặt đáy về đúng chỗ để tạo thành dấu cộng.',
      'Mỗi cạnh có 2 màu. Một màu thuộc mặt đáy, màu còn lại phải khớp với tâm của mặt bên cạnh nó.'
    ],
    reason: [
      'Dấu cộng là nền móng của tầng đầu tiên: có nó rồi, bạn chỉ cần gắn thêm 4 góc là xong cả tầng.',
      'Các tâm không bao giờ đổi chỗ, nên chúng là mốc để đối chiếu màu của cạnh.',
      'Làm đúng bước này thì các bước sau không phải phá nó đi.'
    ]
  }
]
