import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { FACES, type Face } from '../core/types'
import type { ScheduledResult } from '../camera/FrameScheduler'
import { detectFaceInPhoto, detectFaceInStill, type PhotoDetection } from '../camera/photo'
import type { CubeSize } from '../nxn/engine'
import { InvalidCubeError, normalize, toCubeState } from '../nxn/state'
import { AutoCapture } from '../scan/autoCapture'
import { reconstructNxn, type NxnReconstruction } from '../scan/reconstructNxn'
import { SCAN_ORDER, ScanSession, type FaceScan, type ScanFeedback } from '../scan/ScanSession'
import { EVEN_INSTRUCTIONS, stepFor, type Hold } from '../scan/scanGuide'
import type { VisionClient } from '../vision/VisionClient'
import { drawLattice } from './overlay'
import ScanNet, { type NetCell } from './ScanNet'
import { buildScheme, previewFace, wrongCenter, type Scheme, type SchemeSettings } from './palette'
import SchemePicker from './SchemePicker'
import type { ScanMode } from './ScanView'

type PhotoState = { status: 'idle' } | { status: 'working' } | { status: 'done'; thumb: string; message: string | null }

export interface NxnScanViewProps {
  n: CubeSize
  mode: ScanMode
  onModeChange: (mode: ScanMode) => void
  vision: VisionClient | null
  frameHandlerRef: MutableRefObject<((r: ScheduledResult) => void) | null>
  grabStillRef: MutableRefObject<(() => HTMLCanvasElement | null) | null>
  canShutter: boolean
  onOverlay: (text: string | null) => void
  /** Called with valid stickers (labels = faces of `scheme`, URFDLB) and the colors to paint them. */
  onConfirm: (stickers: Uint8Array, scheme: Scheme) => void
  schemeSettings: SchemeSettings
  onSchemeSettings: (settings: SchemeSettings) => void
}

/**
 * Six-face scan of a 2x2, 4x4 or 5x5: same holds and capture as the 3x3 scan, colors read by a
 * balanced assignment (n² stickers per color) and checked by the solver's validation.
 */
export default function NxnScanView({
  n,
  mode,
  onModeChange,
  vision,
  frameHandlerRef,
  grabStillRef,
  canShutter,
  onOverlay,
  onConfirm,
  schemeSettings,
  onSchemeSettings
}: NxnScanViewProps) {
  const odd = n % 2 === 1
  const per = n * n
  const scheme = useMemo(() => buildScheme(schemeSettings), [schemeSettings])
  const schemeRef = useRef(scheme)
  schemeRef.current = scheme
  const sessionRef = useRef<ScanSession>(
    new ScanSession({
      n,
      // Only odd cubes have a center color to tell faces apart.
      identify: odd ? (center, target, scanned) => wrongCenter(center, target, scanned, schemeRef.current) : undefined
    })
  )
  const autoRef = useRef(new AutoCapture())
  const [live, setLive] = useState<ScanFeedback | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [wrongSize, setWrongSize] = useState<number | null>(null)
  const wrongSizeFrames = useRef(0)
  const [feedback, setFeedback] = useState<ScanFeedback>({ phase: 'searching', target: 'F', progress: 0, captured: null, seenFace: null })
  const [faces, setFaces] = useState<Partial<Record<Face, FaceScan>>>({})
  const [edits, setEdits] = useState<Record<number, number>>({})
  const [photo, setPhoto] = useState<PhotoState>({ status: 'idle' })
  const latestMode = useRef(mode)
  latestMode.current = mode

  /** Face name in messages: its color for odd cubes, its number in scan order for even ones. */
  const label = (f: Face) => (odd ? scheme[f].label : `${SCAN_ORDER.indexOf(f) + 1}`)

  const reading: NxnReconstruction | null = useMemo(() => {
    if (!SCAN_ORDER.every((f) => faces[f])) return null
    const labs = Object.fromEntries(FACES.map((f) => [f, (faces[f] as FaceScan).labs])) as Record<Face, FaceScan['labs']>
    const refs = Object.fromEntries(FACES.map((f) => [f, scheme[f].ref])) as Record<Face, Scheme[Face]['ref']>
    return reconstructNxn(n, labs, refs)
  }, [faces, n, scheme])
  useEffect(() => setEdits({}), [faces])

  const stickers = useMemo(() => {
    if (!reading) return null
    const out = Uint8Array.from(reading.stickers)
    Object.entries(edits).forEach(([i, label]) => (out[Number(i)] = label))
    return out
  }, [reading, edits])

  const error = useMemo(() => {
    if (!stickers) return null
    try {
      normalize(n, toCubeState(stickers, n))
      return null
    } catch (e) {
      return e instanceof InvalidCubeError ? e.message : String(e)
    }
  }, [stickers, n])

  const cells: NetCell[] = useMemo(() => {
    if (stickers && reading) {
      const unsure = new Set(reading.lowConfidence)
      return Array.from(stickers, (label, i) => ({
        color: scheme[FACES[label] as Face].css,
        mark: edits[i] === undefined && unsure.has(i) ? 'uncertain' : null
      }))
    }
    // Before all six faces are in: each sticker in the color it most likely is.
    const center = odd ? (per - 1) / 2 : -1
    const centers: Partial<Record<Face, FaceScan['labs'][number]>> = {}
    if (odd) FACES.forEach((f) => faces[f] && (centers[f] = faces[f]?.labs[center]))
    return FACES.flatMap((face) =>
      Array.from({ length: per }, (_, k) => {
        // Odd cubes, as the 3x3: the fixed center shows its face's color even before the face is scanned.
        if (k === center) return { color: scheme[face].css, mark: null }
        const lab = faces[face]?.labs[k]
        return { color: lab ? scheme[previewFace(lab, centers, scheme)].css : null, mark: null }
      })
    )
  }, [stickers, reading, edits, faces, scheme, odd, per])

  const select = (face: Face) => {
    sessionRef.current.setTarget(face)
    autoRef.current.reset()
    setPhoto({ status: 'idle' })
    setFeedback((fb) => ({ ...fb, target: face, phase: 'searching', progress: 0 }))
  }

  const onCellClick = (index: number) => {
    if (!stickers) {
      select(FACES[Math.floor(index / per)] as Face)
      return
    }
    setEdits((prev) => ({ ...prev, [index]: ((stickers[index] as number) + 1) % 6 }))
  }

  const restart = () => {
    sessionRef.current.reset()
    autoRef.current.reset()
    setFaces({})
    setPhoto({ status: 'idle' })
    setFeedback({ phase: 'searching', target: 'F', progress: 0, captured: null, seenFace: null })
  }

  const handleStill = (det: PhotoDetection | null) => {
    const face = det?.result.face ?? null
    let thumb = ''
    if (det) {
      const ctx = det.crop.getContext('2d')
      if (ctx && face) drawLattice(ctx, face)
      thumb = det.crop.toDataURL('image/jpeg', 0.8)
    }
    const size = det?.result.gridSize ?? null
    if (!face && size !== null && size !== n) {
      setPhoto({ status: 'done', thumb, message: `Ảnh này là khối ${size}x${size}, bạn đang chọn khối ${n}x${n}. Đổi Size cho đúng.` })
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
            : `Không tìm thấy đủ lưới ${n}×${n}. Chụp thẳng vào mặt khối, gần hơn và đủ sáng.`
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
      if (latestMode.current !== 'webcam' || !session.currentTarget) {
        auto.reset()
        setCountdown(null)
        return
      }
      const grid = r.result.gridSize
      wrongSizeFrames.current = grid !== null && grid !== n ? wrongSizeFrames.current + 1 : 0
      setWrongSize(wrongSizeFrames.current >= 3 ? grid : null)
      const check = session.check(r.result.face, r.result.sharpness)
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
  }, [frameHandlerRef, n])

  useEffect(() => {
    onOverlay(countdown != null ? String(countdown) : null)
  }, [countdown, onOverlay])
  useEffect(() => () => onOverlay(null), [onOverlay])

  const target = feedback.target
  const lastHold = useRef<Hold>(stepFor('F').hold)
  if (target) lastHold.current = stepFor(target).hold
  const scanning = target !== null
  let status = ''
  if (scanning) {
    if (photo.status === 'working') status = 'Đang phân tích ảnh...'
    else if (countdown != null) status = `Giữ yên — tự chụp sau ${countdown} giây.`
    else if (live?.phase === 'blurry') status = 'Ảnh bị mờ, giữ yên khối.'
    else if (live?.phase === 'duplicate' && live.seenFace) status = `Mặt ${label(live.seenFace)} đã quét rồi — xoay sang mặt ${label(target)}.`
    else if (live?.phase === 'wrongFace' && live.seenFace) status = `Đây là mặt ${label(live.seenFace)} — hãy đưa mặt ${label(target)} vào.`
    else status = `Đưa mặt ${label(target)} vào khung (lưới ${n}×${n}), tự chụp sau 3 giây.`
  }

  return (
    <div className="scan">
      <div className="scan-mode" role="tablist">
        {(['webcam', 'photo'] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'active' : ''} onClick={() => onModeChange(m)}>
            {m === 'webcam' ? 'Webcam' : 'Chụp ảnh'}
          </button>
        ))}
      </div>
      <SchemePicker settings={schemeSettings} onChange={onSchemeSettings} scheme={scheme} learned={[]} />
      {photo.status === 'done' && photo.thumb && (mode === 'photo' || photo.message) && (
        <img className="scan-photo" src={photo.thumb} alt="Ảnh vừa chụp và lưới phát hiện được" />
      )}
      {scanning ? (
        <div className="scan-step">
          <div className="scan-step-title">
            {odd && <span className="scan-swatch" style={{ background: scheme[target].css }} />}
            Mặt {label(target)} · {SCAN_ORDER.filter((f) => faces[f]).length}/6
          </div>
          <div className="scan-step-text">{odd ? stepFor(target).instruction(label) : EVEN_INSTRUCTIONS[target]}</div>
          {faces[target] && <div className="scan-status">Mặt này đã quét — lần chụp tiếp theo sẽ ghi đè.</div>}
          {mode === 'webcam' ? (
            wrongSize !== null ? (
              <div className="scan-error">
                Camera thấy khối {wrongSize}x{wrongSize}, bạn đang chọn khối {n}x{n}. Đổi Size cho đúng.
              </div>
            ) : (
              <div className="scan-status">{status}</div>
            )
          ) : (
            <>
              {canShutter && (
                <button className="scramble" onClick={() => void shoot()} disabled={!vision || photo.status === 'working'}>
                  {photo.status === 'working' ? 'Đang phân tích ảnh...' : `Chụp mặt ${label(target)}`}
                </button>
              )}
              <label className={`${canShutter ? 'reset' : 'scramble'} scan-photo-button${!vision || photo.status === 'working' ? ' disabled' : ''}`}>
                {canShutter ? 'Chọn ảnh từ máy' : `Chụp / chọn ảnh mặt ${label(target)}`}
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
            </>
          )}
          {photo.status === 'done' && photo.message && <div className="scan-error">{photo.message}</div>}
        </div>
      ) : (
        <div className="scan-step">
          <div className="scan-step-title">Đã quét đủ 6 mặt</div>
          {error ? (
            <div className="scan-error">{error} Bấm vào ô sai để đổi màu, hoặc quét lại mặt đó.</div>
          ) : (
            <div className="scan-status">
              {reading?.lowConfidence.length
                ? 'Kiểm tra các ô viền vàng (màu khó phân biệt), bấm để sửa nếu sai.'
                : 'Màu các mặt hợp lệ.'}
            </div>
          )}
        </div>
      )}

      <ScanNet n={n} cells={cells} hold={lastHold.current} activeFace={target} onCellClick={onCellClick} onFaceClick={select} />
      <div className="scan-faces">
        {SCAN_ORDER.map((f) => (
          <button key={f} className={f === target ? 'active' : ''} onClick={() => select(f)} title="Quét lại mặt này">
            {odd ? scheme[f].label : `Mặt ${label(f)}`}
          </button>
        ))}
      </div>
      <div className="scan-legend">
        {stickers ? 'Bấm một ô để đổi màu; bấm tên mặt để quét lại mặt đó.' : 'Bấm vào một mặt để chọn quét lại mặt đó.'}
      </div>

      <div className="scan-actions">
        <button className="reset" onClick={restart}>
          Quét lại từ đầu
        </button>
        <button className="scramble" onClick={() => stickers && !error && onConfirm(stickers, scheme)} disabled={!stickers || !!error}>
          Áp lên khối 3D
        </button>
      </div>
    </div>
  )
}
