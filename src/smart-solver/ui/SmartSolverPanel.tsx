import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CubeController } from '../adapter/types'
import { fromFacelets } from '../core/facelets'
import { FACES, type Face, type ValidationError } from '../core/types'
import type { ScheduledResult } from '../camera/FrameScheduler'
import { reconstruct, type ReconstructResult, type ScanInput } from '../scan/reconstruct'
import { SCAN_ORDER, ScanSession, type FaceScan, type ScanFeedback } from '../scan/ScanSession'
import type { Lab } from '../vision/color'
import CameraPanel from './CameraPanel'
import FaceletNet, { type NetCell } from './FaceletNet'
import { PALETTE, STANDARD_COLOR, nameCenters, previewColor, type ColorName } from './palette'

const POSITION_NAME: Record<Face, string> = { F: 'trước', R: 'phải', B: 'sau', L: 'trái', U: 'trên', D: 'dưới' }

const INSTRUCTION: Record<Face, string> = {
  F: 'Hướng mặt xanh lá vào camera, mặt trắng ở trên.',
  R: 'Xoay cả khối sang trái 90°: mặt đỏ vào camera, trắng vẫn ở trên.',
  B: 'Tiếp tục xoay sang trái: mặt xanh dương vào camera.',
  L: 'Tiếp tục xoay sang trái: mặt cam vào camera.',
  U: 'Quay lại mặt xanh lá, rồi lật khối về phía bạn: mặt trắng vào camera, xanh lá ở dưới.',
  D: 'Lật ngược lại: mặt vàng vào camera, xanh lá ở trên.'
}

function describeError(e: ValidationError, colorOf: (f: Face) => ColorName): string {
  switch (e.kind) {
    case 'colorCount':
      return `Màu ${PALETTE[colorOf(e.face)].label} có ${e.count} ô (cần 9).`
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

export interface SmartSolverPanelProps {
  onClose: () => void
  getController: () => CubeController | null
}

type Analysis = { status: 'idle' } | { status: 'running' } | { status: 'done'; result: ReconstructResult }

export default function SmartSolverPanel({ onClose, getController }: SmartSolverPanelProps) {
  const sessionRef = useRef<ScanSession>(new ScanSession())
  const [feedback, setFeedback] = useState<ScanFeedback>({ phase: 'searching', target: 'F', progress: 0, captured: null, seenFace: null })
  const [faces, setFaces] = useState<Partial<Record<Face, FaceScan>>>({})
  const [analysis, setAnalysis] = useState<Analysis>({ status: 'idle' })
  const [edits, setEdits] = useState<Record<number, Face>>({})
  const [applied, setApplied] = useState<string | null>(null)

  const onResult = useCallback((r: ScheduledResult) => {
    const session = sessionRef.current
    const fb = session.push(r.result.face, r.result.sharpness)
    setFeedback(fb)
    if (fb.captured) setFaces({ ...session.faces })
  }, [])

  // Re-analyse whenever the set of scanned faces changes and all six are present.
  useEffect(() => {
    setEdits({})
    setApplied(null)
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
  const names = useMemo(() => nameCenters(centers), [centers])
  const colorOf = useCallback((f: Face): ColorName => names[f] ?? STANDARD_COLOR[f], [names])
  const standardScheme = SCAN_ORDER.every((f) => names[f] === STANDARD_COLOR[f])

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
        color: PALETTE[colorOf(label as Face)].css,
        mark: edits[i] !== undefined ? null : changed.has(i) ? 'changed' : suspicious.has(i) ? 'uncertain' : null
      }))
    }
    // Before analysis: each scanned sticker shown in the standard color it most likely is.
    return FACES.flatMap((face) =>
      Array.from({ length: 9 }, (_, k) => {
        const lab = faces[face]?.labs[k]
        const name = k === 4 ? names[face] : lab ? previewColor(lab, centers, names) : undefined
        return { color: name ? PALETTE[name].css : null, mark: null }
      })
    )
  }, [result, finalFacelets, faces, edits, centers, names, colorOf])

  const cycleCell = (index: number) => {
    if (!finalFacelets) return
    const current = finalFacelets[index] as Face
    const next = FACES[(FACES.indexOf(current) + 1) % FACES.length] as Face
    setApplied(null)
    setEdits((prev) => ({ ...prev, [index]: next }))
  }

  const rescan = (face: Face) => {
    sessionRef.current.setTarget(face)
    setFeedback((fb) => ({ ...fb, target: face, phase: 'searching', progress: 0 }))
  }

  const restart = () => {
    sessionRef.current.reset()
    setFaces({})
    setFeedback({ phase: 'searching', target: 'F', progress: 0, captured: null, seenFace: null })
  }

  const apply = () => {
    const controller = getController()
    if (!finalFacelets || !controller) {
      setApplied('Khối 3D phải ở kích thước 3x3.')
      return
    }
    const r = controller.setFacelets(finalFacelets)
    setApplied(r.ok ? 'Đã đồng bộ lên khối 3D.' : r.reason === 'busy' ? 'Khối 3D đang xoay, thử lại sau giây lát.' : 'Trạng thái không hợp lệ.')
  }

  const target = feedback.target
  const scanning = target !== null
  let status = ''
  if (scanning) {
    if (feedback.phase === 'holding') status = `Giữ yên... ${Math.round(feedback.progress * 100)}%`
    else if (feedback.phase === 'blurry') status = 'Ảnh bị mờ, giữ yên khối.'
    else if (feedback.phase === 'duplicate' && feedback.seenFace)
      status = `Mặt ${PALETTE[colorOf(feedback.seenFace)].label} đã quét rồi.`
    else status = 'Đưa mặt rubik vào khung.'
  }

  return (
    <CameraPanel title="Quét rubik" onClose={onClose} onResult={onResult}>
      <div className="scan">
        {scanning ? (
          <div className="scan-step">
            <div className="scan-step-title">
              <span className="scan-swatch" style={{ background: PALETTE[colorOf(target)].css }} />
              Mặt {PALETTE[colorOf(target)].label} ({POSITION_NAME[target]}) · {SCAN_ORDER.filter((f) => faces[f]).length}/6
            </div>
            <div className="scan-step-text">{INSTRUCTION[target]}</div>
            <div className="scan-progress">
              <div className="scan-progress-bar" style={{ width: `${feedback.progress * 100}%` }} />
            </div>
            <div className="scan-status">{status}</div>
          </div>
        ) : (
          <div className="scan-step">
            <div className="scan-step-title">Đã quét đủ 6 mặt</div>
            {analysis.status === 'running' && <div className="scan-status">Đang phân tích...</div>}
            {analysis.status === 'done' && !analysis.result.ok && (
              <div className="scan-error">
                Mặt {POSITION_NAME[analysis.result.faces[0]]} và mặt {POSITION_NAME[analysis.result.faces[1]]} có màu tâm giống
                nhau. Hãy quét lại một trong hai mặt.
              </div>
            )}
            {result && validation && !validation.ok && (
              <div className="scan-error">
                {validation.errors
                  .map((e) => describeError(e, colorOf))
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .join(' ')}
              </div>
            )}
            {result && validation?.ok && (
              <div className="scan-status">
                {result.alternative
                  ? 'Có hai cách đọc gần giống nhau — kiểm tra các ô viền vàng và bấm để sửa nếu sai.'
                  : result.changed.length
                    ? `Đã tự sửa ${result.changed.length} ô theo luật của khối (viền cam). Kiểm tra lại trước khi áp dụng.`
                    : 'Trạng thái hợp lệ.'}
              </div>
            )}
            {result && !standardScheme && (
              <div className="scan-status">Bố cục màu của khối khác chuẩn; khối 3D sẽ hiển thị theo màu chuẩn.</div>
            )}
          </div>
        )}

        <FaceletNet cells={cells} activeFace={target} onCellClick={cycleCell} onFaceClick={rescan} />
        <div className="scan-legend">Bấm ô tâm để quét lại mặt đó{result ? ', bấm ô khác để đổi màu' : ''}.</div>

        <div className="scan-actions">
          <button className="reset" onClick={restart}>
            Quét lại từ đầu
          </button>
          <button className="scramble" onClick={apply} disabled={!validation?.ok}>
            Áp dụng lên khối 3D
          </button>
        </div>
        {applied && <div className="scan-status">{applied}</div>}
      </div>
    </CameraPanel>
  )
}
