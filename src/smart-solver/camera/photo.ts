import type { DetectResult } from '../vision/detect'
import type { VisionClient } from '../vision/VisionClient'

export interface PhotoDetection {
  result: DetectResult
  /** The square crop that produced `result`, at `size`×`size`, for display. */
  crop: HTMLCanvasElement
  size: number
}

/** Centered square crops tried in order; the cube face may fill more or less of the photo. */
const CROP_FRACTIONS = [0.9, 0.7, 0.5]

async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    // <img> decoding applies the EXIF orientation of phone photos.
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

const better = (a: DetectResult, b: DetectResult | null) =>
  !b || !b.face || (a.face !== null && (a.face.inliers > b.face.inliers || (a.face.inliers === b.face.inliers && a.face.error < b.face.error)))

/**
 * Finds a 3x3 face in a photo (camera app or gallery). Photos are sharper than video frames
 * and have no motion blur, so a single detection is enough to capture a face.
 */
export async function detectFaceInPhoto(file: Blob, vision: VisionClient, size = 480): Promise<PhotoDetection | null> {
  const img = await loadImage(file)
  return detectFaceInImage(img, img.naturalWidth, img.naturalHeight, vision, CROP_FRACTIONS, size)
}

/** Same as a photo, for a still already cropped to the guide square (webcam shutter). */
export function detectFaceInStill(still: HTMLCanvasElement, vision: VisionClient, size = 480): Promise<PhotoDetection | null> {
  return detectFaceInImage(still, still.width, still.height, vision, [1, 0.8], size)
}

async function detectFaceInImage(
  img: CanvasImageSource,
  w: number,
  h: number,
  vision: VisionClient,
  fractions: readonly number[],
  size: number
): Promise<PhotoDetection | null> {
  if (!w || !h) return null
  await vision.ready

  let best: PhotoDetection | null = null
  for (const fraction of fractions) {
    const side = Math.round(Math.min(w, h) * fraction)
    const crop = Object.assign(document.createElement('canvas'), { width: size, height: size })
    const ctx = crop.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size)
    const data = ctx.getImageData(0, 0, size, size)
    const { result } = await vision.process(data.data.buffer as ArrayBuffer, size, size)
    if (better(result, best?.result ?? null)) best = { result, crop, size }
    if (result.face?.inliers === 9 && result.face.error < 0.05) break
  }
  return best
}
