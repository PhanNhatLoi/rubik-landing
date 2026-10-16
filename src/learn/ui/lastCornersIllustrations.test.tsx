import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { applyMoves, SOLVED } from '../../smart-solver/core/cubie'
import { LAST_CORNERS_VARIANTS, correctLastCorners } from '../guide/lastCornersGuide'
import { LAST_CORNERS_COMBINATIONS } from '../copy/lesson7'
import LastCornersDiagram from './LastCornersDiagram'
import LastCornersCases from './LastCornersCases'

const COLORS = { U: 0xffffff, R: 0xff0000, F: 0x00ff00, D: 0xffff00, L: 0xff8800, B: 0x0000ff }
const NAMES = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }
const SLOT: Record<string, number> = { FR: 4, FL: 5, BL: 6, BR: 7 }

it('renders all three stickers of each corner and marks position independently of twist', () => {
  const state = { ...SOLVED, co: [0, 0, 0, 0, 1, 2, 0, 0] }
  const html = renderToStaticMarkup(<LastCornersDiagram state={state} faceColors={COLORS} colorNames={NAMES} label="Góc đúng chỗ, chưa đúng hướng" />)
  expect([...html.matchAll(/<polygon /g)]).toHaveLength(12)
  expect([...html.matchAll(/data-position-correct="true"/g)]).toHaveLength(4)
  expect([...html.matchAll(/fill="#ffff00"/g)].length).toBeGreaterThanOrEqual(5)
  expect(html).toContain('đúng vị trí dù có thể chưa đúng hướng')
})

it('shows three arrows matching each actual corner cycle and leaves the anchor out of the arrows', () => {
  for (const variant of LAST_CORNERS_VARIANTS) {
    const html = renderToStaticMarkup(<LastCornersDiagram state={SOLVED} faceColors={COLORS} colorNames={NAMES} variant={variant} label="Vòng góc" />)
    const arrows = [...html.matchAll(/data-from-corner="(FR|FL|BL|BR)" data-to-corner="(FR|FL|BL|BR)"/g)]
    expect(arrows).toHaveLength(3)
    const end = applyMoves(SOLVED, variant.moves)
    for (const [, from, to] of arrows) {
      expect(SLOT[from!]).not.toBe(variant.anchor)
      expect(SLOT[to!]).not.toBe(variant.anchor)
      expect(end.cp[SLOT[to!]!]).toBe(SLOT[from!]!)
    }
  }
})

it('keeps all three cases and follows the selected preparation frame in the illustration', () => {
  const index = LAST_CORNERS_COMBINATIONS.findIndex((c) => correctLastCorners(c.state).length === 0)
  const variant = LAST_CORNERS_VARIANTS.find((v) => v.front === 'B' && v.side === 'left')!
  const html = renderToStaticMarkup(<LastCornersCases faceColors={COLORS} colorNames={NAMES} combination={index} frames={{ 1: variant.id }} onCombinationChange={() => {}} onVariantChange={() => {}} />)
  for (const label of ['4 góc đúng', '1 góc đúng', '0 góc đúng']) expect(html).toContain(label)
  expect(html).toContain(variant.moves.join(' ').replaceAll("'", '′'))
  expect(html).toContain('Lượt 2:')
  expect(html).toContain('có hai màu thuộc vị trí hiện tại')
})
