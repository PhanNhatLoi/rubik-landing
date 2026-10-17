import { applyMoves, SOLVED } from '../../smart-solver/core/cubie'
import type { Face } from '../../smart-solver/core/types'
import { generateTopCrossScramble, type TopCrossLevelId } from './lesson5'
import { buildTopCrossGuide, type TopCrossGuide, type TopCrossMethod } from '../guide/topCrossGuide'
import { topCrossDone } from '../goals'

/** Fixed, ready-aligned samples; every round uses the same guide as practice. */
export function getTopCrossExamples(method: TopCrossMethod, names: Record<Face, string>) {
  return (['easy', 'hard'] as TopCrossLevelId[]).map((level) => {
    let state = applyMoves(SOLVED, generateTopCrossScramble(level, () => 0))
    const first = buildTopCrossGuide(state, names, method)!
    const alignmentCount = first.steps.length - first.formula.split(/\s+/).length
    state = first.states[alignmentCount]!
    const before = state
    const rounds: TopCrossGuide[] = []
    while (!topCrossDone(state) && rounds.length < 2) {
      const round = buildTopCrossGuide(state, names, method)
      if (!round) throw new Error('Không tạo được ví dụ dấu cộng tầng đáy')
      rounds.push(round)
      state = round.states.at(-1)!
    }
    if (!topCrossDone(state)) throw new Error('Ví dụ dấu cộng chưa hoàn thành sau hai lượt')
    return { level, before, after: state, rounds, moves: rounds.flatMap((round) => round.steps.map((step) => step.notation)) }
  })
}
