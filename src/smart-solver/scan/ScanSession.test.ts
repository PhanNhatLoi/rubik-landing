import { describe, expect, it } from 'vitest'
import type { FaceDetection, Rgb } from '../vision/detect'
import { rgbToLab } from '../vision/color'
import { SCAN_ORDER, ScanSession, faceDistance } from './ScanSession'

const CENTER: Record<string, Rgb> = {
  F: [30, 160, 80],
  R: [195, 35, 45],
  B: [30, 75, 195],
  L: [245, 125, 30],
  U: [235, 235, 230],
  D: [245, 205, 40]
}

function detection(center: Rgb, offset = 0, inliers = 9, others: Rgb[] = []): FaceDetection {
  const corners = [
    { x: 10 + offset, y: 10 },
    { x: 250 + offset, y: 10 },
    { x: 250 + offset, y: 250 },
    { x: 10 + offset, y: 250 }
  ] as FaceDetection['corners']
  return {
    corners,
    cells: Array.from({ length: 9 }, (_, k) => ({
      center: { x: 0, y: 0 },
      polygon: [corners[0], corners[1], corners[2], corners[3]],
      observed: true,
      rgb: k === 4 ? center : (others[k] ?? ([200, 200, 200] as Rgb))
    })),
    inliers,
    error: 0.01,
    pitch: 80
  }
}

describe('ScanSession', () => {
  it('captures a face after enough stable frames and advances', () => {
    const s = new ScanSession({ stableFrames: 3 })
    expect(s.push(detection(CENTER.F!), 100).phase).toBe('holding')
    expect(s.push(detection(CENTER.F!), 100).progress).toBeCloseTo(2 / 3)
    const fb = s.push(detection(CENTER.F!), 100)
    expect(fb.captured).toBe('F')
    expect(s.currentTarget).toBe('R')
    expect(s.faces.F?.labs).toHaveLength(9)
  })

  it('restarts the count when the cube moves or is lost', () => {
    const s = new ScanSession({ stableFrames: 3 })
    s.push(detection(CENTER.F!), 100)
    s.push(detection(CENTER.F!), 100)
    expect(s.push(detection(CENTER.F!, 40), 100).progress).toBeCloseTo(1 / 3)
    expect(s.push(null, 100).phase).toBe('searching')
    expect(s.push(detection(CENTER.F!, 40, 5), 100).phase).toBe('searching')
    expect(s.push(detection(CENTER.F!), 5).phase).toBe('blurry')
  })

  it('refuses to capture a face that was already scanned', () => {
    const s = new ScanSession({ stableFrames: 2 })
    s.push(detection(CENTER.F!), 100)
    s.push(detection(CENTER.F!), 100)
    const fb = s.push(detection(CENTER.F!), 100)
    expect(fb.phase).toBe('duplicate')
    expect(fb.seenFace).toBe('F')
    expect(fb.target).toBe('R')
  })

  it('scans all six faces in the guided order, then allows a rescan', () => {
    const s = new ScanSession({ stableFrames: 2 })
    const captured: string[] = []
    // Solid faces, as on a solved cube.
    const solid = (face: string) => detection(CENTER[face]!, 0, 9, Array.from({ length: 9 }, () => CENTER[face]!))
    for (const face of SCAN_ORDER) {
      s.push(solid(face), 100)
      const fb = s.push(solid(face), 100)
      if (fb.captured) captured.push(fb.captured)
    }
    expect(captured).toEqual([...SCAN_ORDER])
    expect(s.complete).toBe(true)
    expect(s.push(solid('F'), 100).phase).toBe('done')

    s.setTarget('L')
    s.push(solid('L'), 100)
    expect(s.push(solid('L'), 100).captured).toBe('L')
    expect(s.currentTarget).toBeNull()
  })

  it('scans orange after red even when the webcam makes them look alike', () => {
    // Measured-style webcam colors: centers only ~8 ΔE apart.
    const red: Rgb = [220, 40, 40]
    const orange: Rgb = [240, 80, 35]
    const s = new ScanSession({ stableFrames: 2 })
    s.setTarget('R')
    const redFace = Array.from({ length: 9 }, (_, k) => ([[30, 160, 80], [235, 235, 230], [30, 75, 195]][k % 3] as Rgb))
    const orangeFace = Array.from({ length: 9 }, (_, k) => ([[245, 205, 40], [30, 75, 195], [235, 235, 230]][k % 3] as Rgb))
    s.push(detection(red, 0, 9, redFace), 100)
    expect(s.push(detection(red, 0, 9, redFace), 100).captured).toBe('R')
    s.setTarget('L')
    s.push(detection(orange, 0, 9, orangeFace), 100)
    expect(s.push(detection(orange, 0, 9, orangeFace), 100).captured).toBe('L')
  })

  it('tells solved red and orange faces apart but recognises a rotated repeat', () => {
    const solid = (rgb: Rgb) => Array.from({ length: 9 }, () => rgbToLab(rgb))
    expect(faceDistance(solid([220, 40, 40]), solid([240, 80, 35]))).toBeGreaterThan(6)
    const pattern = Array.from({ length: 9 }, (_, k) => rgbToLab([k * 25, 255 - k * 20, 100]))
    const rotated = [6, 3, 0, 7, 4, 1, 8, 5, 2].map((i) => pattern[i]!)
    expect(faceDistance(pattern, rotated)).toBeLessThan(0.001)
  })

  it('captures a still photo immediately, with the same checks as video', () => {
    const s = new ScanSession()
    expect(s.pushStill(detection(CENTER.F!, 0, 5), 100).phase).toBe('searching')
    expect(s.pushStill(detection(CENTER.F!), 100).captured).toBe('F')
    expect(s.currentTarget).toBe('R')
    expect(s.pushStill(detection(CENTER.F!), 100).phase).toBe('duplicate')
  })
})
