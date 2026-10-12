import type { DetectResult } from './detect'
import type { FromVisionWorker, ToVisionWorker } from './protocol'

export interface VisionFrameResult {
  frameId: number
  result: DetectResult
  detectMs: number
  heapBytes: number | null
}

interface Pending {
  resolve: (r: VisionFrameResult) => void
  reject: (e: Error) => void
}

/** Main-thread handle to the vision worker. One instance per camera session. */
export class VisionClient {
  /** Resolves with the time from worker creation to OpenCV ready, in ms. */
  readonly ready: Promise<number>
  private readonly worker: Worker
  private readonly pending = new Map<number, Pending>()
  private nextFrameId = 1
  private disposed = false

  constructor() {
    const t0 = performance.now()
    this.worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' })
    let onReady: (ms: number) => void = () => {}
    let onFail: (e: Error) => void = () => {}
    this.ready = new Promise<number>((resolve, reject) => {
      onReady = resolve
      onFail = reject
    })

    this.worker.onmessage = (event: MessageEvent<FromVisionWorker>) => {
      const msg = event.data
      if (msg.type === 'ready') onReady(performance.now() - t0)
      if (msg.type === 'result') {
        this.pending.get(msg.frameId)?.resolve({
          frameId: msg.frameId,
          result: msg.result,
          detectMs: msg.detectMs,
          heapBytes: msg.heapBytes
        })
        this.pending.delete(msg.frameId)
      }
      if (msg.type === 'error') {
        const error = new Error(msg.message)
        if (msg.frameId === undefined) onFail(error)
        else {
          this.pending.get(msg.frameId)?.reject(error)
          this.pending.delete(msg.frameId)
        }
      }
    }
    this.worker.onerror = (event) => {
      const error = new Error(event.message || 'vision worker failed to load')
      onFail(error)
      this.rejectAll(error)
    }
    this.send({ type: 'init' })
  }

  /** Stickers per side of the cube being scanned; sent with every frame. */
  gridSize = 3

  get inFlight(): number {
    return this.pending.size
  }

  /** Sends a frame; the buffer is transferred and must not be used afterwards. */
  process(buffer: ArrayBuffer, width: number, height: number): Promise<VisionFrameResult> {
    if (this.disposed) return Promise.reject(new Error('vision client disposed'))
    const frameId = this.nextFrameId++
    return new Promise((resolve, reject) => {
      this.pending.set(frameId, { resolve, reject })
      this.send({ type: 'frame', frameId, width, height, n: this.gridSize, buffer }, [buffer])
    })
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.send({ type: 'dispose' })
    this.rejectAll(new Error('vision client disposed'))
    // Give the worker a moment to free WASM memory, then make sure it is gone.
    setTimeout(() => this.worker.terminate(), 200)
  }

  private send(msg: ToVisionWorker, transfer: Transferable[] = []) {
    this.worker.postMessage(msg, transfer)
  }

  private rejectAll(error: Error) {
    this.pending.forEach((p) => p.reject(error))
    this.pending.clear()
  }
}
