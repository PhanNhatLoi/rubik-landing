import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { fromFacelets } from '../core/facelets'
import { FACES, type Face, type Facelets, type ValidationError } from '../core/types'
import type { ScheduledResult } from '../camera/FrameScheduler'
import { detectFaceInPhoto, detectFaceInStill, type PhotoDetection } from '../camera/photo'
import { reconstruct, type ReconstructResult, type ScanInput } from '../scan/reconstruct'
import { SCAN_ORDER, ScanSession, type FaceScan, type ScanFeedback } from '../scan/ScanSession'
import { AutoCapture } from '../scan/autoCapture'
import { stepFor, type Hold } from '../scan/scanGuide'
import type { Lab } from '../vision/color'
import type { VisionClient } from '../vision/VisionClient'
import { drawLattice } from './overlay'
import ScanNet, { type NetCell } from './ScanNet'
import { buildScheme, learnScheme, previewFace, wrongCenter, type MeasuredCenter, type Scheme, type SchemeSettings } from './palette'
import SchemePicker from './SchemePicker'

export const POSITION_NAME: Record<Face, string> = { F: 'trước', R: 'phải', B: 'sau', L: 'trái', U: 'trên', D: 'dưới' }


function describeError(e: ValidationError, label: (f: Face) => string): string {
  switch (e.kind) {
    case 'colorCount':
      return `Màu ${label(e.face)} có ${e.count} ô (cần 9).`
    case 'invalidCorner':
      return 'Có một góc không tồn tại trên khối thật.'
    case 'invalidEdge':
      return 'Có một cạnh không tồn tại trên khối thật.'
    case 'duplicateCorner':
      return 'Có hai góc giống hệt nhau.'
    case 'duplicateEdge':
      return 'Có hai cạnh giống hệt nhau.'
    case 'cornerTwist':
      return 'Một góc bị xoắn (không thể có trên khối thật).'
    case 'edgeFlip':
      return 'Một cạnh bị lật (không thể có trên khối thật).'
    case 'parity':
      return 'Sai tính chẵn lẻ: có hai mảnh bị đổi chỗ.'
    default:
      return 'Trạng thái không hợp lệ.'
  }
}

export type ScanMode = 'webcam' | 'photo'

type PhotoState = { status: 'idle' } | { status: 'working' } | { status: 'done'; thumb: string; message: string | null }

export interface ScanViewProps {
  mode: ScanMode
  onModeChange: (mode: ScanMode) => void
  vision: VisionClient | null
  /** The panel forwards camera results here while this view is mounted. */
  frameHandlerRef: MutableRefObject<((r: ScheduledResult) => void) | null>
  /** Grabs a full-resolution still of the guide square from the live camera (null if the camera is off). */
  grabStillRef: MutableRefObject<(() => HTMLCanvasElement | null) | null>
  /** Photo mode can use the live camera with a shutter button (desktop). */
  canShutter: boolean
  /** Countdown text to show over the video, or null. */
  onOverlay: (text: string | null) => void
  confirmLabel: string
  /** Called with a valid facelet string and the color name of each center. */
  onConfirm: (facelets: Facelets, scheme: Scheme) => void
  /** Center colors chosen by the user (preset or custom). */
  schemeSettings: SchemeSettings
  onSchemeSettings: (settings: SchemeSettings) => void
  onSkipScan?: () => void
}

type Analysis = { status: 'idle' } | { status: 'running' } | { status: 'done'; result: ReconstructResult }

export default function ScanView({
  mode,
  onModeChange,
  vision,
  frameHandlerRef,
  grabStillRef,
  canShutter,
  onOverlay,
  confirmLabel,
  onConfirm,
  schemeSettings,
  onSchemeSettings,
  onSkipScan
}: ScanViewProps) {
  // The identify check reads the current scheme through this ref (the session lives across renders).
  const schemeRef = useRef<Scheme>(buildScheme(schemeSettings))
  const sessionRef = useRef<ScanSession>(
    new ScanSession({ identify: (center, target, scanned) => wrongCenter(center, target, scanned, schemeRef.current) })
  )
  const autoRef = useRef(new AutoCapture())
  /** Live check of the webcam frame (null = a face that would be accepted is in view). */
  const [live, setLive] = useState<ScanFeedback | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  /** Grid size of another cube seen steadily by the webcam (e.g. 4 for a 4x4), or null. */
  const [wrongSize, setWrongSize] = useState<number | null>(null)
  const wrongSizeFrames = useRef(0)
  const [feedback, setFeedback] = useState<ScanFeedback>({ phase: 'searching', target: 'F', progress: 0, captured: null, seenFace: null })
  const [faces, setFaces] = useState<Partial<Record<Face, FaceScan>>>({})
  const [analysis, setAnalysis] = useState<Analysis>({ status: 'idle' })
  const [edits, setEdits] = useState<Record<number, Face>>({})
  const [photo, setPhoto] = useState<PhotoState>({ status: 'idle' })
  const [selectedReviewFace, setSelectedReviewFace] = useState<Face>('F')
  const [selectedReviewCell, setSelectedReviewCell] = useState<number>(0)

  // Latest values for the per-frame handler, which is installed once.
  const latest = useRef({ mode, vision })
  latest.current = { mode, vision }

  // Re-analyse whenever the set of scanned faces changes and all six are present.
  useEffect(() => {
    setEdits({})
    if (!SCAN_ORDER.every((f) => faces[f])) {
      setAnalysis({ status: 'idle' })
      return
    }
    setAnalysis({ status: 'running' })
    // Let React paint the "analysing" state before the ~0.2 s search blocks the thread.
    const timer = window.setTimeout(() => {
      const labs = (f: Face) => (faces[f] as FaceScan).labs
      const input: ScanInput = { U: labs('U'), R: labs('R'), F: labs('F'), D: labs('D'), L: labs('L'), B: labs('B') }
      setAnalysis({ status: 'done', result: reconstruct(input) })
    }, 30)
    return () => window.clearTimeout(timer)
  }, [faces])

  const result = analysis.status === 'done' && analysis.result.ok ? analysis.result.result : null

  const centers = useMemo(() => {
    const out: Partial<Record<Face, Lab>> = {}
    FACES.forEach((f) => {
      const lab = faces[f]?.labs[4]
      if (lab) out[f] = lab
    })
    return out
  }, [faces])
  // The chosen scheme, with clearly different scanned centers (e.g. a purple face) adopted as measured.
  const baseScheme = useMemo(() => buildScheme(schemeSettings), [schemeSettings])
  const { scheme, learned } = useMemo(() => {
    const measured: Partial<Record<Face, MeasuredCenter>> = {}
    FACES.forEach((f) => {
      const scan = faces[f]
      if (scan) measured[f] = { lab: scan.labs[4] as Lab, rgb: scan.rgbs[4] as MeasuredCenter['rgb'] }
    })
    return learnScheme(baseScheme, measured)
  }, [baseScheme, faces])
  schemeRef.current = scheme
  const label = useCallback((f: Face) => scheme[f].label, [scheme])

  const finalFacelets = useMemo(() => {
    if (!result) return null
    const chars = result.facelets.split('')
    Object.entries(edits).forEach(([i, face]) => (chars[Number(i)] = face))
    return chars.join('')
  }, [result, edits])

  const validation = useMemo(() => (finalFacelets ? fromFacelets(finalFacelets) : null), [finalFacelets])

  const cells: NetCell[] = useMemo(() => {
    if (result && finalFacelets) {
      const suspicious = new Set([...result.lowConfidence, ...(result.alternative?.differing ?? [])])
      const changed = new Set(result.changed)
      return [...finalFacelets].map((label, i) => ({
        color: scheme[label as Face].css,
        mark: edits[i] !== undefined ? null : changed.has(i) ? 'changed' : suspicious.has(i) ? 'uncertain' : null
      }))
    }
    // Before analysis: each scanned sticker shown in the standard color it most likely is.
    return FACES.flatMap((face) =>
      Array.from({ length: 9 }, (_, k) => {
        const lab = faces[face]?.labs[k]
        // Unscanned faces still show their center, in the color the scheme gives it.
        const shown = k === 4 ? face : lab ? previewFace(lab, centers, scheme) : null
        return { color: shown ? scheme[shown].css : null, mark: null }
      })
    )
  }, [result, finalFacelets, faces, edits, centers, scheme])

  const cycleCell = (index: number) => {
    if (!finalFacelets) return
    const current = finalFacelets[index] as Face
    const next = FACES[(FACES.indexOf(current) + 1) % FACES.length] as Face
    setEdits((prev) => ({ ...prev, [index]: next }))
  }

  /** Makes `face` the one being scanned; a scanned face gets overwritten by the next capture. */
  const select = (face: Face) => {
    sessionRef.current.setTarget(face)
    autoRef.current.reset()
    setPhoto({ status: 'idle' })
    setFeedback((fb) => ({ ...fb, target: face, phase: 'searching', progress: 0 }))
  }

  /** "Quét lại mặt này": forgets the face so it is scanned from scratch. */
  const clearFace = (face: Face) => {
    sessionRef.current.remove(face)
    setFaces({ ...sessionRef.current.faces })
    select(face)
  }

  const onCellClick = (index: number) => {
    const face = FACES[Math.floor(index / 9)] as Face
    if (result) {
      setSelectedReviewFace(face)
      setSelectedReviewCell(index % 9)
    } else {
      select(face)
    }
  }

  const restart = () => {
    sessionRef.current.reset()
    autoRef.current.reset()
    setFaces({})
    setPhoto({ status: 'idle' })
    setFeedback({ phase: 'searching', target: 'F', progress: 0, captured: null, seenFace: null })
  }


  /** Captures (or rejects) a still: photo file, desktop shutter or webcam countdown. */
  const handleStill = (det: PhotoDetection | null) => {
    const face = det?.result.face ?? null
    let thumb = ''
    if (det) {
      const ctx = det.crop.getContext('2d')
      if (ctx && face) drawLattice(ctx, face)
      thumb = det.crop.toDataURL('image/jpeg', 0.8)
    }
    const size = det?.result.gridSize ?? null
    if (!face && size !== null && size !== 3) {
      setPhoto({ status: 'done', thumb, message: `Ảnh này là khối ${size}x${size}, bạn đang chọn khối 3x3. Đổi Size cho đúng.` })
      return
    }
    const session = sessionRef.current
    const expected = session.currentTarget
    const fb = session.pushStill(face, det?.result.sharpness ?? 0)
    setFeedback(fb)
    if (fb.captured) setFaces({ ...session.faces })
    const message = fb.captured
      ? null
      : fb.phase === 'duplicate' && fb.seenFace
        ? `Ảnh này là mặt ${label(fb.seenFace)} đã quét rồi.`
        : fb.phase === 'wrongFace' && fb.seenFace && expected
          ? `Đây là mặt ${label(fb.seenFace)}, hãy đưa mặt ${label(expected)} vào.`
          : fb.phase === 'blurry'
            ? 'Ảnh bị mờ, hãy chụp lại.'
            : 'Không tìm thấy đủ lưới 3×3. Chụp thẳng vào mặt khối, gần hơn và đủ sáng.'
    setPhoto({ status: 'done', thumb, message })
  }

  const analyse = async (load: () => Promise<PhotoDetection | null>) => {
    setPhoto({ status: 'working' })
    try {
      handleStill(await load())
    } catch (e) {
      setPhoto({ status: 'done', thumb: '', message: `Không đọc được ảnh: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  const onPhoto = (file: File | undefined) => {
    if (file && vision) void analyse(() => detectFaceInPhoto(file, vision))
  }

  /** Takes a still from the live camera and analyses it like a photo. */
  const shoot = async () => {
    const still = grabStillRef.current?.()
    if (still && vision) await analyse(() => detectFaceInStill(still, vision))
  }
  const shootRef = useRef(shoot)
  shootRef.current = shoot

  // Webcam mode: count down 3-2-1 while an acceptable face is in view, then shoot a still.
  useEffect(() => {
    const auto = autoRef.current
    frameHandlerRef.current = (r: ScheduledResult) => {
      const session = sessionRef.current
      if (latest.current.mode !== 'webcam' || !session.currentTarget) {
        auto.reset()
        setCountdown(null)
        return
      }
      const grid = r.result.gridSize
      wrongSizeFrames.current = grid !== null && grid !== 3 ? wrongSizeFrames.current + 1 : 0
      setWrongSize(wrongSizeFrames.current >= 3 ? grid : null)
      const check = session.check(r.result.face, r.result.sharpness, 5)
      setLive(check)
      const now = performance.now()
      if (auto.update(now, check === null)) {
        void shootRef.current().finally(() => auto.finish(performance.now()))
      }
      setCountdown(auto.secondsLeft(now))
    }
    return () => {
      frameHandlerRef.current = null
      auto.reset()
    }
  }, [frameHandlerRef])

  useEffect(() => {
    onOverlay(countdown != null ? String(countdown) : null)
  }, [countdown, onOverlay])
  useEffect(() => () => onOverlay(null), [onOverlay])

  const confirm = () => {
    if (!finalFacelets || !validation?.ok) return
    onConfirm(finalFacelets, scheme)
  }

  const target = feedback.target
  // The net follows how the cube is held for the face being scanned; once done it stays on the last hold.
  const lastHold = useRef<Hold>(stepFor('F').hold)
  if (target) lastHold.current = stepFor(target).hold
  const hold = lastHold.current
  const scanning = target !== null
  let status = ''
  if (scanning) {
    if (photo.status === 'working') status = 'Đang phân tích ảnh...'
    else if (countdown != null) status = `Giữ yên — tự chụp sau ${countdown} giây.`
    else if (live?.phase === 'blurry') status = 'Ảnh bị mờ, giữ yên khối.'
    else if (live?.phase === 'duplicate' && live.seenFace) status = `Mặt ${label(live.seenFace)} đã quét rồi — xoay sang mặt ${label(target)}.`
    else if (live?.phase === 'wrongFace' && live.seenFace) status = `Đây là mặt ${label(live.seenFace)} — hãy đưa mặt ${label(target)} vào.`
    else status = `Đưa mặt ${label(target)} vào khung, tự chụp sau 3 giây.`
  }
  const rescanning = target !== null && faces[target] !== undefined

  return (
    <div className="scan">
      <div className="rb-seg" role="tablist" aria-label="Chế độ quét">
        {(['webcam', 'photo'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className="rb-seg__item"
            onClick={() => onModeChange(m)}
          >
            {m === 'webcam' ? 'Webcam' : 'Chụp ảnh'}
          </button>
        ))}
      </div>
      <SchemePicker settings={schemeSettings} onChange={onSchemeSettings} scheme={scheme} learned={learned} />
      {photo.status === 'done' && photo.thumb && (mode === 'photo' || photo.message) && (
        <img className="scan-photo" src={photo.thumb} alt="Ảnh vừa chụp và lưới phát hiện được" />
      )}
      {scanning ? (
        <div className="scan-step">
          <div className="scan-step-title" style={{ fontSize: '16px', fontWeight: 600 }}>
            <span className="scan-swatch" style={{ background: scheme[target].css }} />
            Mặt {label(target)} · {SCAN_ORDER.filter((f) => faces[f]).length}/6
          </div>
          <div className="scan-step-text" style={{ fontSize: '13px', color: 'var(--rb-text-muted)' }}>
            {stepFor(target).instruction(label)}
          </div>
          {rescanning && (
            <div className="scan-rescan">
              <span className="scan-status">Mặt này đã quét — lần chụp tiếp theo sẽ ghi đè.</span>
              <button type="button" className="rb-btn rb-btn--ghost" onClick={() => clearFace(target)}>
                Quét lại mặt này
              </button>
            </div>
          )}
          {mode === 'webcam' ? (
            <>
              {wrongSize !== null ? (
                <div className="rb-alert">
                  Camera thấy khối {wrongSize}x{wrongSize}, bạn đang chọn khối 3x3. Đổi Size cho đúng.
                </div>
              ) : (
                <div className="scan-status">{status}</div>
              )}
              {photo.status === 'done' && photo.message && <div className="rb-alert">{photo.message}</div>}
            </>
          ) : (
            <>
              {canShutter && (
                <button
                  type="button"
                  className="rb-btn rb-btn--primary rb-btn--block"
                  onClick={() => void shoot()}
                  disabled={!vision || photo.status === 'working'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  {photo.status === 'working' ? 'Đang phân tích ảnh...' : `Chụp mặt ${label(target)}`}
                </button>
              )}
              <label className={`rb-btn ${canShutter ? 'rb-btn--ghost' : 'rb-btn--primary'} rb-btn--block`} aria-disabled={!vision || photo.status === 'working'}>
                {photo.status === 'working' && !canShutter
                  ? 'Đang phân tích ảnh...'
                  : canShutter
                    ? 'Chọn ảnh từ máy'
                    : `Chụp / chọn ảnh mặt ${label(target)}`}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={!vision || photo.status === 'working'}
                  onChange={(e) => {
                    onPhoto(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
              {photo.status === 'done' && photo.message && <div className="rb-alert">{photo.message}</div>}
            </>
          )}
        </div>
      ) : (
        <div className="scan-step">
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--rb-text)' }}>Kiểm tra màu</div>
          <div style={{ fontSize: '13px', color: 'var(--rb-text-muted)', margin: '4px 0 12px' }}>
            Đã quét 6/6 mặt · chạm ô để sửa
          </div>

          {analysis.status === 'running' && <div className="scan-status">Đang phân tích...</div>}
          {analysis.status === 'done' && !analysis.result.ok && (
            <div className="rb-alert" style={{ marginBottom: '10px' }}>
              Mặt {label(analysis.result.faces[0])} và mặt {label(analysis.result.faces[1])} có màu tâm giống
              nhau. Hãy quét lại một trong hai mặt.
            </div>
          )}
          {result && validation && !validation.ok && (
            <div className="rb-alert" style={{ marginBottom: '10px' }}>
              {validation.errors
                .map((e) => describeError(e, label))
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(' ')}
            </div>
          )}
          {result?.alternative && (
            <div className="rb-alert" style={{ marginBottom: '10px' }}>
              Có hai cách đọc gần giống nhau — kiểm tra các ô viền vàng và bấm để sửa nếu sai.
            </div>
          )}
          {result && result.changed.length > 0 && (
            <div className="rb-alert" style={{ marginBottom: '10px' }}>
              Đã tự sửa {result.changed.length} ô theo luật của khối. Kiểm tra lại trước khi tiếp tục.
            </div>
          )}
          {result && result.lowConfidence.length > 0 && (
            <div className="rb-alert" style={{ marginBottom: '10px' }}>
              {result.lowConfidence.length} ô có độ tin cậy thấp — kiểm tra các ô viền cam.
            </div>
          )}
          {validation?.ok && !result?.alternative && (!result || result.changed.length === 0) && (
            <div style={{ fontSize: '13px', color: 'var(--rb-text-muted)', marginBottom: '10px' }}>
              Trạng thái hợp lệ.
            </div>
          )}

          {/* Lưới 3x3 của mặt đang chọn */}
          <div style={{ textAlign: 'center', margin: '8px 0' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--rb-text-soft)', marginBottom: '8px' }}>
              Mặt {label(selectedReviewFace)} (chạm ô để chọn)
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 64px)',
                gap: '8px',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              {Array.from({ length: 9 }, (_, k) => {
                const fi = FACES.indexOf(selectedReviewFace)
                const globalIdx = fi * 9 + k
                const cell = cells[globalIdx]
                const isSelected = selectedReviewCell === k
                const isLow = cell?.mark === 'uncertain'
                const isChanged = cell?.mark === 'changed'
                return (
                  <button
                    key={k}
                    type="button"
                    className={`rb-sticker rb-sticker--sm${isLow ? ' rb-sticker--low' : ''}${isChanged ? ' rb-sticker--changed' : ''}`}
                    aria-pressed={isSelected}
                    style={{ background: cell?.color ?? 'transparent' }}
                    onClick={() => setSelectedReviewCell(k)}
                    aria-label={`${k === 4 ? 'Ô tâm' : `Ô ${k + 1}`} mặt ${label(selectedReviewFace)}`}
                  />
                )
              })}
            </div>
          </div>

          {/* Bảng chọn màu 6 nút 44px */}
          <div style={{ textAlign: 'center', margin: '12px 0 16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--rb-text-subtle)', marginBottom: '8px' }}>
              {selectedReviewCell === 4
                ? 'Ô tâm quyết định màu mặt (không thể sửa)'
                : 'Đổi ô đang chọn thành:'}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {FACES.map((f) => (
                <button
                  key={f}
                  type="button"
                  disabled={selectedReviewCell === 4}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--rb-r-md)',
                    background: scheme[f].css,
                    border: '2px solid var(--rb-border-strong)',
                    cursor: selectedReviewCell === 4 ? 'not-allowed' : 'pointer',
                    opacity: selectedReviewCell === 4 ? 0.4 : 1,
                  }}
                  title={scheme[f].label}
                  aria-label={`Đổi thành màu ${scheme[f].label}`}
                  onClick={() => {
                    if (selectedReviewCell === 4) return
                    const fi = FACES.indexOf(selectedReviewFace)
                    const globalIdx = fi * 9 + selectedReviewCell
                    setEdits((prev) => ({ ...prev, [globalIdx]: f }))
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6 face progress chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', margin: '12px 0' }}>
        {SCAN_ORDER.map((f) => {
          const isDone = faces[f] !== undefined
          const isCurrent = (scanning ? target : selectedReviewFace) === f
          return (
            <button
              key={f}
              type="button"
              className={`rb-face${isDone ? ' rb-face--done' : ''}${isCurrent ? ' rb-face--current' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
              onClick={() => {
                if (!scanning) {
                  setSelectedReviewFace(f)
                  setSelectedReviewCell(0)
                } else {
                  select(f)
                }
              }}
              title={`Mặt ${label(f)}`}
            >
              <span
                className={`rb-face__swatch${isDone ? ' rb-face__swatch--done' : ''}`}
                style={
                  isDone
                    ? { background: scheme[f]?.css ?? 'transparent' }
                    : { background: 'transparent', border: `1.5px solid ${scheme[f]?.css ?? 'var(--rb-border)'}` }
                }
              >
                {isDone && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              <span>{label(f)}</span>
            </button>
          )
        })}
      </div>

      {!scanning && (
        <ScanNet
          cells={cells}
          hold={hold}
          activeFace={selectedReviewFace}
          onCellClick={onCellClick}
          onFaceClick={(f) => {
            setSelectedReviewFace(f)
            setSelectedReviewCell(0)
          }}
        />
      )}

      <div className="scan-legend">
        {result
          ? 'Chọn mặt ở sơ đồ hoặc thanh trên, chạm ô rồi chọn màu bên dưới.'
          : 'Bấm vào một mặt để chọn quét lại mặt đó.'}
      </div>

      <div className="scan-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button type="button" className="rb-btn rb-btn--ghost" onClick={restart} aria-label="Quét lại từ đầu">
          Quét lại
        </button>
        {result ? (
          <button
            type="button"
            className="rb-btn rb-btn--primary"
            style={{ flex: 1 }}
            onClick={confirm}
            disabled={!validation?.ok}
          >
            {confirmLabel}
          </button>
        ) : mode === 'webcam' ? (
          <button
            type="button"
            className="rb-btn rb-btn--primary"
            style={{ flex: 1 }}
            onClick={() => void shoot()}
            disabled={!vision || photo.status === 'working'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Chụp ngay
          </button>
        ) : null}
      </div>

      {onSkipScan && (
        <div style={{ textAlign: 'center', marginTop: '6px' }}>
          <button type="button" className="rb-btn rb-btn--link" onClick={onSkipScan}>
            Bỏ qua quét — giải khối đang hiển thị
          </button>
        </div>
      )}
    </div>
  )
}

