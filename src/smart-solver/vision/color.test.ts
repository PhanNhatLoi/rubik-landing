import { describe, expect, it } from 'vitest'
import { deltaE2000, medianLab, rgbToLab, type Lab } from './color'

describe('rgbToLab', () => {
  it('maps reference sRGB colors', () => {
    const white = rgbToLab([255, 255, 255])
    expect(white[0]).toBeCloseTo(100, 1)
    expect(Math.abs(white[1])).toBeLessThan(0.05)
    expect(Math.abs(white[2])).toBeLessThan(0.05)
    const red = rgbToLab([255, 0, 0])
    expect(red[0]).toBeCloseTo(53.24, 1)
    expect(red[1]).toBeCloseTo(80.09, 1)
    expect(red[2]).toBeCloseTo(67.2, 1)
    expect(rgbToLab([0, 0, 0])).toEqual([0, 0, 0])
  })
})

describe('deltaE2000', () => {
  // Test pairs from Sharma, Wu, Dalal (2005), table 1.
  const pairs: [Lab, Lab, number][] = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
    [[50, 2.5, 0], [73, 25, -18], 27.1492]
  ]
  it.each(pairs)('%j vs %j = %d', (a, b, expected) => {
    expect(deltaE2000(a, b)).toBeCloseTo(expected, 3)
    expect(deltaE2000(b, a)).toBeCloseTo(expected, 3)
  })

  it('kL reduces the weight of lightness differences', () => {
    const a: Lab = [40, 50, 30]
    const b: Lab = [70, 50, 30]
    expect(deltaE2000(a, b, 2)).toBeCloseTo(deltaE2000(a, b) / 2, 6)
  })
})

describe('medianLab', () => {
  it('ignores a single outlier', () => {
    expect(medianLab([[50, 10, 10], [52, 11, 9], [99, 0, 0]])).toEqual([52, 10, 9])
  })
})
