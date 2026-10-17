import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { applyMoves } from '../../smart-solver/core/cubie'
import { edgeDone } from '../goals'
import { findEdge, fromCubie } from '../guide/physical'
import CrossPrincipleExamples, { CROSS_ALIGNMENT_MOVES, CROSS_SIDE_EXAMPLES, CROSS_MIDDLE_EXAMPLES, CROSS_LIFT_EXAMPLE } from './CrossPrincipleExamples'
import { CROSS_STORY_STATE, CROSS_STORY_MOVE } from './CrossMiddleStory'
const COLORS = { U: 0xffffff, R: 0xff0000, F: 0x00ff00, D: 0xffff00, L: 0xff8800, B: 0x0000ff }
it('continues the previous scene with the same white-blue edge and correct R/F′ comparison', () => {
  expect(CROSS_LIFT_EXAMPLE).toEqual(applyMoves(CROSS_STORY_STATE, [CROSS_STORY_MOVE]))
  const edge = findEdge(fromCubie(CROSS_LIFT_EXAMPLE), 'U', 'B')!
  expect(edge.grid).toEqual({ x: 2, y: 1, z: 2 })
  for (const move of ['R', "F'"] as const) {
    const after = findEdge(fromCubie(applyMoves(CROSS_LIFT_EXAMPLE, [move])), 'U', 'B')!
    expect(after.grid.y).toBe(2)
    expect(after.keyOf('U') === 'py').toBe(move === "F'")
  }
})
it('both illustrated turns lift the FR edge, but only one makes white face U in each orientation', () => {
  for (const { state, whiteFace } of CROSS_SIDE_EXAMPLES) {
    const edge = findEdge(fromCubie(state), 'U', 'F')!
    expect(edge.grid).toEqual({ x: 2, y: 1, z: 2 })
    expect(edge.keyOf('U')).toBe(whiteFace === 'F' ? 'pz' : 'px')
    const right = findEdge(fromCubie(applyMoves(state, ['R'])), 'U', 'F')!
    const front = findEdge(fromCubie(applyMoves(state, ["F'"])), 'U', 'F')!
    expect(right.grid.y).toBe(2); expect(front.grid.y).toBe(2)
    expect(right.keyOf('U') === 'py').toBe(whiteFace === 'F')
    expect(front.keyOf('U') === 'py').toBe(whiteFace === 'R')
  }
})
it('continues the same sample, aligns the white-blue edge and preserves the already correct edge', () => {
  const start = CROSS_LIFT_EXAMPLE
  const upWithoutSetup = applyMoves(start, ["F'"])
  expect(findEdge(fromCubie(upWithoutSetup), 'U', 'B')!.keyOf('U')).toBe('py')
  expect(edgeDone(upWithoutSetup, 3)).toBe(false)
  const after = applyMoves(start, CROSS_ALIGNMENT_MOVES)
  expect(edgeDone(after, 3)).toBe(true)
  expect(edgeDone(start, 1)).toBe(true)
  expect(edgeDone(after, 1)).toBe(true)
})
it('renders one comparison using the existing perspective 3D renderer with independent turn controls', () => {
  const html = renderToStaticMarkup(<CrossPrincipleExamples faceColors={COLORS} mode="lift" />)
  expect([...html.matchAll(/<canvas /g)]).toHaveLength(3)
  expect([...html.matchAll(/▶ R/g)]).toHaveLength(1)
  expect([...html.matchAll(/▶ F′/g)]).toHaveLength(1)
})

it('both animated middle examples finish at the same visible F/R middle edge', () => {
  for (const [i, example] of CROSS_MIDDLE_EXAMPLES.entries()) {
    const start = findEdge(fromCubie(example.state), 'U', 'F')!
    expect(start.grid.y).toBe(i === 0 ? 2 : 0)
    const end = findEdge(fromCubie(applyMoves(example.state, example.moves)), 'U', 'F')!
    expect(end.grid).toEqual({ x: 2, y: 1, z: 2 })
  }
  const html = renderToStaticMarkup(<CrossPrincipleExamples faceColors={COLORS} mode="middle" />)
  expect([...html.matchAll(/<canvas /g)]).toHaveLength(1)
  expect(html).toContain('Cạnh ở tầng trên U')
  expect(html).toContain('Cạnh ở tầng đáy D')
  expect(html).toContain('Xem xoay')
  expect(html).toContain('Về đầu')
})
