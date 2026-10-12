import type { DetectResult } from './detect'

export type ToVisionWorker =
  | { type: 'init' }
  /** `n`: stickers per side of the cube being scanned. */
  | { type: 'frame'; frameId: number; width: number; height: number; n: number; buffer: ArrayBuffer }
  | { type: 'dispose' }

export type FromVisionWorker =
  | { type: 'ready' }
  | {
      type: 'result'
      frameId: number
      result: DetectResult
      detectMs: number
      /** WASM heap size in bytes, when exposed by the build. */
      heapBytes: number | null
    }
  | { type: 'error'; frameId?: number; message: string }
