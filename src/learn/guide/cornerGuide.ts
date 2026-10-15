import { CORNER_COLORS } from '../../smart-solver/core/facelets'
import type { CubieState, Face } from '../../smart-solver/core/types'
import { D_CORNERS, cornerDone, crossDone } from '../../smart-solver/nxn/beginner'
import { inv, mergeSteps, type ColorNames, type GuideStep } from './crossGuide'
import { applyNotation, findCorner, fromCubie, toCubie, type Physical } from './physical'

/**
 * Step-by-step guide that puts ONE bottom-layer corner in place (the cross is already done).
 * A corner is only ever in the top layer or the bottom layer, so there are three cases:
 * top with its yellow sticker on a side (insert), top with yellow facing up (flip, then insert),
 * and bottom but wrong (lift, then as above). Insert, flip and lift are the same three turns:
 * a side face lifts the slot, the top layer moves the corner, the side face goes back.
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

const CORNER_NAME: Record<number, string> = { 4: 'DFR', 5: 'DLF', 6: 'DBL', 7: 'DRB' }
const RANK: Record<CornerCase, number> = { top: 0, flip: 1, bottom: 2 }
const SIDE_TURNS = ['R', "R'", 'L', "L'", 'F', "F'", 'B', "B'"] as const
const TOP_TURNS = ['U', "U'", 'U2'] as const
const PREFIXES: string[][] = [[], ['U'], ["U'"], ['U2']]

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
    return colors.length === 1 && colors[0] === 'D'
  })
  return c ? [c.grid.x, c.grid.y, c.grid.z] : [1, 0, 1]
}

export function buildCornerGuide(state: CubieState, names: ColorNames): CornerGuide | null {
  if (!crossDone(state)) return null
  const todo = D_CORNERS.filter((c) => !cornerDone(state, c))
  if (!todo.length) return null
  const placed = D_CORNERS.filter((c) => cornerDone(state, c))
  const start = fromCubie(state)
  const yellow = names.D

  const pairName = (piece: number) => {
    const [, a, b] = CORNER_COLORS[piece]!
    return `${yellow}–${names[a]}–${names[b]}`
  }
  const safe = (p: Physical) => {
    const s = toCubie(p)
    return !!s && crossDone(s) && placed.every((c) => cornerDone(s, c))
  }
  const where = (p: Physical, piece: number) => {
    const c = findCorner(p, CORNER_COLORS[piece]!)!
    return { layer: c.grid.y, yellowUp: c.keyOf('D') === 'py' }
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
    if (role === 'align') return `Xoay tầng trên để đưa góc ${name} tới vị trí thích hợp: nó phải nằm cạnh chỗ nó sẽ rơi xuống.`
    if (role === 'lead') {
      return phase === 'lift'
        ? `Góc ${name} đang ở tầng đáy nhưng chưa đúng. Xoay mặt ${m[0]} để kéo nó lên tầng trên. Mặt này cũng kéo theo một cạnh dấu cộng, nhưng bước cuối sẽ trả lại.`
        : `Xoay mặt ${m[0]} để nâng chỗ trống (nơi góc cần vào) lên tầng trên. Cạnh dấu cộng đi theo tạm thời, bước cuối sẽ trả lại.`
    }
    if (role === 'move') {
      return phase === 'insert'
        ? `Xoay tầng trên để đưa góc ${name} vào chỗ trống vừa nâng lên.`
        : phase === 'flip'
          ? `Mặt ${yellow} của góc đang hướng lên trên. Xoay tầng trên để lật hướng nó sang bên hông, chuẩn bị lắp xuống.`
          : 'Xoay tầng trên để góc nằm ở tầng trên, tránh nước trả lại kéo nó xuống nhầm chỗ.'
    }
    return phase === 'insert'
      ? `Trả mặt ${m[0]} về chỗ cũ: góc ${name} rơi xuống đúng vị trí, mặt ${yellow} hướng xuống; cạnh dấu cộng quay lại như cũ.`
      : phase === 'flip'
        ? `Trả mặt ${m[0]} về chỗ cũ. Góc vẫn ở tầng trên nhưng mặt ${yellow} đã nằm bên hông.`
        : `Trả mặt ${m[0]} về chỗ cũ. Góc ${name} giờ đã ở tầng trên, mặt ${yellow} ${kind === 'bottom' ? 'có thể hướng lên hoặc ra hông' : ''}.`.replace(' .', '.')
  }

  const asSteps = (seq: string[], prefix: number, kind: CornerCase, piece: number, phase: 'lift' | 'flip' | 'insert'): GuideStep[] =>
    seq.map((m, i) => {
      const role: Role = i < prefix ? 'align' : i === prefix ? 'lead' : i === prefix + 1 ? 'move' : 'restore'
      return { notation: m, why: explain(kind, piece, role, m, phase) }
    })

  /** From the top layer: flip first if the yellow sticker faces up, then insert. */
  const fromTop = (p: Physical, piece: number, kind: CornerCase): { steps: GuideStep[]; end: Physical } | null => {
    let cur = p
    const steps: GuideStep[] = []
    if (where(cur, piece).yellowUp) {
      const flip = commutator(cur, (q) => {
        const w = where(q, piece)
        return w.layer === 2 && !w.yellowUp && safe(q)
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
    if (w.layer === 2) {
      const r = fromTop(start, piece, w.yellowUp ? 'flip' : 'top')
      if (r) plans.push({ kind: w.yellowUp ? 'flip' : 'top', piece, steps: r.steps })
    } else if (w.layer === 0) {
      const lift = commutator(start, (q) => where(q, piece).layer === 2 && safe(q))
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
    top: `Chọn góc ${name}: nó đang ở tầng trên và mặt ${yellow} nằm bên hông, nên có thể lắp xuống ngay.`,
    flip: `Chọn góc ${name}: nó ở tầng trên nhưng mặt ${yellow} đang hướng lên. Mình lật nó sang hông trước, rồi lắp xuống như bình thường.`,
    bottom: `Chọn góc ${name}: nó đã ở tầng đáy nhưng chưa đúng chỗ hoặc bị ngược mặt. Mình đưa nó lên tầng trên rồi lắp lại cho đúng.`
  }
  return {
    piece: best.piece,
    corner: CORNER_NAME[best.piece]!,
    kind: best.kind,
    title: { top: 'Góc ở tầng trên', flip: 'Góc ở tầng trên, mặt vàng hướng lên', bottom: 'Góc sai chỗ ở tầng đáy' }[best.kind],
    intro: intro[best.kind],
    steps,
    states,
    halves,
    pieceCells,
    centerCells
  }
}
