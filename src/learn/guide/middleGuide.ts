import { EDGE_COLORS } from '../../smart-solver/core/facelets'
import type { CubieState, Face } from '../../smart-solver/core/types'
import { MIDDLE, edgeDone, firstLayerDone } from '../goals'
import { mergeSteps, type ColorNames, type GuideStep } from './crossGuide'
import { ALG_VARIANTS, type AlgVariant } from './middleAlgs'
import { applyNotation, findEdge, fromCubie, toCubie, type Physical } from './physical'

/**
 * Step-by-step guide that puts ONE middle-layer edge in place (the first layer is already done).
 * There is a single formula (and its mirror); what changes is which side plays "front".
 *  - top: the edge is in the bottom layer (it has neither white nor yellow): turn the bottom until its front
 *    sticker sits on the matching center, then run the formula towards the side its top color names;
 *  - wrong: the edge is in the middle layer but in the wrong slot or flipped: run the formula once
 *    on its slot to push it up to the bottom layer, then as above.
 */
export type MiddleCase = 'top' | 'wrong'

export interface MiddleGuide {
  piece: number
  /** Which edge, e.g. "FR". */
  edge: string
  kind: MiddleCase
  title: string
  intro: string
  steps: GuideStep[]
  states: CubieState[]
  halves: CubieState[][]
  /** Per step: grid cells to light — the two centers the edge belongs between, and the edge. */
  marks: number[][][]
}

const EDGE_NAME: Record<number, string> = { 8: 'FR', 9: 'FL', 10: 'BL', 11: 'BR' }
const PREFIXES: string[][] = [[], ['D'], ["D'"], ['D2']]

const centerCell = (p: Physical, face: Face): number[] => {
  const c = p.find((cb) => {
    const colors = Object.values(cb.stickers).filter((v) => v != null)
    return colors.length === 1 && colors[0] === face
  })
  return c ? [c.grid.x, c.grid.y, c.grid.z] : [1, 1, 1]
}

export function buildMiddleGuide(state: CubieState, names: ColorNames): MiddleGuide | null {
  if (!firstLayerDone(state)) return null
  const todo = MIDDLE.filter((e) => !edgeDone(state, e))
  if (!todo.length) return null
  const placed = MIDDLE.filter((e) => edgeDone(state, e))
  const start = fromCubie(state)

  const faces = (piece: number) => EDGE_COLORS[piece]! as readonly [Face, Face]
  const pairName = (piece: number) => {
    const [a, b] = faces(piece)
    return `${names[a]}–${names[b]}`
  }
  const safe = (p: Physical) => {
    const s = toCubie(p)
    return !!s && firstLayerDone(s) && placed.every((e) => edgeDone(s, e))
  }
  const edgeAt = (p: Physical, piece: number) => {
    const [a, b] = faces(piece)
    return findEdge(p, a, b)!
  }

  /** What each move of the formula does, in order (the same for every side and for the mirror). */
  const roleText = (v: AlgVariant, i: number, piece: number, kick: boolean): string => {
    const sideWord = `mặt ${v.target}`
    const otherWord = 'đối diện rãnh cần lắp'
    const front = `${v.front} (${names[v.front as Face]})`
    const side = `${v.target} (${names[v.target as Face]})`
    const texts = [
      `Xoay tầng dưới để đưa cạnh sang phía ${otherWord}, tránh khỏi mặt ${side} sắp xoay.`,
      `Xoay mặt ${side} để kéo góc của tầng đầu xuống và mở rãnh giữa mặt ${front} và ${side}. Các khối ở mặt này đi theo tạm thời.`,
      'Xoay tầng dưới trở lại: cạnh về phía mặt mốc, còn góc vừa hạ xuống bị đẩy sang một bên.',
      `Trả mặt ${side} về: góc của tầng đầu được đặt lại ngay cạnh khối cạnh, hai khối đứng cạnh nhau thành một cặp.`,
      `Xoay tầng dưới để đưa cặp này sang phía ${sideWord}, nhường chỗ cho mặt mốc xoay mà không va vào cặp.`,
      `Xoay mặt mốc ${front} để mở chỗ trống của tầng giữa: các khối tầng đầu của mặt này đi xuống tạm thời.`,
      'Xoay tầng dưới đưa cặp về đúng phía dưới chỗ trống vừa mở.',
      `Trả mặt mốc ${front} về: cặp trượt lên cùng lúc, cạnh vào rãnh giữa ${front} và ${side}, góc về lại tầng đầu.`
    ]
    const base = texts[i]!
    if (kick && i === 0) {
      return `Cạnh ${pairName(piece)} đang ở tầng giữa nhưng sai chỗ hoặc bị ngược. Dùng chính công thức này ở rãnh đó để đẩy nó xuống tầng dưới. ${base}`
    }
    return base
  }

  /** The formula (with an optional top turn before it) that satisfies `ok`, shortest first. */
  const find = (p: Physical, ok: (q: Physical) => boolean) => {
    const cand: { v: AlgVariant; prefix: string[] }[] = []
    for (const prefix of PREFIXES) for (const v of ALG_VARIANTS) cand.push({ v, prefix })
    cand.sort((a, b) => a.prefix.length - b.prefix.length)
    for (const c of cand) {
      if (ok([...c.prefix, ...c.v.seq].reduce(applyNotation, p))) return c
    }
    return null
  }

  const describe = (c: { v: AlgVariant; prefix: string[] }, piece: number, kick: boolean): GuideStep[] => [
    ...c.prefix.map((m) => ({
      notation: m,
      why: `Xoay tầng dưới cho màu ở mặt mốc của cạnh ${pairName(piece)} khớp với tâm mặt đó: cạnh phải đứng ngay trước tâm ${names[c.v.front as Face]}.`
    })),
    ...c.v.seq.map((m, i) => ({ notation: m, why: roleText(c.v, i, piece, kick) }))
  ]

  const plans: { kind: MiddleCase; piece: number; steps: GuideStep[] }[] = []
  for (const piece of todo) {
    const ed = edgeAt(start, piece)
    if (ed.grid.y === 0) {
      const hit = find(start, (q) => edgeDone(toCubie(q) ?? state, piece) && safe(q))
      if (hit) plans.push({ kind: 'top', piece, steps: describe(hit, piece, false) })
    } else if (ed.grid.y === 1) {
      const kick = find(start, (q) => edgeAt(q, piece).grid.y === 0 && safe(q))
      if (!kick || kick.prefix.length) continue
      const lifted = kick.v.seq.reduce(applyNotation, start)
      const hit = find(lifted, (q) => edgeDone(toCubie(q) ?? state, piece) && safe(q))
      if (hit) plans.push({ kind: 'wrong', piece, steps: [...describe(kick, piece, true), ...describe(hit, piece, false)] })
    }
  }
  if (!plans.length) return null
  plans.sort((a, b) => (a.kind === b.kind ? MIDDLE.indexOf(a.piece) - MIDDLE.indexOf(b.piece) : a.kind === 'top' ? -1 : 1))
  const best = plans[0]!
  const steps = mergeSteps(best.steps)

  const states: CubieState[] = []
  const halves: CubieState[][] = []
  const marks: number[][][] = []
  let p = start
  const [fa, fb] = faces(best.piece)
  for (let i = 0; i <= steps.length; i += 1) {
    const s = toCubie(p)
    if (!s) return null
    states.push(s)
    const ed = edgeAt(p, best.piece)
    marks.push([centerCell(p, fa), centerCell(p, fb), [ed.grid.x, ed.grid.y, ed.grid.z]])
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
  return {
    piece: best.piece,
    edge: EDGE_NAME[best.piece]!,
    kind: best.kind,
    title: best.kind === 'top' ? 'Cạnh ở tầng dưới' : 'Cạnh sai chỗ ở tầng giữa',
    intro:
      best.kind === 'top'
        ? `Chọn cạnh ${name}: nó đang ở tầng dưới (cạnh nào không có màu ${names.U} hay ${names.D} là cạnh của tầng giữa). Mình xoay tầng dưới cho khớp màu, rồi dùng công thức trượt nó lên đúng rãnh.`
        : `Chọn cạnh ${name}: nó đã ở tầng giữa nhưng sai chỗ hoặc bị ngược. Mình dùng chính công thức để đẩy nó xuống tầng dưới, rồi lắp lại cho đúng.`,
    steps,
    states,
    halves,
    marks
  }
}
