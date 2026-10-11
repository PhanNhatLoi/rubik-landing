import type { Roi } from '../camera/FrameScheduler'
import type { FaceDetection } from '../vision/detect'
import type { Point } from '../vision/lattice'

/** Maps points in the worker's square frame to overlay canvas pixels. */
function mapper(roi: Roi, size: number, scale: number) {
  const k = roi.side / size
  return (p: Point): Point => ({ x: (roi.x + p.x * k) * scale, y: (roi.y + p.y * k) * scale })
}

function polygon(ctx: CanvasRenderingContext2D, pts: readonly Point[]) {
  ctx.beginPath()
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath()
}

/**
 * Draws the guide square and, if present, the detected lattice.
 * `scale` converts video pixels to canvas pixels (display size × devicePixelRatio).
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  roi: Roi,
  size: number,
  scale: number,
  face: FaceDetection | null
) {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)
  const dpr = window.devicePixelRatio || 1

  // Dim outside the guide square.
  ctx.fillStyle = 'rgba(3, 5, 10, 0.45)'
  ctx.fillRect(0, 0, width, height)
  ctx.clearRect(roi.x * scale, roi.y * scale, roi.side * scale, roi.side * scale)

  ctx.lineWidth = 2 * dpr
  ctx.setLineDash([10, 8])
  ctx.strokeStyle = face ? 'rgba(94, 231, 255, 0.9)' : 'rgba(174, 196, 255, 0.7)'
  ctx.strokeRect(roi.x * scale, roi.y * scale, roi.side * scale, roi.side * scale)
  ctx.setLineDash([])

  if (!face) return
  const map = mapper(roi, size, scale)

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
