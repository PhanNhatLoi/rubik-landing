import type { VisionClient, VisionFrameResult } from '../vision/VisionClient'

export interface Roi {
  /** Square guide region in video pixels. */
  x: number
  y: number
  side: number
}

export interface FrameSchedulerOptions {
  /** Guide square side as a fraction of the shorter video side. */
  roiFraction: number
  /** Side of the square sent to the worker, in pixels. */
  size: number
  maxFps: number
}

export interface ScheduledResult extends VisionFrameResult {
  roi: Roi
  size: number
  captureMs: number
}

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export function computeRoi(videoWidth: number, videoHeight: number, fraction: number): Roi {
  const side = Math.round(Math.min(videoWidth, videoHeight) * fraction)
  return { x: Math.round((videoWidth - side) / 2), y: Math.round((videoHeight - side) / 2), side }
}

/**
 * Pulls frames from a <video> on new video frames (requestVideoFrameCallback, rAF fallback),
 * crops the guide square, and sends it to the vision worker. At most one frame is in flight;
 * frames arriving meanwhile are dropped.
 */
export class FrameScheduler {
  private running = false
  private lastSent = 0
  private handle = 0
  private readonly ctx: Context2D

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly client: VisionClient,
    private readonly options: FrameSchedulerOptions,
    private readonly onResult: (r: ScheduledResult) => void,
    private readonly onError: (e: Error) => void
  ) {
    const { size } = options
    const canvas: HTMLCanvasElement | OffscreenCanvas =
      typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size })
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as Context2D | null
    if (!ctx) throw new Error('2D canvas is not available')
    this.ctx = ctx
  }

  start() {
    if (this.running) return
    this.running = true
    this.schedule()
  }

  stop() {
    this.running = false
    if ('cancelVideoFrameCallback' in this.video) this.video.cancelVideoFrameCallback(this.handle)
    cancelAnimationFrame(this.handle)
  }

  private schedule() {
    if (!this.running) return
    if ('requestVideoFrameCallback' in this.video) {
      this.handle = this.video.requestVideoFrameCallback(() => this.tick())
    } else {
      this.handle = requestAnimationFrame(() => this.tick())
    }
  }

  private tick() {
    if (!this.running) return
    this.schedule()

    const now = performance.now()
    const { videoWidth, videoHeight } = this.video
    // 10% slack so frame-timing jitter doesn't halve the rate when the camera runs at maxFps.
    if (!videoWidth || this.client.inFlight > 0 || now - this.lastSent < 900 / this.options.maxFps) return
    this.lastSent = now

    const { size, roiFraction } = this.options
    const roi = computeRoi(videoWidth, videoHeight, roiFraction)
    const t0 = performance.now()
    this.ctx.drawImage(this.video, roi.x, roi.y, roi.side, roi.side, 0, 0, size, size)
    const image = this.ctx.getImageData(0, 0, size, size)
    const captureMs = performance.now() - t0

    this.client
      .process(image.data.buffer as ArrayBuffer, size, size)
      .then((r) => {
        if (this.running) this.onResult({ ...r, roi, size, captureMs })
      })
      .catch((e: unknown) => {
        if (this.running) this.onError(e instanceof Error ? e : new Error(String(e)))
      })
  }
}
