import type { DetectResult } from './detect'

export type ToVisionWorker =
  | { type: 'init' }
  | { type: 'frame'; frameId: number; width: number; height: number; buffer: ArrayBuffer }
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
