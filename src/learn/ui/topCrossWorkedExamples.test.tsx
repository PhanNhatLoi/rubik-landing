import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { applyMoves, equals, parseAlgorithm } from '../../smart-solver/core/cubie'
import { f2lDone, topCrossDone } from '../goals'
import { getTopCrossExamples } from '../copy/topCrossExamples'
import { TOP_CROSS_ALG, TOP_CROSS_L_ALG, topCrossPattern } from '../guide/topCrossGuide'
import TopCrossWorkedExamples from './TopCrossWorkedExamples'

const names = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }
const colors = { U: 0xffffff, R: 0xff0000, F: 0x00ff00, D: 0xffff00, L: 0xff8800, B: 0x0000ff }
it.each(['single', 'dual'] as const)('the %s method examples demonstrate opposite edges and dot using the selected formulas', (method) => {
  const examples = getTopCrossExamples(method, names)
  expect(examples.map((example) => topCrossPattern(example.before))).toEqual(['line', 'dot'])
  expect(examples.map((example) => example.rounds.length)).toEqual([method === 'single' ? 2 : 1, 2])
  expect([4, 6].every((slot) => examples[0]!.before.eo[slot] === 0)).toBe(true)
  for (const example of examples) {
    expect(f2lDone(example.before)).toBe(true)
    for (const round of example.rounds) {
      const algorithm = method === 'dual' && round.kind === 'line' ? TOP_CROSS_ALG : TOP_CROSS_L_ALG
      expect(round.steps.slice(-algorithm.length).map((step) => step.notation)).toEqual(algorithm)
      expect(f2lDone(round.states.at(-1)!)).toBe(true)
    }
    expect(equals(applyMoves(example.before, parseAlgorithm(example.moves.join(' '))), example.after)).toBe(true)
    expect(topCrossDone(example.after)).toBe(true)
  }
  const html = renderToStaticMarkup(<TopCrossWorkedExamples method={method} faceColors={colors} colorNames={names} />)
  expect(html).toContain('Ví dụ: hai cạnh đối')
  expect(html).toContain('Ví dụ: chấm')
  expect([...html.matchAll(/aria-label="Chạy thử:/g)]).toHaveLength(2)
  expect(html).toContain(method === 'dual' ? 'Hai cạnh đối → Dấu cộng · 1 lượt' : 'Hai cạnh đối → Chữ L → Dấu cộng · 2 lượt')
  expect(html).toContain('Không cần căn D, lặp lại công thức:')
})
