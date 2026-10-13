import type { Roi } from '../camera/FrameScheduler'
import type { FaceDetection } from '../vision/detect'
import type { Point } from '../vision/lattice'

/** Maps points in the worker's square frame to overlay canvas pixels. */
function mapper(roi: Roi, size: number, scale: number, offset: Point = { x: 0, y: 0 }) {
  const k = roi.side / size
  return (p: Point): Point => ({
    x: offset.x + (roi.x + p.x * k) * scale,
    y: offset.y + (roi.y + p.y * k) * scale
  })
}

function polygon(ctx: CanvasRenderingContext2D, pts: readonly Point[]) {
  ctx.beginPath()
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath()
}

/**
 * Draws the guide square and, if present, the detected lattice.
 * `scale` converts video pixels to canvas pixels (display size × devicePixelRatio).
 * `offset` accounts for object-fit: cover letterboxing/cropping.
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  roi: Roi,
  size: number,
  scale: number,
  face: FaceDetection | null,
  offset: Point = { x: 0, y: 0 }
) {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)
  const dpr = window.devicePixelRatio || 1

  const rx = offset.x + roi.x * scale
  const ry = offset.y + roi.y * scale
  const rw = roi.side * scale
  const rh = roi.side * scale

  // Dim outside the guide square.
  ctx.fillStyle = 'rgba(3, 5, 10, 0.45)'
  ctx.fillRect(0, 0, width, height)
  ctx.clearRect(rx, ry, rw, rh)

  ctx.lineWidth = 2 * dpr
  ctx.setLineDash([10, 8])
  ctx.strokeStyle = face ? 'rgba(94, 231, 255, 0.9)' : 'rgba(174, 196, 255, 0.7)'
  ctx.strokeRect(rx, ry, rw, rh)
  ctx.setLineDash([])

  if (face) drawLattice(ctx, face, mapper(roi, size, scale, offset))
}

/** Draws the detected lattice and sticker quads; `map` converts detector pixels to canvas pixels. */
export function drawLattice(ctx: CanvasRenderingContext2D, face: FaceDetection, map: (p: Point) => Point = (p) => p) {
  ctx.lineWidth = 2 * (window.devicePixelRatio || 1)
  ctx.setLineDash([])
  polygon(ctx, face.corners.map(map))
  ctx.strokeStyle = 'rgba(94, 231, 255, 0.95)'
  ctx.stroke()

  face.cells.forEach((cell) => {
    const pts = cell.polygon.map(map)
    const [r, g, b] = cell.rgb.map((v) => Math.round(v))
    polygon(ctx, pts)
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.55)`
    ctx.fill()
    if (!cell.observed) ctx.setLineDash([6, 5])
    ctx.strokeStyle = cell.observed ? 'rgba(232, 239, 255, 0.95)' : 'rgba(232, 239, 255, 0.55)'
    ctx.stroke()
    ctx.setLineDash([])
  })
}
