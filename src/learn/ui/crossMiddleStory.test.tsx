import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { applyMoves } from '../../smart-solver/core/cubie'
import { toFacelets, fromFacelets } from '../../smart-solver/core/facelets'
import { CROSS, edgeDone } from '../goals'
import { edgeCell } from '../cells'
import CrossMiddleStory, { CROSS_STORY_MOVE, CROSS_STORY_STATE, CROSS_STORY_CUES, crossStoryFocus } from './CrossMiddleStory'

it('keeps the cube dimmed across all three wrong edges, restores it, then holds focus throughout the turn', () => {
  const { correctAt, wrongAt, moveStart, focusAt, turnAt } = CROSS_STORY_CUES
  const beats = [0, 1000, 2000].map((offset) => crossStoryFocus(wrongAt + offset))
  expect(beats.map(({ piece }) => edgeCell(CROSS_STORY_STATE.ep.indexOf(piece))[1])).toEqual([2, 0, 1])
  expect(new Set(beats.map(({ pulse }) => pulse)).size).toBe(3)
  for (const offset of [0, 1000, 2000]) {
    expect(crossStoryFocus(wrongAt + offset + 999).piece).toBe(crossStoryFocus(wrongAt + offset).piece)
    expect(crossStoryFocus(wrongAt + offset).active).toBe(true)
    expect(crossStoryFocus(wrongAt + offset + 999).active).toBe(true)
  }
  expect(crossStoryFocus(correctAt + 1000).active).toBe(false)
  expect(crossStoryFocus(moveStart).active).toBe(false)
  expect(crossStoryFocus(focusAt - 1).active).toBe(false)
  expect(crossStoryFocus(focusAt)).toEqual({ piece: 3, pulse: 'focus', active: true })
  expect(crossStoryFocus(turnAt)).toEqual({ piece: 3, pulse: null, active: true })
  expect(crossStoryFocus(turnAt + 1299).active).toBe(true)
  expect(crossStoryFocus(turnAt + 1300).active).toBe(false)
  expect(crossStoryFocus(Infinity).active).toBe(false)
})

it('uses a valid cube with one correct edge and three wrong edges at U, D and the middle', () => {
  const state = CROSS_STORY_STATE
  expect(fromFacelets(toFacelets(state)).ok).toBe(true)
  expect(CROSS.filter((p) => edgeDone(state, p))).toEqual([1])
  const wrong = CROSS.filter((p) => !edgeDone(state, p))
  expect(wrong.map((p) => edgeCell(state.ep.indexOf(p))[1]).sort()).toEqual([0, 1, 2])
  expect(state.eo[state.ep.indexOf(3)]).toBe(1)
  const after = applyMoves(state, [CROSS_STORY_MOVE])
  expect(edgeCell(after.ep.indexOf(3))[1]).toBe(1)
  expect(edgeDone(after, 1)).toBe(true)
})

it('keeps every explanation with the final cube when no first-view narration is running', () => {
  const html = renderToStaticMarkup(<CrossMiddleStory faceColors={{ U: 0xffffff, R: 0xff0000, F: 0x00ff00, D: 0xffff00, L: 0xff8800, B: 0x0000ff }} />)
  expect(html).toContain('Đã đưa cạnh về hàng giữa.')
  expect(html).toContain('Cạnh đang đúng:')
  expect(html).toContain('Cạnh đang sai:')
  expect(html).toContain('Đưa về hàng giữa:')
  expect(html.indexOf('Cạnh đang đúng:')).toBeLessThan(html.indexOf('Cạnh đang sai:'))
  expect(html.indexOf('Cạnh đang sai:')).toBeLessThan(html.indexOf('Đưa về hàng giữa:'))
  expect([...html.matchAll(/<canvas /g)]).toHaveLength(1)
})
