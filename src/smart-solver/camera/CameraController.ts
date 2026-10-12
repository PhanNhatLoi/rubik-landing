export type CameraErrorCode = 'insecure' | 'unsupported' | 'denied' | 'notFound' | 'busy' | 'aborted' | 'unknown'

export class CameraError extends Error {
  constructor(
    readonly code: CameraErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'CameraError'
  }
}

function toCameraError(err: unknown): CameraError {
  if (err instanceof CameraError) return err
  const name = err instanceof DOMException || err instanceof Error ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return new CameraError('denied', 'Quyền truy cập camera bị từ chối.')
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return new CameraError('notFound', 'Không tìm thấy camera phù hợp.')
  if (name === 'NotReadableError' || name === 'AbortError') return new CameraError('busy', 'Camera đang được ứng dụng khác sử dụng.')
  return new CameraError('unknown', err instanceof Error ? err.message : String(err))
}

export interface CameraInfo {
  width: number
  height: number
  label: string
}

/**
 * Owns one camera stream bound to a <video>. Safe to start/stop repeatedly
 * (React StrictMode mounts effects twice): a stale start releases its stream.
 */
export class CameraController {
  private stream: MediaStream | null = null
  private video: HTMLVideoElement | null = null
  private generation = 0
  onEnded: (() => void) | null = null

  async start(video: HTMLVideoElement): Promise<CameraInfo> {
    this.stop()
    const generation = ++this.generation
    if (!window.isSecureContext) throw new CameraError('insecure', 'Camera chỉ hoạt động qua HTTPS hoặc localhost.')
    if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('unsupported', 'Trình duyệt không hỗ trợ camera.')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      })
    } catch (err) {
      throw toCameraError(err)
    }

    if (generation !== this.generation) {
      stream.getTracks().forEach((t) => t.stop())
      throw new CameraError('aborted', 'Camera đã bị dừng trước khi khởi động xong.')
    }

    this.stream = stream
    this.video = video
    const track = stream.getVideoTracks()[0]
    if (track) track.onended = () => this.onEnded?.()

    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    try {
      await video.play()
    } catch (err) {
      if (generation !== this.generation) throw new CameraError('aborted', 'Camera đã bị dừng.')
      throw toCameraError(err)
    }
    if (!video.videoWidth) {
      await new Promise<void>((resolve) => video.addEventListener('loadedmetadata', () => resolve(), { once: true }))
    }
    return { width: video.videoWidth, height: video.videoHeight, label: track?.label ?? '' }
  }

  stop() {
    this.generation += 1
    this.stream?.getTracks().forEach((t) => {
      t.onended = null
      t.stop()
    })
    this.stream = null
    if (this.video) {
      this.video.pause()
      this.video.srcObject = null
      this.video = null
    }
  }
}
