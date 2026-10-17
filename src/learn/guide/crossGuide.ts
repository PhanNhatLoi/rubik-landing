import { applyMoves } from '../../smart-solver/core/cubie'
import type { CubieState, Face, Move } from '../../smart-solver/core/types'
import { CROSS, edgeDone } from '../goals'
import { applyNotation, findEdge, fromCubie, toCubie, type Physical } from './physical'

/**
 * Step-by-step guide that puts ONE cross edge in place, in the order a learner can follow:
 * pick the edge that is easiest to see, then branch on where it is. Every step says why.
 * The first-layer face (U) is the one being built; the cube is assumed to have its centers at home.
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
  /** State index after bringing the edge to the middle, before U alignment. */
  middleIndex: number
  title: string
  /** Why this edge, and what the plan is. */
  intro: string
  steps: GuideStep[]
  /** Center-relative cube after 0, 1, … steps (what the app tracks while the learner turns). */
  states: CubieState[]
  /** For each step: the cube after turning only a quarter of a half-turn step either way (empty for other steps). */
  halves: CubieState[][]
  /** Grid cell of the edge before each step, and of the U center (the face being built). */
  pieceCells: number[][]
  centerCells: number[][]
}

export type ColorNames = Record<Face, string>

const TARGET: Record<number, Face> = { 0: 'R', 1: 'F', 2: 'L', 3: 'B' }
const EDGE_NAME: Record<number, string> = { 0: 'UR', 1: 'UF', 2: 'UL', 3: 'UB' }
const RANK: Record<CrossCase, number> = { direct: 0, middle: 1, top: 2, bottom: 3 }

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
const cellOf = (p: Physical, e: number) => {
  const t = TARGET[e]!
  const ed = findEdge(p, 'U', t)!
  return [ed.grid.x, ed.grid.y, ed.grid.z]
}
const centerCell = (p: Physical) => {
  const c = p.find((cb) => {
    const colors = Object.values(cb.stickers).filter((v) => v != null)
    return colors.length === 1 && colors[0] === 'U'
  })
  return c ? [c.grid.x, c.grid.y, c.grid.z] : [1, 2, 1]
}

/** Every unsolved edge follows the same route: middle → align U → lift → restore U. */
const U_SETUPS: string[][] = [[], ['U'], ["U'"], ['U2']]
const D_SETUPS: string[][] = [[], ['D'], ["D'"], ['D2']]
const SIDE_QUARTERS = ['R', "R'", 'F', "F'", 'L', "L'", 'B', "B'"]
interface Plan { kind: CrossCase; piece: number; steps: GuideStep[]; middleIndex: number }

export function buildCrossGuide(state: CubieState, names: ColorNames): CrossGuide | null {
  const start = fromCubie(state)
  const placed = CROSS.filter((e) => edgeDone(state, e))
  const todo = CROSS.filter((e) => !edgeDone(state, e))
  if (!todo.length) return null
  const pairName = (piece: number) => `${names.U}–${names[TARGET[piece]!]}`
  const safe = (s: CubieState) => placed.every((e) => edgeDone(s, e))
  const atMiddle = (s: CubieState, piece: number) => s.ep.indexOf(piece) >= 8
  const moved = (s: CubieState, seq: string[]) => applyMoves(s, seq as Move[])
  const reverse = (moves: string[]) => moves.slice().reverse().map(inv)
  const plans: Plan[] = []
  for (const piece of todo) {
    const name = pairName(piece)
    const layer = findEdge(start, 'U', TARGET[piece]!)!.grid.y
    const preparations: GuideStep[][] = []
    if (layer === 1) preparations.push([])
    else if (layer === 2) {
      for (const m of SIDE_QUARTERS) {
        const p = moved(state, [m])
        if (atMiddle(p, piece) && safe(p)) preparations.push([{ notation: m, why: `Cạnh ${name} đang ở tầng trên nhưng chưa đúng. Xoay ${m} để đưa nó về tầng giữa; các cạnh dấu cộng đã đúng được giữ nguyên.` }])
      }
    } else {
      for (const d of D_SETUPS) for (const u of U_SETUPS) for (const m of SIDE_QUARTERS) {
        const seq = [...d, ...u, m, ...reverse(u)]
        const p = moved(state, seq)
        if (!atMiddle(p, piece) || !safe(p)) continue
        preparations.push([
          ...d.map((notation) => ({ notation, why: `Xoay ${notation} để đưa cạnh ${name} ở đáy tới mặt bên sẽ dùng để đưa nó về tầng giữa.` })),
          ...u.map((notation) => ({ notation, why: `Tạm xoay ${notation} để chừa một ô cạnh chưa đúng trên U ở mặt sắp xoay, tránh kéo một cạnh đã lắp xuống.` })),
          { notation: m, why: `Xoay ${m} để đưa cạnh ${name} từ tầng đáy về tầng giữa, nơi cạnh tiếp giáp hai mặt bên.` },
          ...reverse(u).map((notation) => ({ notation, why: `Trả U bằng ${notation}: các cạnh đã lắp về chỗ cũ, cạnh ${name} vẫn ở tầng giữa.` }))
        ])
      }
    }
    // Preparation restores the existing cross before insertion; no slice/solver fallback.
    preparations.sort((a, b) => a.length - b.length)
    preparationLoop: for (const preparation of preparations) {
      const middle = moved(state, preparation.map((s) => s.notation))
      for (const u of U_SETUPS) for (const m of SIDE_QUARTERS) {
        const sequence = [...u, m, ...reverse(u)]
        const end = moved(middle, sequence)
        if (!edgeDone(end, piece) || !safe(end)) continue
        const steps = [...preparation,
          ...u.map((notation) => ({ notation, why: `Cạnh ${name} sẽ đi lên qua mặt ${m[0]}. Tạm xoay ${notation} để đưa ô đích trên U tới đúng đường đi này. Sau khi đưa cạnh lên sẽ trả U lại.` })),
          { notation: m, why: `Xoay ${m} để đưa cạnh ${name} từ tầng giữa lên U với màu ${names.U} hướng lên.${u.length ? ' Tiếp theo trả U để cạnh về đúng vị trí theo tâm.' : ' Màu bên hông đã khớp tâm, cạnh vào đúng vị trí.'}` },
          ...reverse(u).map((notation) => ({ notation, why: `Trả U bằng ${notation}: cạnh ${name} về đúng vị trí cạnh tâm ${names[TARGET[piece]!]}, các cạnh đã lắp cũng trở về đúng chỗ.` }))
        ]
        const kind: CrossCase = layer === 1 ? steps.length === 1 ? 'direct' : 'middle' : layer === 0 ? 'top' : 'bottom'
        plans.push({ kind, piece, steps, middleIndex: preparation.length })
        break preparationLoop
      }
    }
  }
  plans.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.steps.length - b.steps.length || CROSS.indexOf(a.piece) - CROSS.indexOf(b.piece))
  const plan = plans[0]
  if (!plan) return null
  const states: CubieState[] = [], halves: CubieState[][] = [], pieceCells: number[][] = [], centerCells: number[][] = []
  let p = start
  for (let i = 0; i <= plan.steps.length; i++) {
    const s = toCubie(p)
    if (!s) return null
    states.push(s); pieceCells.push(cellOf(p, plan.piece)); centerCells.push(centerCell(p))
    if (i < plan.steps.length) {
      const n = plan.steps[i]!.notation
      halves.push(n.endsWith('2') ? [n[0]!, `${n[0]}'`].map((q) => toCubie(applyNotation(p, q))).filter((x): x is CubieState => x !== null) : [])
      p = applyNotation(p, n)
    }
  }
  const intro = plan.middleIndex === 0
    ? `Chọn cạnh ${pairName(plan.piece)}: nó đã ở tầng giữa. Chọn mặt đưa màu ${names.U} lên trên, căn ô đích bằng U nếu cần, đưa cạnh lên rồi trả U.`
    : `Chọn cạnh ${pairName(plan.piece)}. Đưa nó về tầng giữa trước, sau đó căn U, đưa cạnh lên đúng mặt và trả U để đúng vị trí. Các cạnh đã đúng được giữ sau mỗi giai đoạn.`
  return { piece: plan.piece, edge: EDGE_NAME[plan.piece]!, target: TARGET[plan.piece]!, kind: plan.kind,
    title: plan.middleIndex === 0 ? 'Từ tầng giữa: căn U rồi đưa cạnh lên' : 'Đưa về tầng giữa rồi lắp lên U',
    intro, steps: plan.steps, states, halves, pieceCells, centerCells, middleIndex: plan.middleIndex }
}
