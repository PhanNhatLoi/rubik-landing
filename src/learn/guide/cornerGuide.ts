import { CORNER_COLORS } from '../../smart-solver/core/facelets'
import type { CubieState, Face } from '../../smart-solver/core/types'
import { FIRST_CORNERS, cornerDone, crossDone } from '../goals'
import { inv, mergeSteps, type ColorNames, type GuideStep } from './crossGuide'
import { applyNotation, findCorner, fromCubie, toCubie, type Physical } from './physical'

/**
 * Step-by-step guide that puts ONE upper-layer corner in place (the cross is already done).
 * A corner is only ever in the top layer or the bottom layer, so there are three cases:
 * bottom with its white sticker on a side (insert), bottom with white facing down (flip, then insert),
 * and top but wrong (lift, then as above). Insert, flip and lift are the same three turns:
 * a side face lifts the slot, the bottom layer moves the corner, the side face goes back.
 */
export type CornerCase = 'top' | 'flip' | 'bottom'

export interface CornerGuide {
  piece: number
  /** Which corner, e.g. "DFR". */
  corner: string
  kind: CornerCase
  title: string
  intro: string
  steps: GuideStep[]
  states: CubieState[]
  /** For each step: the cube after only a quarter of a half-turn step, either way. */
  halves: CubieState[][]
  pieceCells: number[][]
  centerCells: number[][]
}

const CORNER_NAME: Record<number, string> = { 0: 'URF', 1: 'UFL', 2: 'ULB', 3: 'UBR' }
const RANK: Record<CornerCase, number> = { top: 0, flip: 1, bottom: 2 }
const SIDE_TURNS = ['R', "R'", 'L', "L'", 'F', "F'", 'B', "B'"] as const
const TOP_TURNS = ['D', "D'", 'D2'] as const
const PREFIXES: string[][] = [[], ['D'], ["D'"], ['D2']]

type Role = 'align' | 'lead' | 'move' | 'restore'

interface Plan {
  kind: CornerCase
  piece: number
  steps: GuideStep[]
}

const cellOf = (p: Physical, piece: number): number[] => {
  const c = findCorner(p, CORNER_COLORS[piece]!)!
  return [c.grid.x, c.grid.y, c.grid.z]
}
const centerCell = (p: Physical): number[] => {
  const c = p.find((cb) => {
    const colors = Object.values(cb.stickers).filter((v) => v != null)
    return colors.length === 1 && colors[0] === 'U'
  })
  return c ? [c.grid.x, c.grid.y, c.grid.z] : [1, 2, 1]
}

export function buildCornerGuide(state: CubieState, names: ColorNames): CornerGuide | null {
  if (!crossDone(state)) return null
  const todo = FIRST_CORNERS.filter((c) => !cornerDone(state, c))
  if (!todo.length) return null
  const placed = FIRST_CORNERS.filter((c) => cornerDone(state, c))
  const start = fromCubie(state)
  const firstColor = names.U

  const pairName = (piece: number) => {
    const [, a, b] = CORNER_COLORS[piece]!
    return `${firstColor}–${names[a]}–${names[b]}`
  }
  const safe = (p: Physical) => {
    const s = toCubie(p)
    return !!s && crossDone(s) && placed.every((c) => cornerDone(s, c))
  }
  const where = (p: Physical, piece: number) => {
    const c = findCorner(p, CORNER_COLORS[piece]!)!
    return { layer: c.grid.y, whiteDown: c.keyOf('U') === 'ny' }
  }

  /** [lead, move, restore] with an optional top-layer alignment before it, shortest first. */
  const commutator = (p: Physical, ok: (q: Physical) => boolean) => {
    const cand: { seq: string[]; prefix: number }[] = []
    for (const prefix of PREFIXES) {
      for (const a of SIDE_TURNS) for (const k of TOP_TURNS) cand.push({ seq: [...prefix, a, k, inv(a)], prefix: prefix.length })
    }
    cand.sort((x, y) => x.seq.length - y.seq.length || x.prefix - y.prefix)
    const hit = cand.find((c) => ok(c.seq.reduce(applyNotation, p)))
    return hit ?? null
  }

  const explain = (kind: CornerCase, piece: number, role: Role, m: string, phase: 'lift' | 'flip' | 'insert'): string => {
    const name = pairName(piece)
    if (role === 'align') return `Xoay tầng dưới để đưa góc ${name} tới vị trí thích hợp: nó phải nằm cạnh chỗ nó sẽ đi lên.`
    if (role === 'lead') {
      return phase === 'lift'
        ? `Góc ${name} đang ở tầng trên nhưng chưa đúng. Xoay mặt ${m[0]} để kéo nó xuống tầng dưới. Mặt này cũng kéo theo một cạnh dấu cộng, nhưng bước cuối sẽ trả lại.`
        : `Xoay mặt ${m[0]} để hạ chỗ trống (nơi góc cần vào) xuống tầng dưới. Cạnh dấu cộng đi theo tạm thời, bước cuối sẽ trả lại.`
    }
    if (role === 'move') {
      return phase === 'insert'
        ? `Xoay tầng dưới để đưa góc ${name} vào chỗ trống vừa hạ xuống.`
        : phase === 'flip'
          ? `Mặt ${firstColor} của góc đang hướng xuống dưới. Xoay tầng dưới để lật hướng nó sang bên hông, chuẩn bị lắp lên.`
          : 'Xoay tầng dưới để góc nằm ở tầng dưới, tránh nước trả lại kéo nó lên nhầm chỗ.'
    }
    return phase === 'insert'
      ? `Trả mặt ${m[0]} về chỗ cũ: góc ${name} đi lên đúng vị trí, mặt ${firstColor} hướng lên; cạnh dấu cộng quay lại như cũ.`
      : phase === 'flip'
        ? `Trả mặt ${m[0]} về chỗ cũ. Góc vẫn ở tầng dưới nhưng mặt ${firstColor} đã nằm bên hông.`
        : `Trả mặt ${m[0]} về chỗ cũ. Góc ${name} giờ đã ở tầng dưới, mặt ${firstColor} ${kind === 'bottom' ? 'có thể hướng xuống hoặc ra hông' : ''}.`.replace(' .', '.')
  }

  const asSteps = (seq: string[], prefix: number, kind: CornerCase, piece: number, phase: 'lift' | 'flip' | 'insert'): GuideStep[] =>
    seq.map((m, i) => {
      const role: Role = i < prefix ? 'align' : i === prefix ? 'lead' : i === prefix + 1 ? 'move' : 'restore'
      return { notation: m, why: explain(kind, piece, role, m, phase) }
    })

  /** From the bottom layer: flip first if the white sticker faces down, then insert. */
  const fromTop = (p: Physical, piece: number, kind: CornerCase): { steps: GuideStep[]; end: Physical } | null => {
    let cur = p
    const steps: GuideStep[] = []
    if (where(cur, piece).whiteDown) {
      const flip = commutator(cur, (q) => {
        const w = where(q, piece)
        return w.layer === 0 && !w.whiteDown && safe(q)
      })
      if (!flip) return null
      steps.push(...asSteps(flip.seq, flip.prefix, kind, piece, 'flip'))
      cur = flip.seq.reduce(applyNotation, cur)
    }
    const insert = commutator(cur, (q) => {
      const s = toCubie(q)
      return !!s && cornerDone(s, piece) && safe(q)
    })
    if (!insert) return null
    steps.push(...asSteps(insert.seq, insert.prefix, kind, piece, 'insert'))
    return { steps, end: insert.seq.reduce(applyNotation, cur) }
  }

  const plans: Plan[] = []
  for (const piece of todo) {
    const w = where(start, piece)
    if (w.layer === 0) {
      const r = fromTop(start, piece, w.whiteDown ? 'flip' : 'top')
      if (r) plans.push({ kind: w.whiteDown ? 'flip' : 'top', piece, steps: r.steps })
    } else if (w.layer === 2) {
      const lift = commutator(start, (q) => where(q, piece).layer === 0 && safe(q))
      if (!lift) continue
      const lifted = lift.seq.reduce(applyNotation, start)
      const r = fromTop(lifted, piece, 'bottom')
      if (r) plans.push({ kind: 'bottom', piece, steps: [...asSteps(lift.seq, lift.prefix, 'bottom', piece, 'lift'), ...r.steps] })
    }
  }
  if (!plans.length) return null
  plans.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.piece - b.piece)
  const best = plans[0]!
  const steps = mergeSteps(best.steps)

  const states: CubieState[] = []
  const halves: CubieState[][] = []
  const pieceCells: number[][] = []
  const centerCells: number[][] = []
  let p = start
  for (let i = 0; i <= steps.length; i += 1) {
    const s = toCubie(p)
    if (!s) return null
    states.push(s)
    pieceCells.push(cellOf(p, best.piece))
    centerCells.push(centerCell(p))
    if (i < steps.length) {
      const n = steps[i]!.notation
      halves.push(
        n.endsWith('2')
          ? [`${n[0]}`, `${n[0]}'`].map((q) => toCubie(applyNotation(p, q))).filter((x): x is CubieState => x !== null)
          : []
      )
      p = applyNotation(p, n)
    }
  }

  const name = pairName(best.piece)
  const intro: Record<CornerCase, string> = {
    top: `Chọn góc ${name}: nó đang ở tầng dưới và mặt ${firstColor} nằm bên hông, nên có thể lắp lên ngay.`,
    flip: `Chọn góc ${name}: nó ở tầng dưới nhưng mặt ${firstColor} đang hướng xuống. Mình lật nó sang hông trước, rồi lắp lên như bình thường.`,
    bottom: `Chọn góc ${name}: nó đã ở tầng trên nhưng chưa đúng chỗ hoặc bị ngược mặt. Mình đưa nó xuống tầng dưới rồi lắp lại cho đúng.`
  }
  return {
    piece: best.piece,
    corner: CORNER_NAME[best.piece]!,
    kind: best.kind,
    title: { top: 'Góc ở tầng dưới', flip: 'Góc ở tầng dưới, mặt trắng hướng xuống', bottom: 'Góc sai chỗ ở tầng trên' }[best.kind],
    intro: intro[best.kind],
    steps,
    states,
    halves,
    pieceCells,
    centerCells
  }
}
