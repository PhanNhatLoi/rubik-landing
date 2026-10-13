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
  onToggleCollapsed: () => void
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
      if (!ctx || !video.videoWidth) return
      const dpr = window.devicePixelRatio || 1
      const w = Math.round(video.clientWidth * dpr)
      const h = Math.round(video.clientHeight * dpr)
      if (overlay.width !== w || overlay.height !== h) {
        overlay.width = w
        overlay.height = h
      }
      const roi = r?.roi ?? computeRoi(video.videoWidth, video.videoHeight, SCHEDULER_OPTIONS.roiFraction)
      drawOverlay(ctx, roi, SCHEDULER_OPTIONS.size, w / video.videoWidth, r?.result.face ?? null)
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

  /** Downloads the exact square the detector sees, for debugging detection failures. */
  const saveFrame = () => {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const { size, roiFraction } = SCHEDULER_OPTIONS
    const roi = computeRoi(video.videoWidth, video.videoHeight, roiFraction)
    const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size })
    canvas.getContext('2d')?.drawImage(video, roi.x, roi.y, roi.side, roi.side, 0, 0, size, size)
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: `rubik-frame-${Date.now()}.png` })
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const face = stats.inliers > 0
  return (
    <>
      {headerSlot &&
        !hidden &&
        createPortal(
          <div className="camera-header">
            <div className="camera-heading">
              <span className="camera-title">{title}</span>
              {summary && <div className="panel-summary">{summary}</div>}
            </div>
            <button
              className="panel-toggle"
              onClick={onToggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Mở rộng' : 'Thu gọn'}
            >
              {collapsed ? '+' : '−'}
            </button>
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
            <div className="rb-camera__feedback" role="status">
              {face ? `Đã thấy lưới (${stats.inliers} ô)` : 'Đưa mặt rubik vào khung'}
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
        <details className="camera-details">
          <summary>Số liệu</summary>
          {cameraEnabled && (
            <button className="rb-btn rb-btn--ghost camera-save" onClick={saveFrame} disabled={status !== 'running'}>
              Lưu khung hình (debug)
            </button>
          )}
          <div className="camera-stats">
            <Stat label="Camera" value={camera ? `${camera.width}×${camera.height}` : '–'} />
            <Stat label="UI fps" value={stats.uiFps.toFixed(0)} />
            <Stat label="Vision fps" value={stats.visionFps.toFixed(1)} />
            <Stat label="Capture" value={`${stats.captureMs.toFixed(1)} ms`} />
            <Stat label="Detect" value={`${stats.detectMs.toFixed(1)} ms`} />
            <Stat label="Blobs" value={String(stats.candidates)} />
            <Stat label="Sharpness" value={stats.sharpness.toFixed(0)} />
            <Stat label="Heap" value={stats.heapMb != null ? `${stats.heapMb.toFixed(0)} MB` : '–'} />
            <Stat label="OpenCV load" value={loadMs != null ? `${(loadMs / 1000).toFixed(1)} s` : '–'} />
          </div>
        </details>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="camera-stat">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
    </div>
  )
}
