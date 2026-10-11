import { describe, expect, it } from 'vitest'
import { rgbToLab } from '../vision/color'
import {
  STANDARD_SCHEME,
  buildScheme,
  cleanColor,
  duplicateColors,
  learnScheme,
  previewFace,
  wrongCenter,
  type MeasuredCenter
} from './palette'

const lab = (rgb: [number, number, number]) => rgbToLab(rgb)
const measured = (rgb: [number, number, number]): MeasuredCenter => ({ lab: rgbToLab(rgb), rgb })

describe('buildScheme', () => {
  it('builds the presets with Vietnamese names', () => {
    expect(STANDARD_SCHEME.U.label).toBe('trắng')
    expect(STANDARD_SCHEME.L.label).toBe('cam')
    const jp = buildScheme({ preset: 'japanese', custom: { U: '', R: '', F: '', D: '', L: '', B: '' } })
    expect(jp.D.label).toBe('xanh dương')
    expect(jp.B.label).toBe('vàng')
  })

  it('uses custom colors, naming free picks by their hex', () => {
    const s = buildScheme({ preset: 'custom', custom: { U: '#f4f4f4', R: '#ff4b3e', F: '#16c172', D: '#f4c430', L: '#9b5de5', B: '#123456' } })
    expect(s.L.label).toBe('tím')
    expect(s.B.label).toBe('màu #123456')
  })

  it('flags faces sharing a color', () => {
    expect(duplicateColors({ U: '#f4f4f4', R: '#ff4b3e', F: '#16c172', D: '#f4c430', L: '#ff4b3e', B: '#2a6cff' })).toEqual(['R', 'L'])
  })
})

describe('learnScheme', () => {
  it('keeps the palette for ordinary webcam shades', () => {
    const r = learnScheme(STANDARD_SCHEME, { L: measured([240, 80, 35]), U: measured([240, 232, 205]), D: measured([230, 200, 60]) })
    expect(r.learned).toEqual([])
  })

  it('adopts a clearly different center (purple instead of orange)', () => {
    const r = learnScheme(STANDARD_SCHEME, { L: measured([120, 60, 170]) })
    expect(r.learned).toEqual(['L'])
    expect(r.scheme.L.label).toBe('tím')
    expect(r.scheme.L.css).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('cleanColor saturates colors and keeps greys grey', () => {
    expect(cleanColor([120, 60, 170])).not.toBe('#7a3caa')
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(cleanColor([240, 240, 235]).slice(i, i + 2), 16)) as [number, number, number]
    expect(Math.min(r, g, b)).toBeGreaterThan(225)
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(10)
  })
})

describe('previewFace', () => {
  it('prefers scanned centers over the scheme reference', () => {
    const centers = { R: lab([220, 40, 40]), L: lab([240, 80, 35]) }
    expect(previewFace(lab([238, 78, 36]), centers, STANDARD_SCHEME)).toBe('L')
    expect(previewFace(lab([222, 42, 40]), centers, STANDARD_SCHEME)).toBe('R')
    expect(previewFace(lab([30, 75, 195]), centers, STANDARD_SCHEME)).toBe('B')
  })
})

describe('wrongCenter', () => {
  it('accepts the expected center, even a webcam orange once red is scanned', () => {
    expect(wrongCenter(lab([30, 160, 80]), 'F', [])).toBeNull()
    expect(wrongCenter(lab([240, 80, 35]), 'L', ['F', 'R', 'B'])).toBeNull()
  })

  it('flags a clearly different face', () => {
    expect(wrongCenter(lab([30, 75, 195]), 'F', [])).toBe('B')
    expect(wrongCenter(lab([245, 205, 40]), 'L', ['F', 'R', 'B'])).toBe('D')
    expect(wrongCenter(lab([235, 235, 230]), 'D', ['F', 'R', 'B', 'L'])).toBe('U')
  })

  it('follows the chosen scheme', () => {
    const jp = buildScheme({ preset: 'japanese', custom: { U: '', R: '', F: '', D: '', L: '', B: '' } })
    // In the Japanese scheme the back face is yellow: a yellow center at the green step is the back face.
    expect(wrongCenter(lab([245, 205, 40]), 'F', [], jp)).toBe('B')
  })

  it('accepts a center that looks like no face, so an unusual color can be learned', () => {
    // Purple where the standard scheme expects orange.
    expect(wrongCenter(lab([120, 60, 170]), 'L', ['F', 'R', 'B'])).toBeNull()
  })
})
