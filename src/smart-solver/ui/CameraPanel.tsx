import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CameraController, CameraError, type CameraInfo } from '../camera/CameraController'
import { FrameScheduler, computeRoi, type ScheduledResult } from '../camera/FrameScheduler'
import type { VisionClient } from '../vision/VisionClient'
import { drawOverlay } from './overlay'

const SCHEDULER_OPTIONS = { roiFraction: 0.62, size: 320, maxFps: 15 }

type Status = 'starting' | 'loading' | 'running' | 'error'

interface Stats {
  uiFps: number
  visionFps: number
  captureMs: number
  detectMs: number
  candidates: number
  inliers: number
  sharpness: number
  heapMb: number | null
}

const EMPTY_STATS: Stats = { uiFps: 0, visionFps: 0, captureMs: 0, detectMs: 0, candidates: 0, inliers: 0, sharpness: 0, heapMb: null }

export interface CameraPanelProps {
  title: string
  /** Element in the controls row where the title, status and collapse button are rendered. */
  headerSlot: HTMLElement | null
  /** Shared detector worker, owned by the parent (photo scanning uses it too). */
  vision: VisionClient | null
  /** Live webcam on/off; the panel and its children stay visible either way. */
  cameraEnabled: boolean
  /** Hidden panels stay mounted so their state survives closing. */
  hidden: boolean
  collapsed: boolean
  /** Omitted when the panel can't be collapsed (desktop). */
  onToggleCollapsed?: () => void
  /** One-line status shown next to the title. */
  summary?: ReactNode
  /** Badge in the top-left corner of the camera frame (e.g. face name). */
  badge?: ReactNode
  /** Big text over the video (countdown). */
  overlay?: ReactNode
  /** Filled with a function that grabs the guide square from the live video at full resolution. */
  grabRef?: MutableRefObject<(() => HTMLCanvasElement | null) | null>
  /** Called for every vision result (up to maxFps times per second). */
  onResult?: (r: ScheduledResult) => void
  /** Shown under the video instead of the default detection hint. */
  children?: ReactNode
}

export default function CameraPanel({
  title,
  headerSlot,
  vision,
  cameraEnabled,
  hidden,
  collapsed,
  onToggleCollapsed,
  summary,
  badge,
  overlay,
  grabRef,
  onResult,
  children
}: CameraPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<Status>('starting')
  const [error, setError] = useState<string | null>(null)
  const [camera, setCamera] = useState<CameraInfo | null>(null)
  const [loadMs, setLoadMs] = useState<number | null>(null)
  const [stats, setStats] = useState<Stats>(EMPTY_STATS)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    const video = videoRef.current
    const overlay = overlayRef.current
    if (!video || !overlay || !cameraEnabled || !vision) return
    setStatus('starting')
    setError(null)
    let cancelled = false
    const controller = new CameraController()
    const client = vision
    let scheduler: FrameScheduler | null = null

    // Rolling counters, flushed to React state twice a second.
    let uiFrames = 0
    let visionFrames = 0
    let last: ScheduledResult | null = null
    let raf = 0
    const countUi = () => {
      uiFrames += 1
      raf = requestAnimationFrame(countUi)
    }
    raf = requestAnimationFrame(countUi)
    let windowStart = performance.now()
    const flush = window.setInterval(() => {
      const now = performance.now()
      const secs = (now - windowStart) / 1000
      windowStart = now
      const r = last
      setStats({
        uiFps: uiFrames / secs,
        visionFps: visionFrames / secs,
        captureMs: r?.captureMs ?? 0,
        detectMs: r?.detectMs ?? 0,
        candidates: r?.result.candidates ?? 0,
        inliers: r?.result.face?.inliers ?? 0,
        sharpness: r?.result.sharpness ?? 0,
        heapMb: r?.heapBytes != null ? r.heapBytes / 1048576 : null
      })
      uiFrames = 0
      visionFrames = 0
    }, 500)

    const draw = (r: ScheduledResult | null) => {
      const ctx = overlay.getContext('2d')
      if (!ctx || !video.videoWidth || !video.videoHeight) return
      const dpr = window.devicePixelRatio || 1
      const containerWidth = video.clientWidth || overlay.clientWidth
      const containerHeight = video.clientHeight || overlay.clientHeight
      const w = Math.round(containerWidth * dpr)
      const h = Math.round(containerHeight * dpr)
      if (overlay.width !== w || overlay.height !== h) {
        overlay.width = w
        overlay.height = h
      }

      const scaleCss = Math.max(containerWidth / video.videoWidth, containerHeight / video.videoHeight)
      const offsetXCss = (containerWidth - video.videoWidth * scaleCss) / 2
      const offsetYCss = (containerHeight - video.videoHeight * scaleCss) / 2

      const scale = scaleCss * dpr
      const offset = { x: offsetXCss * dpr, y: offsetYCss * dpr }

      const roi = r?.roi ?? computeRoi(video.videoWidth, video.videoHeight, SCHEDULER_OPTIONS.roiFraction)
      drawOverlay(ctx, roi, SCHEDULER_OPTIONS.size, scale, r?.result.face ?? null, offset)
    }

    const fail = (message: string) => {
      if (cancelled) return
      setError(message)
      setStatus('error')
    }

    controller.onEnded = () => fail('Camera đã bị ngắt kết nối.')

    ;(async () => {
      try {
        const info = await controller.start(video)
        if (cancelled) return
        setCamera(info)
        draw(null)
        setStatus('loading')
        const ms = await client.ready
        if (cancelled) return
        setLoadMs(ms)
        setStatus('running')
        scheduler = new FrameScheduler(
          video,
          client,
          SCHEDULER_OPTIONS,
          (r) => {
            last = r
            visionFrames += 1
            draw(r)
            onResultRef.current?.(r)
          },
          (e) => fail(`Lỗi xử lý ảnh: ${e.message}`)
        )
        scheduler.start()
      } catch (e) {
        if (e instanceof CameraError && e.code === 'aborted') return
        fail(e instanceof Error ? e.message : String(e))
      }
    })()

    const onResize = () => draw(last)
    window.addEventListener('resize', onResize)

    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
      window.clearInterval(flush)
      cancelAnimationFrame(raf)
      scheduler?.stop()
      controller.stop()
    }
  }, [cameraEnabled, vision])

  useEffect(() => {
    if (!grabRef) return
    grabRef.current = () => {
      const video = videoRef.current
      if (!cameraEnabled || !video?.videoWidth) return null
      const roi = computeRoi(video.videoWidth, video.videoHeight, SCHEDULER_OPTIONS.roiFraction)
      const side = Math.min(roi.side, 960)
      const canvas = Object.assign(document.createElement('canvas'), { width: side, height: side })
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return null
      ctx.drawImage(video, roi.x, roi.y, roi.side, roi.side, 0, 0, side, side)
      return canvas
    }
    return () => {
      grabRef.current = null
    }
  }, [grabRef, cameraEnabled])

  const face = stats.inliers > 0
  return (
    <>
      {headerSlot &&
        !hidden &&
        createPortal(
          <div className="camera-header">
            <div className="camera-heading">
              {title && <span className="camera-title">{title}</span>}
              {summary && <div className="panel-summary">{summary}</div>}
            </div>
            {onToggleCollapsed && (
              <button
                className="panel-toggle"
                onClick={onToggleCollapsed}
                aria-expanded={!collapsed}
                aria-label={collapsed ? 'Mở rộng' : 'Thu gọn'}
              >
                {collapsed ? '+' : '−'}
              </button>
            )}
          </div>,
          headerSlot
        )}
      <div className="camera-panel" hidden={hidden || collapsed}>
        <div className="camera-view rb-camera" hidden={!cameraEnabled}>
          <video ref={videoRef} className="camera-video" muted playsInline />
          <canvas ref={overlayRef} className="camera-overlay" />
          {badge && <div className="rb-camera__badge">{badge}</div>}
          {status === 'running' && overlay != null && <div className="rb-camera__countdown">{overlay}</div>}
          {status === 'running' && (
            <div className="rb-camera__feedback">
              <span role="status" aria-live="polite">
                {face ? 'Đã thấy lưới' : 'Đưa mặt rubik vào khung'}
              </span>
              {face && <span aria-hidden="true"> ({stats.inliers} ô)</span>}
            </div>
          )}
          {status !== 'running' && (
            <div className="camera-message">
              {status === 'starting' && 'Đang mở camera...'}
              {status === 'loading' && 'Đang tải bộ xử lý ảnh...'}
              {status === 'error' && error}
            </div>
          )}
        </div>
        <div className="camera-body">
          {children ?? (
            <div className="camera-hint">
              {status === 'running'
                ? face
                  ? `Đã thấy lưới 3×3 (${stats.inliers}/9 ô)`
                  : 'Đưa một mặt rubik vào khung'
                : ' '}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
