import { applyMove } from '../../smart-solver/core/cubie'
import type { CubieState, Face } from '../../smart-solver/core/types'
import { CROSS, edgeDone } from '../../smart-solver/nxn/beginner'
import { applyNotation, findEdge, fromCubie, toCubie, type Physical } from './physical'

/**
 * Step-by-step guide that puts ONE cross edge in place, in the order a learner can follow:
 * pick the edge that is easiest to see, then branch on where it is. Every step says why.
 * The yellow face (D) is the one being built; the cube is assumed to have its centers at home.
 */
export type CrossCase = 'direct' | 'top' | 'bottom' | 'middle'

export interface GuideStep {
  /** Fixed-position notation (faces U R F D L B, slices M E S, with ' or 2). */
  notation: string
  why: string
}

export interface CrossGuide {
  /** Index of the edge piece (see CROSS in beginner.ts). */
  piece: number
  /** Which edge, e.g. "DF". */
  edge: string
  /** Face whose center the edge's second color must match. */
  target: Face
  kind: CrossCase
  title: string
  /** Why this edge, and what the plan is. */
  intro: string
  steps: GuideStep[]
  /** Center-relative cube after 0, 1, … steps (what the app tracks while the learner turns). */
  states: CubieState[]
  /** For each step: the cube after turning only a quarter of a half-turn step either way (empty for other steps). */
  halves: CubieState[][]
  /** Grid cell of the edge before each step, and of the D center (the face being built). */
  pieceCells: number[][]
  centerCells: number[][]
}

export type ColorNames = Record<Face, string>

const TARGET: Record<number, Face> = { 4: 'R', 5: 'F', 6: 'L', 7: 'B' }
const EDGE_NAME: Record<number, string> = { 4: 'DR', 5: 'DF', 6: 'DL', 7: 'DB' }
const RANK: Record<CrossCase, number> = { direct: 0, top: 1, bottom: 2, middle: 3 }

const ALL_TURNS = ['U', "U'", 'U2', 'D', "D'", 'D2', 'R', "R'", 'R2', 'L', "L'", 'L2', 'F', "F'", 'F2', 'B', "B'", 'B2'] as const

/** Shortest face-turn sequence (up to 4) that puts `piece` in place and leaves `placed` in place. */
function shortestSafe(from: CubieState, piece: number, placed: readonly number[]): string[] | null {
  const search = (state: CubieState, seq: string[], depth: number): string[] | null => {
    for (const m of ALL_TURNS) {
      if (seq.length && seq[seq.length - 1]![0] === m[0]) continue
      const next = applyMove(state, m)
      const s = [...seq, m]
      if (depth === 1) {
        if (edgeDone(next, piece) && placed.every((o) => edgeDone(next, o))) return s
      } else {
        const r = search(next, s, depth - 1)
        if (r) return r
      }
    }
    return null
  }
  for (let depth = 1; depth <= 4; depth += 1) {
    const r = search(from, [], depth)
    if (r) return r
  }
  return null
}

const QUARTERS: Record<string, number> = { '': 1, "'": 3, '2': 2 }
const SUFFIX = ['', '', '2', "'"]

/** Adjacent turns of the same face or slice become one turn (R2 then R is R'); a full circle vanishes. */
export function mergeSteps(steps: GuideStep[]): GuideStep[] {
  const out: GuideStep[] = []
  for (const step of steps) {
    const last = out[out.length - 1]
    if (last && last.notation[0] === step.notation[0]) {
      const total = ((QUARTERS[last.notation.slice(1)]! + QUARTERS[step.notation.slice(1)]!) % 4 + 4) % 4
      out.pop()
      if (total !== 0) out.push({ notation: `${step.notation[0]}${SUFFIX[total]}`, why: `${last.why} ${step.why}` })
    } else out.push(step)
  }
  return out
}

export const inv = (m: string) => (m.endsWith("'") ? m[0]! : m.endsWith('2') ? m : `${m}'`)
const run = (p: Physical, seq: readonly string[]) => seq.reduce(applyNotation, p)
const cellOf = (p: Physical, e: number) => {
  const t = TARGET[e]!
  const ed = findEdge(p, 'D', t)!
  return [ed.grid.x, ed.grid.y, ed.grid.z]
}
const centerCell = (p: Physical) => {
  const c = p.find((cb) => {
    const colors = Object.values(cb.stickers).filter((v) => v != null)
    return colors.length === 1 && colors[0] === 'D'
  })
  return c ? [c.grid.x, c.grid.y, c.grid.z] : [1, 0, 1]
}

/** Faces touching an edge cell. */
function facesAt(cell: number[]): Face[] {
  const [x, y, z] = cell as [number, number, number]
  const faces: Face[] = []
  if (x === 2) faces.push('R')
  if (x === 0) faces.push('L')
  if (z === 2) faces.push('F')
  if (z === 0) faces.push('B')
  if (y === 2) faces.push('U')
  if (y === 0) faces.push('D')
  return faces
}

interface Plan {
  kind: CrossCase
  piece: number
  steps: { notation: string; why: string }[]
}

export function buildCrossGuide(state: CubieState, names: ColorNames): CrossGuide | null {
  const start = fromCubie(state)
  const placed = CROSS.filter((e) => edgeDone(state, e))
  const todo = CROSS.filter((e) => !edgeDone(state, e))
  if (!todo.length) return null

  const okAfter = (p: Physical, piece: number) => {
    const s = toCubie(p)
    return !!s && edgeDone(s, piece) && placed.every((o) => edgeDone(s, o))
  }
  const placedIntact = (p: Physical) => {
    const s = toCubie(p)
    return !!s && placed.every((o) => edgeDone(s, o))
  }

  const yellow = names.D
  const pairName = (piece: number) => `${yellow}–${names[TARGET[piece]!]}`

  /** Last part, shared by the cases: the edge is in the top layer; put it into its slot. */
  const insert = (p: Physical, piece: number): { notation: string; why: string }[] | null => {
    const X = TARGET[piece]!
    const ed = findEdge(p, 'D', X)!
    if (ed.grid.y !== 2) return null
    const cand: { seq: string[]; prefix: number; kind: 'A' | 'B' }[] = []
    for (const prefix of [[], ['U'], ["U'"], ['U2']]) {
      for (const s of ['M', "M'", 'S', "S'"]) cand.push({ seq: [...prefix, s, 'D2', inv(s)], prefix: prefix.length, kind: 'A' })
      for (const d of ['D', "D'"]) for (const s of ['M', "M'", 'S', "S'"]) cand.push({ seq: [...prefix, d, s, inv(d), inv(s)], prefix: prefix.length, kind: 'B' })
    }
    cand.sort((a, b) => a.seq.length - b.seq.length || a.prefix - b.prefix)
    const hit = cand.find((c) => okAfter(run(p, c.seq), piece))
    const why = (m: string, i: number, kind: 'A' | 'B', prefix: number): string => {
      const pos = i - prefix
      if (i < prefix) return `Xoay tầng trên để đưa cạnh ${pairName(piece)} về vị trí thích hợp: nó nằm ở phía trên, cạnh mặt tâm ${names[X]} (nơi nó sẽ được lắp xuống).`
      if (kind === 'A') {
        if (pos === 0) return `Mặt ${yellow} của cạnh đang hướng lên trên. Xoay lớp giữa (${m}) để kéo cạnh xuống tầng đáy.`
        if (pos === 1) return `Xoay đáy nửa vòng (D2) để cạnh nằm đúng chỗ dưới tâm ${names[X]}.`
        return `Trả lớp giữa về chỗ cũ (${m}) để các tâm và phần còn lại không bị xáo trộn; cạnh ở lại đúng vị trí và mặt ${yellow} hướng xuống.`
      }
      if (pos === 0) return `Xoay tầng đáy (${m}) sang một bên để chừa đường cho cạnh đi xuống mà không va vào các cạnh đã lắp.`
      if (pos === 1) return `Xoay lớp giữa (${m}) kéo cạnh xuống tầng đáy; việc này cũng lật nó để mặt ${yellow} hướng xuống.`
      if (pos === 2) return `Trả tầng đáy (${m}) về, các cạnh đã lắp quay lại chỗ của chúng.`
      return `Trả lớp giữa về chỗ cũ (${m}) để các tâm không bị lệch; cạnh ${pairName(piece)} đã vào đúng chỗ.`
    }
    if (hit) {
      const kind = hit.kind
      return hit.seq.map((m, i) => ({ notation: m, why: why(m, i, kind, hit.prefix) }))
    }
    // Fallback for the tight spots: the shortest few face turns that keep every placed edge.
    const from = toCubie(p)
    if (!from) return null
    const found = shortestSafe(from, piece, placed)
    if (!found) return null
    return found.map((m, i) => ({
      notation: m,
      why:
        i === found.length - 1
          ? `Xoay ${m}: cạnh ${pairName(piece)} vào đúng chỗ, mặt ${yellow} hướng xuống; các cạnh đã lắp vẫn đúng.`
          : i === 0
            ? `Xoay ${m} để mở đường cho cạnh ${pairName(piece)} xuống chỗ của nó mà không làm mất các cạnh đã lắp.`
            : `Xoay ${m} để đưa cạnh ${pairName(piece)} gần chỗ của nó hơn.`
    }))
  }

  const plans: Plan[] = []
  for (const piece of todo) {
    const X = TARGET[piece]!
    const ed = findEdge(start, 'D', X)!
    const { y } = ed.grid
    const cell = [ed.grid.x, y, ed.grid.z]
    if (y === 2) {
      const steps = insert(start, piece)
      if (steps) plans.push({ kind: 'top', piece, steps })
    } else if (y === 0) {
      const Y = facesAt(cell).find((f) => f !== 'D')!
      const lifted = run(start, [`${Y}2`])
      const rest = insert(lifted, piece)
      if (rest) {
        plans.push({
          kind: 'bottom',
          piece,
          steps: [
            { notation: `${Y}2`, why: `Cạnh ${pairName(piece)} đang ở tầng đáy nhưng chưa đúng chỗ hoặc bị ngược mặt. Xoay mặt ${Y} nửa vòng để đưa nó lên tầng trên mà không làm xáo các cạnh khác ở đáy, rồi lắp lại cho đúng.` },
            ...rest
          ]
        })
      }
    } else {
      const faces = facesAt(cell)
      let direct: string | null = null
      for (const Z of faces) {
        for (const q of [Z, `${Z}'`, `${Z}2`]) {
          if (!direct && okAfter(run(start, [q]), piece)) direct = q
        }
      }
      if (direct) {
        plans.push({
          kind: 'direct',
          piece,
          steps: [{ notation: direct, why: `Cạnh ${pairName(piece)} đang ở tầng giữa, đúng cạnh mặt cần lắp: chỉ cần một nước xoay mặt ${direct[0]} là nó rơi thẳng vào chỗ và đúng mặt ${yellow}.` }]
        })
      } else {
        let lift: string[] | null = null
        for (const Z of faces) {
          for (const a of [Z, `${Z}'`]) {
            for (const seq of [[a], [a, 'U', inv(a)], [a, "U'", inv(a)], [a, 'U2', inv(a)]]) {
              if (lift) continue
              const q = run(start, seq)
              const e2 = findEdge(q, 'D', X)
              if (e2 && e2.grid.y === 2 && placedIntact(q)) lift = seq
            }
          }
        }
        if (lift) {
          const lifted = run(start, lift)
          const rest = insert(lifted, piece)
          if (rest) {
            const protectedLift = lift.length > 1
            plans.push({
              kind: 'middle',
              piece,
              steps: [
                ...lift.map((m, i) => ({
                  notation: m,
                  why:
                    i === 0
                      ? `Cạnh ${pairName(piece)} đang ở tầng giữa và không thể xuống thẳng. Trước hết đưa nó lên tầng trên bằng cách xoay mặt ${m[0]}.${protectedLift ? ' Nước này cũng lôi theo một cạnh dấu cộng đã lắp, nên mình sẽ trả lại ngay sau đó.' : ''}`
                      : i === 1
                        ? 'Xoay tầng trên để cạnh vừa lên tránh khỏi mặt đang xoay, để nước trả lại không kéo nó xuống.'
                        : 'Trả mặt về chỗ cũ để cạnh dấu cộng đã lắp quay lại đúng vị trí.'
                })),
                ...rest
              ]
            })
          }
        }
      }
    }
  }
  if (!plans.length) return null
  plans.sort((a, b) => RANK[a.kind] - RANK[b.kind] || CROSS.indexOf(a.piece) - CROSS.indexOf(b.piece))
  const best = plans[0]!
  const plan = { ...best, steps: mergeSteps(best.steps) }

  const states: CubieState[] = []
  const halves: CubieState[][] = []
  const pieceCells: number[][] = []
  const centerCells: number[][] = []
  let p = start
  for (let i = 0; i <= plan.steps.length; i += 1) {
    const s = toCubie(p)
    if (!s) return null
    states.push(s)
    pieceCells.push(cellOf(p, plan.piece))
    centerCells.push(centerCell(p))
    if (i < plan.steps.length) {
      const n = plan.steps[i]!.notation
      halves.push(
        n.endsWith('2')
          ? [`${n[0]}`, `${n[0]}'`].map((q) => toCubie(applyNotation(p, q))).filter((x): x is CubieState => x !== null)
          : []
      )
      p = applyNotation(p, n)
    }
  }

  const intro: Record<CrossCase, string> = {
    direct: `Chọn cạnh ${pairName(plan.piece)}: nó dễ làm nhất vì chỉ cần một nước xoay.`,
    top: `Chọn cạnh ${pairName(plan.piece)}: nó đang nằm ở tầng trên, dễ thấy nhất. Mình đưa nó về đúng chỗ rồi hạ xuống đáy.`,
    bottom: `Chọn cạnh ${pairName(plan.piece)}: nó đã ở tầng đáy nhưng chưa đúng chỗ hoặc bị ngược mặt. Đưa lên rồi lắp lại cho đúng.`,
    middle: `Chọn cạnh ${pairName(plan.piece)}: nó nằm ở tầng giữa và phải qua hai bước: đưa lên tầng trên (giữ nguyên dấu cộng đang có), rồi hạ xuống đúng chỗ.`
  }
  return {
    piece: plan.piece,
    edge: EDGE_NAME[plan.piece]!,
    target: TARGET[plan.piece]!,
    kind: plan.kind,
    title: { direct: 'Một nước là xong', top: 'Cạnh ở tầng trên', bottom: 'Cạnh sai chỗ ở tầng đáy', middle: 'Cạnh ở tầng giữa' }[plan.kind],
    intro: intro[plan.kind],
    steps: plan.steps,
    states,
    halves,
    pieceCells,
    centerCells
  }
}
