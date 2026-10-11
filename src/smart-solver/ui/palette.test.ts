import { describe, expect, it } from 'vitest'
import { rgbToLab } from '../vision/color'
import { nameCenters, previewColor } from './palette'

describe('nameCenters', () => {
  it('names webcam centers, keeping red and orange distinct', () => {
    const names = nameCenters({
      U: rgbToLab([250, 245, 225]), // ivory white
      D: rgbToLab([230, 230, 60]), // pale yellow
      F: rgbToLab([20, 140, 90]),
      B: rgbToLab([20, 60, 160]),
      R: rgbToLab([220, 40, 40]),
      L: rgbToLab([240, 80, 35]) // orange that reads close to red
    })
    expect(names).toEqual({ U: 'white', D: 'yellow', F: 'green', B: 'blue', R: 'red', L: 'orange' })
  })

  it('works with only some centers scanned', () => {
    expect(nameCenters({ F: rgbToLab([20, 140, 90]), R: rgbToLab([220, 40, 40]) })).toEqual({ F: 'green', R: 'red' })
    expect(nameCenters({})).toEqual({})
  })
})

describe('previewColor', () => {
  it('uses scanned centers when available', () => {
    const centers = { R: rgbToLab([220, 40, 40]), L: rgbToLab([240, 80, 35]) }
    const names = nameCenters(centers)
    expect(previewColor(rgbToLab([238, 78, 36]), centers, names)).toBe('orange')
    expect(previewColor(rgbToLab([222, 42, 40]), centers, names)).toBe('red')
    expect(previewColor(rgbToLab([30, 75, 195]), centers, names)).toBe('blue')
  })
})
