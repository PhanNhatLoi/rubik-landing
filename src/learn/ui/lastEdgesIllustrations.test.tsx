import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LAST_EDGES_FORMULA_PICTURES, LAST_EDGES_ORDER_CASES } from '../copy/lesson6'
import LastEdgesDiagram from './LastEdgesDiagram'
import LastEdgesFormulaExample from './LastEdgesFormulaExample'
import LastEdgesOrderCases from './LastEdgesOrderCases'
import { applyMoves, SOLVED } from '../../smart-solver/core/cubie'
import { LAST_EDGES_VARIANTS } from '../guide/lastEdgesGuide'
import { lastEdgesOrderChoices } from '../guide/lastEdgesOrder'

const COLORS = { U: 0xffffff, R: 0xff0000, F: 0x00ff00, D: 0xffff00, L: 0xff8800, B: 0x0000ff }
const NAMES = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }
const palette = new Set(Object.values(COLORS).map((v) => `#${v.toString(16).padStart(6, '0')}`))
const coloredStickers = (html: string) => [...html.matchAll(/fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]!).filter((color) => palette.has(color))

it('keeps four last-edge colors and the yellow D center, with all other stickers gray', () => {
  const state = LAST_EDGES_FORMULA_PICTURES[0]!.before
  const allEdges = renderToStaticMarkup(<LastEdgesDiagram state={state} faceColors={COLORS} colorNames={NAMES} label="Bốn cạnh" />)
  expect(coloredStickers(allEdges).sort()).toEqual(['#ffff00', '#00ff00', '#ff0000', '#0000ff', '#ff8800'].sort())

})

it('keeps all four colored edges before and after both formula illustrations', () => {
  for (const example of LAST_EDGES_FORMULA_PICTURES) {
    const html = renderToStaticMarkup(<LastEdgesFormulaExample example={example} faceColors={COLORS} colorNames={NAMES} />)
    const colors = coloredStickers(html)
    expect(colors).toHaveLength(10)
    expect(colors.slice(0, 5).sort()).toEqual(['#ffff00', '#00ff00', '#ff0000', '#0000ff', '#ff8800'].sort())
    expect(colors.slice(5).sort()).toEqual(colors.slice(0, 5).sort())
  }
})

it('moves the arrow cycle with the selected anchor and matches the actual formula on all four fronts', () => {
  const slots: Record<string, number> = { F: 5, R: 4, B: 7, L: 6 }
  for (const v of LAST_EDGES_VARIANTS) {
    const html = renderToStaticMarkup(<LastEdgesDiagram state={SOLVED} faceColors={COLORS} colorNames={NAMES} label="Chiều đổi cạnh" anchor={v.front} direction={v.direction} />)
    const arrows = [...html.matchAll(/data-from="([FRBL])" data-to="([FRBL])"/g)]
    expect(arrows).toHaveLength(3)
    const after = applyMoves(SOLVED, v.moves)
    for (const [, from, to] of arrows) {
      expect(from).not.toBe(v.front)
      expect(to).not.toBe(v.front)
      expect(after.ep[slots[to!]!]).toBe(slots[from!]!)
    }
  }
})

it('lists only the five combinations that need a formula and opens on the first of them', () => {
  const html = renderToStaticMarkup(<LastEdgesOrderCases faceColors={COLORS} colorNames={NAMES} />)
  expect([...html.matchAll(/Tổ hợp [1-5] ·/g)]).toHaveLength(5)
  expect(html).not.toContain('Tổ hợp 6')
  expect(LAST_EDGES_ORDER_CASES[0]!.rounds).toBe(0)
  expect(html).toContain('Tổ hợp 1: đọc theo vòng')
  expect(html).toContain('data-from=')
})

it('renders the selected combination and frame supplied by the lesson for practice', () => {
  const index = LAST_EDGES_ORDER_CASES.findIndex((c) => c.rounds === 1)
  const c = LAST_EDGES_ORDER_CASES[index]!
  for (const v of lastEdgesOrderChoices(c.state)) {
    const html = renderToStaticMarkup(<LastEdgesOrderCases faceColors={COLORS} colorNames={NAMES} selectedCaseIndex={index} selectedFrames={{ 1: v.front }} />)
    expect(html).toContain(`Tổ hợp ${index}:`)
    expect(html).toContain(v.moves.join(' ').replaceAll("'", '′'))
    const arrows = [...html.matchAll(/data-from="([FRBL])" data-to="([FRBL])"/g)]
    expect(arrows).toHaveLength(3)
    for (const [, from, to] of arrows) {
      expect(from).not.toBe(v.front)
      expect(to).not.toBe(v.front)
    }
  }
})
