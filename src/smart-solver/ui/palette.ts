import { FACES, type Face } from '../core/types'
import { deltaE2000, rgbToLab, type Lab } from '../vision/color'
import type { Rgb } from '../vision/detect'

/** How one face's center color is shown and recognised. */
export interface SchemeColor {
  /** Display color (net, guide, 3D cube). */
  css: string
  /** Vietnamese name used in instructions. */
  label: string
  /** Expected camera reading, used to recognise the face before its center is scanned. */
  ref: Lab
}

/** Center color of every face. Faces keep their standard names (U, R, F, D, L, B). */
export type Scheme = Record<Face, SchemeColor>

export type SchemePreset = 'standard' | 'japanese' | 'custom'

export interface SchemeSettings {
  preset: SchemePreset
  /** Display colors for the custom preset. */
  custom: Record<Face, string>
}

/** Colors offered in the picker. `camera` is a typical webcam reading of such a sticker. */
export const SWATCHES: readonly { css: string; label: string; camera: Lab }[] = [
  { css: '#f4f4f4', label: 'trắng', camera: rgbToLab([235, 235, 230]) },
  { css: '#f4c430', label: 'vàng', camera: rgbToLab([245, 205, 40]) },
  { css: '#ff4b3e', label: 'đỏ', camera: rgbToLab([200, 35, 40]) },
  { css: '#ff8c2b', label: 'cam', camera: rgbToLab([245, 120, 30]) },
  { css: '#16c172', label: 'xanh lá', camera: rgbToLab([30, 160, 80]) },
  { css: '#2a6cff', label: 'xanh dương', camera: rgbToLab([30, 75, 195]) },
  { css: '#9b5de5', label: 'tím', camera: rgbToLab([130, 70, 190]) },
  { css: '#f15bb5', label: 'hồng', camera: rgbToLab([235, 90, 170]) },
  { css: '#1f1f24', label: 'đen', camera: rgbToLab([35, 35, 40]) },
  { css: '#9aa0a6', label: 'xám', camera: rgbToLab([150, 152, 155]) }
]

const swatch = (label: string) => SWATCHES.find((s) => s.label === label)?.css as string

export const PRESET_COLORS: Record<Exclude<SchemePreset, 'custom'>, Record<Face, string>> = {
  standard: { U: swatch('trắng'), D: swatch('vàng'), F: swatch('xanh lá'), B: swatch('xanh dương'), R: swatch('đỏ'), L: swatch('cam') },
  // Japanese scheme: white opposite blue, green opposite yellow.
  japanese: { U: swatch('trắng'), D: swatch('xanh dương'), F: swatch('xanh lá'), B: swatch('vàng'), R: swatch('đỏ'), L: swatch('cam') }
}

export const PRESET_LABEL: Record<SchemePreset, string> = { standard: 'Chuẩn quốc tế', japanese: 'Nhật Bản', custom: 'Tuỳ chỉnh' }

export const DEFAULT_SCHEME_SETTINGS: SchemeSettings = { preset: 'standard', custom: { ...PRESET_COLORS.standard } }

export function hexToRgb(css: string): Rgb {
  const n = parseInt(css.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** A display color as a scheme entry: picker colors keep their name and camera reference. */
export function colorFromCss(css: string): SchemeColor {
  const known = SWATCHES.find((s) => s.css.toLowerCase() === css.toLowerCase())
  if (known) return { css: known.css, label: known.label, ref: known.camera }
  return { css, label: `màu ${css}`, ref: rgbToLab(hexToRgb(css)) }
}

export function buildScheme(settings: SchemeSettings): Scheme {
  const colors = settings.preset === 'custom' ? settings.custom : PRESET_COLORS[settings.preset]
  return Object.fromEntries(FACES.map((f) => [f, colorFromCss(colors[f])])) as Scheme
}

export const STANDARD_SCHEME: Scheme = buildScheme(DEFAULT_SCHEME_SETTINGS)

/** Six centers must be told apart: no two faces may share (nearly) the same color. */
export function duplicateColors(colors: Record<Face, string>): Face[] {
  const labs = FACES.map((f) => rgbToLab(hexToRgb(colors[f])))
  return FACES.filter((_, i) => labs.some((other, j) => j !== i && deltaE2000(labs[i] as Lab, other) < 10))
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`
}

/** A camera reading made presentable: saturated and mid-bright, near-greys kept grey. */
export function cleanColor([r, g, b]: Rgb): string {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const l = (max + min) / 2
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (max !== min) {
    const [R, G, B] = [r / 255, g / 255, b / 255]
    if (max === R) h = ((G - B) / (max - min)) % 6
    else if (max === G) h = (B - R) / (max - min) + 2
    else h = (R - G) / (max - min) + 4
    h *= 60
    if (h < 0) h += 360
  }
  const grey = s < 0.18
  const S = grey ? s : Math.max(s, 0.7)
  const L = grey ? (l > 0.6 ? 0.95 : l < 0.25 ? 0.12 : 0.6) : Math.min(Math.max(l, 0.45), 0.6)
  const C = (1 - Math.abs(2 * L - 1)) * S
  const X = C * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = L - C / 2
  const [r1, g1, b1] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X]
  return toHex([(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255])
}

export interface MeasuredCenter {
  lab: Lab
  rgb: Rgb
}

/**
 * Adopts the real color of scanned centers that are clearly not what the scheme expects
 * (a purple face where the scheme says orange). Ordinary shade differences are ignored so
 * standard cubes keep the clean palette colors.
 */
export function learnScheme(
  scheme: Scheme,
  centers: Partial<Record<Face, MeasuredCenter>>,
  threshold = 25
): { scheme: Scheme; learned: Face[] } {
  const learned: Face[] = []
  const out = { ...scheme }
  FACES.forEach((f) => {
    const c = centers[f]
    if (!c || deltaE2000(c.lab, scheme[f].ref) <= threshold) return
    const nearest = SWATCHES.reduce((a, b) => (deltaE2000(c.lab, b.camera) < deltaE2000(c.lab, a.camera) ? b : a))
    const label = deltaE2000(c.lab, nearest.camera) < 20 ? nearest.label : 'màu đo được'
    out[f] = { css: cleanColor(c.rgb), label, ref: c.lab }
    learned.push(f)
  })
  return { scheme: out, learned }
}

/** Best-guess face of a sticker while scanning: scanned centers first, scheme references otherwise. */
export function previewFace(lab: Lab, centers: Partial<Record<Face, Lab>>, scheme: Scheme): Face {
  const ref = (f: Face) => centers[f] ?? scheme[f].ref
  return FACES.reduce((a, b) => (deltaE2000(lab, ref(b), 2) < deltaE2000(lab, ref(a), 2) ? b : a))
}

/**
 * Which face a center color belongs to, when it is clearly not `target`.
 * Only faces not scanned yet are candidates (scanned ones are caught by the duplicate check),
 * which keeps red/orange apart: once red is scanned, an orange-ish center can only be orange.
 * A center that looks like no face of the scheme (an unusual cube) is accepted, so its color
 * can be learned. Returns null when the center fits `target` or is too close to call.
 */
export function wrongCenter(
  center: Lab,
  target: Face,
  scanned: readonly Face[],
  scheme: Scheme = STANDARD_SCHEME,
  margin = 6,
  lookalike = 20
): Face | null {
  const candidates = FACES.filter((f) => f === target || !scanned.includes(f))
  const dist = (f: Face) => deltaE2000(center, scheme[f].ref, 2)
  const nearest = candidates.reduce((a, b) => (dist(b) < dist(a) ? b : a))
  return nearest !== target && dist(nearest) < lookalike && dist(target) - dist(nearest) > margin ? nearest : null
}

/** Scheme as 0xRRGGBB numbers for the 3D cube. */
export function schemeHex(scheme: Scheme): Record<Face, number> {
  return Object.fromEntries(FACES.map((f) => [f, parseInt(scheme[f].css.replace('#', ''), 16)])) as Record<Face, number>
}

const SETTINGS_KEY = 'smart-solver.colorScheme'

export function loadSchemeSettings(): SchemeSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SCHEME_SETTINGS
    const parsed = JSON.parse(raw) as Partial<SchemeSettings>
    const preset = parsed.preset === 'japanese' || parsed.preset === 'custom' ? parsed.preset : 'standard'
    const custom = { ...DEFAULT_SCHEME_SETTINGS.custom }
    FACES.forEach((f) => {
      const v = parsed.custom?.[f]
      if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) custom[f] = v
    })
    return { preset, custom }
  } catch {
    return DEFAULT_SCHEME_SETTINGS
  }
}

export function saveSchemeSettings(settings: SchemeSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage unavailable (private mode): the choice just isn't remembered.
  }
}
