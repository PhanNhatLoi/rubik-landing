export type OpenCv = typeof import('@techstark/opencv-js')

type EmscriptenModule = OpenCv & { onRuntimeInitialized?: () => void }

/**
 * Resolves once the OpenCV.js WASM runtime is initialized.
 * The Emscripten module is a thenable that resolves to itself, so it is returned wrapped:
 * awaiting it (or resolving a promise with it) never settles.
 */
export function initOpenCv(mod: unknown): Promise<{ cv: OpenCv }> {
  return new Promise((resolve, reject) => {
    if (mod instanceof Promise) {
      mod.then((m: OpenCv) => resolve({ cv: m }), reject)
      return
    }
    const cv = mod as EmscriptenModule
    if (typeof cv.Mat === 'function') {
      resolve({ cv })
      return
    }
    cv.onRuntimeInitialized = () => resolve({ cv })
  })
}
