import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { CubeController } from '../adapter/types'
import type { ScheduledResult } from '../camera/FrameScheduler'
import { fromFacelets, toFacelets } from '../core/facelets'
import type { Face, Facelets, Move } from '../core/types'
import { INITIAL_GUIDE_STATE, expectedMove, guideReducer, needsSolve, wantsOptimal, type GuidePhase } from '../guidance/fsm'
import { SolverClient } from '../solver/SolverClient'
import { VisionClient } from '../vision/VisionClient'
import CameraPanel from './CameraPanel'
import GuideView, { type OptimalStatus } from './GuideView'
import { STANDARD_COLOR, type ColorName } from './palette'
import ScanView, { type ScanMode } from './ScanView'

const PHASE_SUMMARY: Record<GuidePhase, string> = {
  IDLE: 'Sẵn sàng',
  SCANNING: 'Đang quét các mặt',
  REVIEWING: 'Kiểm tra trạng thái trên khối 3D',
  SOLVING: 'Đang tính lời giải...',
  GUIDING: 'Đang hướng dẫn',
  RECOVERING: 'Đang hướng dẫn',
  VERIFYING: 'Chờ quét xác nhận',
  COMPLETED: 'Hoàn thành!',
  ERROR: 'Có lỗi — mở rộng để xem'
}

const SCAN_MODE_KEY = 'smart-solver.scanMode'

function loadScanMode(): ScanMode {
  try {
    return localStorage.getItem(SCAN_MODE_KEY) === 'photo' ? 'photo' : 'webcam'
  } catch {
    return 'webcam'
  }
}

function saveScanMode(mode: ScanMode) {
  try {
    localStorage.setItem(SCAN_MODE_KEY, mode)
  } catch {
    // Storage can be unavailable (private mode); the choice just isn't remembered.
  }
}

export interface SmartSolverPanelProps {
  /** Closed panels stay mounted (camera off) so the scan and guidance survive reopening. */
  open: boolean
  /** Where the panel header goes (the controls row next to Size and Quét). */
  headerSlot: HTMLElement | null
  /** Must be stable across renders: effects subscribe through it. */
  getController: () => CubeController | null
}

export default function SmartSolverPanel({ open, headerSlot, getController }: SmartSolverPanelProps) {
  const [guide, dispatch] = useReducer(guideReducer, { ...INITIAL_GUIDE_STATE, phase: 'SCANNING' })
  const [colors, setColors] = useState<Record<Face, ColorName>>(STANDARD_COLOR)
  const [notice, setNotice] = useState<string | null>(null)
  const frameHandlerRef = useRef<((r: ScheduledResult) => void) | null>(null)
  const grabStillRef = useRef<(() => HTMLCanvasElement | null) | null>(null)
  const [overlay, setOverlay] = useState<string | null>(null)
  // Desktops get a live preview with a shutter button in photo mode; phones use the camera app.
  const [canShutter] = useState(() => window.matchMedia?.('(pointer: fine)').matches ?? false)
  const solverRef = useRef<SolverClient | null>(null)
  const [vision, setVision] = useState<VisionClient | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [scanMode, setScanMode] = useState<ScanMode>(loadScanMode)
  useEffect(() => saveScanMode(scanMode), [scanMode])
  /** Last proven-shortest search: which step it was for, and how it went. */
  const [optimalJob, setOptimalJob] = useState<{ key: string; status: 'running' | 'done' | 'failed' } | null>(null)

  useEffect(() => {
    const client = new VisionClient()
    setVision(client)
    return () => client.dispose()
  }, [])

  useEffect(() => {
    const solver = new SolverClient()
    solverRef.current = solver
    return () => {
      solver.dispose()
      solverRef.current = null
    }
  }, [])

  // One solver job per epoch; results for older epochs are dropped by the reducer.
  useEffect(() => {
    if (!needsSolve(guide) || !guide.cube || !solverRef.current) return
    const epoch = guide.epoch
    solverRef.current
      .solve(guide.cube)
      .then((r) => dispatch({ type: 'SOLVED', epoch, moves: r.moves, ms: r.ms }))
      .catch((e: unknown) => {
        if (e instanceof Error && e.message === 'solver disposed') return
        dispatch({ type: 'SOLVE_FAILED', epoch, message: e instanceof Error ? e.message : String(e) })
      })
  }, [guide.epoch, guide.phase])

  // Proven-shortest search for the current step, one job at a time; stale results are dropped by the reducer.
  const stepKey = `${guide.epoch}:${guide.index}`
  useEffect(() => {
    const solver = solverRef.current
    if (!solver || !guide.cube || !wantsOptimal(guide)) return
    if (optimalJob?.status === 'running' || optimalJob?.key === stepKey) return
    const { epoch, index } = guide
    setOptimalJob({ key: stepKey, status: 'running' })
    solver
      .solveOptimal(guide.cube, { timeoutMs: 3000 })
      .then((r) => {
        setOptimalJob({ key: stepKey, status: r.moves ? 'done' : 'failed' })
        if (r.moves) dispatch({ type: 'OPTIMAL_FOUND', epoch, index, moves: r.moves })
      })
      .catch(() => setOptimalJob({ key: stepKey, status: 'failed' }))
  }, [guide, optimalJob, stepKey])

  const optimalStatus: OptimalStatus = guide.optimal
    ? 'proven'
    : optimalJob?.status === 'running'
      ? 'searching'
      : 'unproven'

  const expected = expectedMove(guide)
  useEffect(() => {
    getController()?.highlight(expected)
  }, [expected, getController])
  useEffect(() => () => getController()?.highlight(null), [getController])

  // Turns dragged on the 3D cube count as turns on the real cube.
  useEffect(() => {
    const controller = getController()
    if (!controller) return
    return controller.onUserMove((event) => dispatch({ type: 'MOVES_DONE', moves: event.moves }))
  }, [getController])

  const onResult = useCallback((r: ScheduledResult) => frameHandlerRef.current?.(r), [])

  const onScanned = (facelets: Facelets, scannedColors: Record<Face, ColorName>) => {
    const parsed = fromFacelets(facelets)
    const controller = getController()
    if (!parsed.ok) return
    if (!controller) {
      setNotice('Hãy chuyển khối 3D về kích thước 3x3.')
      return
    }
    const r = controller.setFacelets(facelets)
    if (!r.ok) {
      setNotice(r.reason === 'busy' ? 'Khối 3D đang xoay, thử lại sau giây lát.' : 'Trạng thái không hợp lệ.')
      return
    }
    setNotice(null)
    setColors(scannedColors)
    dispatch({ type: 'SCANNED', cube: parsed.state })
  }

  const confirmReview = () => {
    // Drags while reviewing may have turned layers on the 3D cube: restore the scanned state.
    if (guide.cube) getController()?.setFacelets(toFacelets(guide.cube))
    dispatch({ type: 'CONFIRM_REVIEW' })
  }

  const report = (move: Move) => {
    dispatch({ type: 'MOVES_DONE', moves: [move] })
    getController()?.playMove(move).catch(() => {})
  }

  const scanning = guide.phase === 'SCANNING'
  const guiding = guide.phase === 'GUIDING' || guide.phase === 'RECOVERING'
  const summary = guiding && expected ? (
    <>
      <span className="panel-summary-text">
        Bước {guide.index + 1}/{guide.solution.length}: <strong>{expected}</strong>
      </span>
      {collapsed && (
        <button className="scramble" onClick={() => report(expected)}>
          Đã xoay
        </button>
      )}
    </>
  ) : (
    <span className="panel-summary-text">{PHASE_SUMMARY[guide.phase]}</span>
  )

  return (
    <CameraPanel
      title="Smart Solver"
      headerSlot={headerSlot}
      vision={vision}
      cameraEnabled={open && !collapsed && scanning && (scanMode === 'webcam' || canShutter)}
      hidden={!open}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((v) => !v)}
      summary={summary}
      overlay={overlay}
      grabRef={grabStillRef}
      onResult={onResult}
    >
      {notice && <div className="scan-error">{notice}</div>}

      {/* Kept mounted while reviewing so "Sửa lại" returns to the same faces and edits. */}
      {(scanning || guide.phase === 'REVIEWING') && (
        <div hidden={!scanning}>
          <ScanView
            key={guide.scanId}
            mode={scanMode}
            onModeChange={setScanMode}
            vision={vision}
            frameHandlerRef={frameHandlerRef}
            grabStillRef={grabStillRef}
            canShutter={canShutter}
            onOverlay={setOverlay}
            confirmLabel={guide.scanPurpose === 'verify' ? 'Xác nhận' : 'Áp lên khối 3D'}
            onConfirm={onScanned}
          />
        </div>
      )}

      {guide.phase === 'REVIEWING' && (
        <div className="scan">
          <div className="scan-step-title">Kiểm tra trên khối 3D</div>
          <div className="scan-step-text">
            Khối 3D đang hiển thị trạng thái vừa quét. Kéo vào vùng nền để xoay khối 3D và so sánh từng mặt với khối thật.
          </div>
          <div className="scan-actions">
            <button className="reset" onClick={() => dispatch({ type: 'BACK_TO_SCAN' })}>
              Sửa lại
            </button>
            <button className="scramble" onClick={confirmReview}>
              Đúng rồi — Giải
            </button>
          </div>
        </div>
      )}

      {guide.phase === 'SOLVING' && <div className="scan-status">Đang tính lời giải...</div>}

      {(guide.phase === 'GUIDING' || guide.phase === 'RECOVERING') && (
        <GuideView
          guide={guide}
          colors={colors}
          optimalStatus={optimalStatus}
          onDone={() => expected && report(expected)}
          onWrong={report}
          onRescan={() => dispatch({ type: 'START_SCAN', purpose: 'initial' })}
        />
      )}

      {guide.phase === 'VERIFYING' && (
        <div className="scan">
          <div className="scan-step-title">Theo tính toán, khối đã được giải</div>
          <div className="scan-step-text">Quét lại 6 mặt để xác nhận khối thật đúng như vậy.</div>
          <div className="scan-actions">
            <button className="reset" onClick={() => dispatch({ type: 'SKIP_VERIFY' })}>
              Bỏ qua
            </button>
            <button className="scramble" onClick={() => dispatch({ type: 'START_SCAN', purpose: 'verify' })}>
              Quét xác nhận
            </button>
          </div>
        </div>
      )}

      {guide.phase === 'COMPLETED' && (
        <div className="scan">
          <div className="scan-step-title">Hoàn thành!</div>
          <div className="scan-step-text">
            {guide.history.length ? `Khối đã được giải sau ${guide.history.length} bước.` : 'Khối đã ở trạng thái đã giải.'}
          </div>
          <button className="scramble" onClick={() => dispatch({ type: 'START_SCAN', purpose: 'initial' })}>
            Quét khối mới
          </button>
        </div>
      )}

      {guide.phase === 'ERROR' && (
        <div className="scan">
          <div className="scan-error">Không tìm được lời giải: {guide.error}</div>
          <button className="scramble" onClick={() => dispatch({ type: 'START_SCAN', purpose: 'initial' })}>
            Quét lại
          </button>
        </div>
      )}
    </CameraPanel>
  )
}
