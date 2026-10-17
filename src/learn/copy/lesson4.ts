import { parseLearningAlgorithm as parseAlgorithm } from '../orientation'
import { applyMoves, invertMoves, parseAlgorithm as parsePhysicalAlgorithm, SOLVED } from '../../smart-solver/core/cubie'
import type { Move } from '../../smart-solver/core/types'
import { MIDDLE, edgeDone, firstLayerDone } from '../goals'
import { ALG_VARIANTS } from '../guide/middleAlgs'
import type { LessonPage } from '../ui/LessonPlayer'

export type Lesson4Page = LessonPage & { kind: 'middleIntro' | 'middleFormula'; body: string[]; reason: string[] }

export type MiddleLevelId = 'easy' | 'medium' | 'hard'

export interface MiddleLevel {
  id: MiddleLevelId
  label: string
  desc: string
}

export const MIDDLE_LEVELS: readonly MiddleLevel[] = [
  { id: 'easy', label: 'Dễ', desc: 'Chỉ lệch 1 cạnh' },
  { id: 'medium', label: 'Trung bình', desc: 'Lệch 2 cạnh' },
  { id: 'hard', label: 'Khó', desc: 'Lệch cả 4 cạnh' }
]

const TOPS = ['', 'D', "D'", 'D2'] as const
const FALLBACK: Record<MiddleLevelId, Move[]> = {
  easy: parseAlgorithm("U R U' R' U' F' U F"),
  medium: parseAlgorithm("U R U' R' U' F' U F U' L' U L U F U' F'"),
  hard: parseAlgorithm("U U B U' B' U' R' U R U U' L' U L U F U' F' U U' B' U B U L U' L' U' U R U' R' U' F' U F")
}

/** The picture: the first layer is done and all four middle edges are out of their slots. */
export const MIDDLE_PICTURE_SCRAMBLE = parseAlgorithm("U U B U' B' U' R' U R U U' L' U L U F U' F' U U' B' U B U L U' L' U' U R U' R' U' F' U F")

function middleInPlace(moves: Move[]): number {
  const state = applyMoves(SOLVED, moves)
  return firstLayerDone(state) ? MIDDLE.filter((e) => edgeDone(state, e)).length : -1
}

/**
 * A random scramble that keeps the first layer and leaves 3 (easy), 2 (medium) or 0 (hard) middle edges
 * in place. It is built from the middle formula itself (any side, either mirror), which never breaks
 * the first layer. `avoid` is the scramble just played, so a re-roll differs.
 */
export function generateMiddleScramble(level: MiddleLevelId, rng: () => number = Math.random, avoid?: Move[]): Move[] {
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]!
  const wanted = { easy: 3, medium: 2, hard: 0 }[level]
  const blocks = level === 'easy' ? 1 : level === 'medium' ? 2 + Math.floor(rng() * 2) : 4 + Math.floor(rng() * 3)
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const text: string[] = []
    for (let i = 0; i < blocks; i += 1) {
      const t = pick(TOPS)
      if (t) text.push(t)
      text.push(...pick(ALG_VARIANTS).seq)
    }
    const moves = parsePhysicalAlgorithm(text.join(' '))
    if (middleInPlace(moves) !== wanted) continue
    if (avoid && moves.join(' ') === avoid.join(' ')) continue
    return moves
  }
  return FALLBACK[level]
}

export const LESSON4_PAGES: readonly Lesson4Page[] = [
  {
    id: 'middle',
    section: 'Tầng giữa',
    title: 'Lắp 4 cạnh tầng giữa',
    kind: 'middleIntro',
    body: [
      'Mục tiêu của bài này: đưa 4 cạnh của tầng giữa về đúng chỗ, giữa hai mặt bên.',
      'Mỗi cạnh tầng giữa có 2 màu khớp với hai tâm của hai mặt bên cạnh nó, và không có màu của mặt trên hay mặt đáy.'
    ],
    reason: [
      'Có tầng đầu rồi, tầng giữa làm hai phần ba khối đúng; chỉ còn lại phần phía mặt vàng.',
      'Một cạnh nằm ở phía mặt vàng mà không có màu vàng thì chắc chắn là cạnh của tầng giữa, nên dễ nhận ra cạnh nào cần lắp.',
      'Chỉ cần một công thức (cùng bản đối xứng của nó) cho cả 4 rãnh, và công thức này giữ nguyên tầng đầu, nên ta không phá những gì đã làm.'
    ]
  },
  {
    id: 'formula',
    section: 'Công thức',
    title: 'Hai công thức trượt cạnh',
    kind: 'middleFormula',
    body: [
      'Mỗi lần chỉ lắp một cạnh. Cạnh đang nằm ở phía mặt vàng sẽ được trượt lên tầng giữa bằng một trong hai công thức dưới đây: sang trái hoặc sang phải.',
      'Bước 1 là bước căn, luôn làm trước: xoay D (hoặc D′, đôi khi D2) cho màu bên hông của cạnh nằm cùng mặt với tâm cùng màu. Bước này giúp bạn xác định khối cần lắp và mặt mốc F của công thức dễ hơn.',
      'Bước 2: nhìn màu còn lại của cạnh. Nếu nó trùng tâm mặt bên trái của mặt mốc thì dùng công thức trái; trùng tâm bên phải thì dùng công thức phải.'
    ],
    reason: [
      'Công thức gồm hai nhịp: nhịp đầu đưa góc của tầng đầu xuống đứng cạnh khối cạnh thành một cặp, nhịp sau trượt cả cặp lên đúng rãnh. Tầng đầu được trả về nguyên vẹn.',
      'Hai công thức là bản đối xứng của nhau, nên chỉ cần nhớ một khuôn và đổi bên.'
    ]
  }
]

/** The two formulas, written for the green face (F) as the reference face; the other faces use the same turns relabelled. */
export interface MiddleFormulaCard {
  id: 'left' | 'right'
  title: string
  /** Face the edge slides towards. */
  target: 'L' | 'R'
  moves: Move[]
  /** Pieces that move: the middle edge and the first-layer corner above its slot (grid cells are read from the cubes). */
  edgePiece: number
  cornerPiece: number
  before: ReturnType<typeof applyMoves>
  after: ReturnType<typeof applyMoves>
}

const cardOf = (target: 'L' | 'R', title: string, edgePiece: number, cornerPiece: number): MiddleFormulaCard => {
  const variant = ALG_VARIANTS.find((v) => v.front === 'F' && v.target === target)!
  const moves = parsePhysicalAlgorithm(variant.seq.join(' '))
  const before = applyMoves(SOLVED, invertMoves(moves))
  return { id: target === 'L' ? 'left' : 'right', title, target, moves, edgePiece, cornerPiece, before, after: applyMoves(before, moves) }
}

export const MIDDLE_FORMULAS: readonly MiddleFormulaCard[] = [
  cardOf('L', 'Trượt cạnh sang trái (rãnh F–L)', 9, 1),
  cardOf('R', 'Trượt cạnh sang phải (rãnh F–R)', 8, 0)
]

/** Fixed worked examples (always the same cubes). Both start with the first layer done. */
export const MIDDLE_EXAMPLES = [
  {
    id: 'top',
    title: 'Cạnh nằm ở phía mặt vàng',
    when: 'Cạnh không có màu vàng nằm ở phía mặt vàng: căn D cho cạnh cùng mặt với tâm cùng màu, rồi dùng một trong hai công thức.',
    scramble: parsePhysicalAlgorithm("D F D' F' D' R' D R D'")
  },
  {
    id: 'wrong',
    title: 'Cạnh ở tầng giữa nhưng sai chỗ hoặc bị ngược',
    when: 'Cạnh đã nằm trong tầng giữa nhưng không khớp hai tâm của rãnh đó: dùng công thức tại chính rãnh này để đẩy nó xuống phía mặt vàng, rồi làm như trường hợp trước.',
    scramble: parsePhysicalAlgorithm("D F D' F' D' R' D R D2 D F D' F' D' R' D R")
  }
] as const
