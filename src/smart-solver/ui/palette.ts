import { FACES, type Face } from '../core/types'
import { hungarian } from '../scan/hungarian'
import { deltaE2000, rgbToLab, type Lab } from '../vision/color'

export type ColorName = 'white' | 'yellow' | 'red' | 'orange' | 'green' | 'blue'

export const COLOR_NAMES: readonly ColorName[] = ['white', 'yellow', 'red', 'orange', 'green', 'blue']

/** Display colors match the 3D cube; `typical` is a common webcam reading used before centers are known. */
export const PALETTE: Record<ColorName, { css: string; label: string; typical: Lab }> = {
  white: { css: '#f4f4f4', label: 'trắng', typical: rgbToLab([235, 235, 230]) },
  yellow: { css: '#f4c430', label: 'vàng', typical: rgbToLab([245, 205, 40]) },
  red: { css: '#ff4b3e', label: 'đỏ', typical: rgbToLab([200, 35, 40]) },
  orange: { css: '#ff8c2b', label: 'cam', typical: rgbToLab([245, 120, 30]) },
  green: { css: '#16c172', label: 'xanh lá', typical: rgbToLab([30, 160, 80]) },
  blue: { css: '#2a6cff', label: 'xanh dương', typical: rgbToLab([30, 75, 195]) }
}

/** Standard scheme, as drawn by the 3D cube. */
export const STANDARD_COLOR: Record<Face, ColorName> = {
  U: 'white',
  D: 'yellow',
  F: 'green',
  B: 'blue',
  R: 'red',
  L: 'orange'
}

/**
 * Names each scanned center with a distinct standard color (closest overall match).
 * Most cubes share the same six hues; only their exact shades differ.
 */
export function nameCenters(centers: Partial<Record<Face, Lab>>): Partial<Record<Face, ColorName>> {
  const faces = FACES.filter((f) => centers[f])
  if (!faces.length) return {}
  const rows = COLOR_NAMES.map((_, i) => {
    const face = faces[i]
    return COLOR_NAMES.map((name) => (face ? deltaE2000(centers[face] as Lab, PALETTE[name].typical) : 0))
  })
  const assignment = hungarian(rows)
  return Object.fromEntries(faces.map((face, i) => [face, COLOR_NAMES[assignment[i] as number]])) as Partial<Record<Face, ColorName>>
}

/**
 * Best-guess color of a sticker while scanning: compares against the scanned centers,
 * falling back to typical readings for colors whose center is not scanned yet.
 */
export function previewColor(lab: Lab, centers: Partial<Record<Face, Lab>>, names: Partial<Record<Face, ColorName>>): ColorName {
  const refs = new Map<ColorName, Lab>(COLOR_NAMES.map((n) => [n, PALETTE[n].typical]))
  FACES.forEach((f) => {
    const name = names[f]
    const center = centers[f]
    if (name && center) refs.set(name, center)
  })
  let best: ColorName = 'white'
  let bestD = Infinity
  refs.forEach((ref, name) => {
    const d = deltaE2000(lab, ref, 2)
    if (d < bestD) {
      bestD = d
      best = name
    }
  })
  return best
}
