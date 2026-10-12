/// <reference lib="webworker" />
import cvModule from '@techstark/opencv-js'
import { createFaceDetector, type FaceDetector } from './detect'
import { initOpenCv } from './opencv'
import type { FromVisionWorker, ToVisionWorker } from './protocol'

declare const self: DedicatedWorkerGlobalScope

let detector: FaceDetector | null = null
let heap: { length: number } | null = null

function post(message: FromVisionWorker, transfer: Transferable[] = []) {
  self.postMessage(message, transfer)
}

self.onmessage = async (event: MessageEvent<ToVisionWorker>) => {
  const msg = event.data
  try {
    if (msg.type === 'init') {
      const { cv } = await initOpenCv(cvModule)
      detector = createFaceDetector(cv)
      heap = (cv as unknown as { HEAPU8?: { length: number } }).HEAPU8 ?? null
      post({ type: 'ready' })
      return
    }

    if (msg.type === 'frame') {
      if (!detector) throw new Error('vision worker not initialized')
      const t0 = performance.now()
      const result = detector.detect(new Uint8ClampedArray(msg.buffer), msg.width, msg.height, msg.n)
      post({
        type: 'result',
        frameId: msg.frameId,
        result,
        detectMs: performance.now() - t0,
        heapBytes: heap?.length ?? null
      })
      return
    }

    if (msg.type === 'dispose') {
      detector?.dispose()
      detector = null
      self.close()
    }
  } catch (err) {
    post({
      type: 'error',
      frameId: msg.type === 'frame' ? msg.frameId : undefined,
      message: err instanceof Error ? err.message : String(err)
    })
  }
}
