import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { CubeController, NxnController } from '../adapter/types'
import type { ScheduledResult } from '../camera/FrameScheduler'
import { fromFacelets, toFacelets } from '../core/facelets'
import { FACES, type Face, type Facelets, type Move } from '../core/types'
import { INITIAL_GUIDE_STATE, expectedMove, guideReducer, needsSolve, nextTurn, wantsOptimal, type GuidePhase } from '../guidance/fsm'
import { NxnSolverClient } from '../nxn/NxnSolverClient'
import type { CubeSize } from '../nxn/engine'
import type { SolveMode } from '../nxn/solveRubik'
import type { CubeState } from '../nxn/state'
import { SolverClient } from '../solver/SolverClient'
import { VisionClient } from '../vision/VisionClient'
import CameraPanel from './CameraPanel'
import GuideView, { type BeginnerStage, type OptimalStatus } from './GuideView'
import NxnGuideView from './NxnGuideView'
import NxnScanView from './NxnScanView'
import { buildScheme, duplicateColors, loadSchemeSettings, saveSchemeSettings, schemeHex, type Scheme, type SchemeSettings } from './palette'
import ScanView, { type ScanMode } from './ScanView'
import { useNxnGuide } from './useNxnGuide'

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

const NXN_SUMMARY: Record<string, string> = {
  SCANNING: 'Chờ trạng thái khối',
  REVIEWING: 'Kiểm tra trạng thái trên khối 3D',
  SOLVING: 'Đang tính lời giải...',
  COMPLETED: 'Hoàn thành!',
  ERROR: 'Có lỗi — mở rộng để xem'
}

const SCAN_MODE_KEY = 'smart-solver.scanMode'
const SOLVE_MODE_KEY = 'smart-solver.solveMode'

function loadSolveMode(): SolveMode {
  try {
    return localStorage.getItem(SOLVE_MODE_KEY) === 'beginner' ? 'beginner' : 'fast'
  } catch {
    return 'fast'
  }
}

function loadScanMode(): ScanMode {
  try {
    return localStorage.getItem(SCAN_MODE_KEY) === 'photo' ? 'photo' : 'webcam'
  } catch {
    return 'webcam'
  }
}

function saveSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode); the choice just isn't remembered.
  }
}

/** A 3x3 scan as the n×n library's input (face letters as color names). */
function faceletsToCubeState(facelets: Facelets): CubeState {
  const faces = {} as CubeState['faces']
  FACES.forEach((f, i) => {
    faces[f] = facelets.slice(i * 9, i * 9 + 9).split('')
  })
  return { size: 3, faces }
}

const MOVE_TOKEN = /^[URFDLB][2']?$/

export interface SmartSolverPanelProps {
  /** Closed panels stay mounted (camera off) so the scan and guidance survive reopening. */
  open: boolean
  /** Where the panel header goes (the controls row next to Size and Quét). */
  headerSlot: HTMLElement | null
  /** Must be stable across renders: effects subscribe through it. */
  getController: () => NxnController | null
  /** Size picked in the playground: 3x3 has the scan + fast/beginner guidance, other sizes the n×n beginner guidance. */
  cubeSize: number
  /** Bumped whenever the 3D scene (and its controller) is rebuilt: size change or reset. */
  sceneVersion: number
  /** Bumped after each finished "Xáo trộn" on the 3D cube. */
  scrambleVersion: number
  /** Bumped by the playground's Reset: the 3D cube is back to solved. */
  resetVersion: number
  onRequestSize: (size: number) => void
}

export default function SmartSolverPanel({
  open,
  headerSlot,
  getController,
  cubeSize,
  sceneVersion,
  scrambleVersion,
  resetVersion,
  onRequestSize
}: SmartSolverPanelProps) {
  const [guide, dispatch] = useReducer(guideReducer, { ...INITIAL_GUIDE_STATE, phase: 'SCANNING' })
  const sizeOk = cubeSize === 3
  /** The 3x3 controller, when the scene is a 3x3. */
  const get3 = useCallback((): CubeController | null => {
    const c = getController()
    return c && 'setFacelets' in c ? (c as CubeController) : null
  }, [getController])
  const [solveModeSetting, setSolveMode] = useState<SolveMode>(loadSolveMode)
  useEffect(() => saveSetting(SOLVE_MODE_KEY, solveModeSetting), [solveModeSetting])
  const solveMode: SolveMode = sizeOk ? solveModeSetting : 'beginner'
  const [nxnSolver, setNxnSolver] = useState<NxnSolverClient | null>(null)
  useEffect(() => {
    const client = new NxnSolverClient()
    setNxnSolver(client)
    return () => client.dispose()
  }, [])
  const nxn = useNxnGuide(cubeSize, !sizeOk, getController, sceneVersion, nxnSolver)
  /** Stages of the 3x3 beginner solution, valid while `guide.solution` is that solution. */
  const [beginnerPlan, setBeginnerPlan] = useState<{ solution: Move[]; stages: BeginnerStage[] } | null>(null)
  const guideRef = useRef(guide)
  guideRef.current = guide

  // A rebuilt scene starts solved: put the cube we are tracking back on it.
  useEffect(() => {
    const { cube, phase } = guideRef.current
    if (!sizeOk || !cube || phase === 'SCANNING' || phase === 'IDLE') return
    let tries = 0
    let timer = 0
    const apply = () => {
      const r = get3()?.setFacelets(toFacelets(cube))
      if (r && !r.ok && r.reason === 'busy' && tries++ < 10) timer = window.setTimeout(apply, 300)
    }
    apply()
    return () => window.clearTimeout(timer)
  }, [sceneVersion, sizeOk, get3])
  const [schemeSettings, setSchemeSettings] = useState<SchemeSettings>(loadSchemeSettings)
  /** Colors shown in guidance and on the 3D cube: the chosen scheme, then what the scan learned. */
  const [colors, setColors] = useState<Scheme>(() => buildScheme(schemeSettings))
  useEffect(() => saveSchemeSettings(schemeSettings), [schemeSettings])
  const changeScheme = (settings: SchemeSettings) => {
    setSchemeSettings(settings)
    // Two faces sharing a color can't be painted apart; keep the last usable colors until fixed.
    if (settings.preset !== 'custom' || !duplicateColors(settings.custom).length) setColors(buildScheme(settings))
  }

  // Paint the 3D cube in the user's colors; retry briefly if a turn is animating.
  useEffect(() => {
    let tries = 0
    let timer = 0
    const apply = () => {
      const ok = getController()?.setFaceColors(schemeHex(colors)) ?? true
      if (!ok && tries++ < 10) timer = window.setTimeout(apply, 300)
    }
    apply()
    return () => window.clearTimeout(timer)
  }, [colors, getController, sceneVersion])
  const [notice, setNotice] = useState<string | null>(null)
  const frameHandlerRef = useRef<((r: ScheduledResult) => void) | null>(null)
  const grabStillRef = useRef<(() => HTMLCanvasElement | null) | null>(null)
  const [overlay, setOverlay] = useState<string | null>(null)
  // Desktops get a live preview with a shutter button in photo mode; phones use the camera app.
  const [canShutter] = useState(() => window.matchMedia?.('(pointer: fine)').matches ?? false)
  const solverRef = useRef<SolverClient | null>(null)
  const [vision, setVision] = useState<VisionClient | null>(null)
  // The detector looks for faces of the size picked in the playground.
  useEffect(() => {
    if (vision) vision.gridSize = cubeSize
  }, [vision, cubeSize])
  const [collapsed, setCollapsed] = useState(false)
  const [scanMode, setScanMode] = useState<ScanMode>(loadScanMode)
  useEffect(() => saveSetting(SCAN_MODE_KEY, scanMode), [scanMode])
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
    const fail = (e: unknown) => {
      if (e instanceof Error && e.message === 'solver disposed') return
      dispatch({ type: 'SOLVE_FAILED', epoch, message: e instanceof Error ? e.message : String(e) })
    }
    if (solveMode === 'beginner' && nxnSolver) {
      nxnSolver
        .solve(3, faceletsToCubeState(toFacelets(guide.cube)), { mode: 'beginner' })
        .then((r) => {
          if (!r.moves.every((m) => MOVE_TOKEN.test(m))) throw new Error('lời giải có phép xoay không phải mặt ngoài')
          const moves = r.moves as Move[]
          let at = 0
          const stages = r.steps.map((st, i) => {
            const stage = { title: st.title, algorithms: st.algorithms, start: at, end: at + st.moves.length, index: i, count: r.steps.length }
            at = stage.end
            return stage
          })
          setBeginnerPlan({ solution: moves, stages })
          dispatch({ type: 'SOLVED', epoch, moves, ms: r.executionTimeMs })
        })
        .catch(fail)
      return
    }
    solverRef.current
      .solve(guide.cube)
      .then((r) => dispatch({ type: 'SOLVED', epoch, moves: r.moves, ms: r.ms }))
      .catch(fail)
  }, [guide.epoch, guide.phase])

  // Proven-shortest search for the current step, one job at a time; stale results are dropped by the reducer.
  const stepKey = `${guide.epoch}:${guide.index}`
  useEffect(() => {
    const solver = solverRef.current
    if (!solver || !guide.cube || solveMode !== 'fast' || !wantsOptimal(guide)) return
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
  }, [guide, optimalJob, stepKey, solveMode])

  const optimalStatus: OptimalStatus = guide.optimal
    ? 'proven'
    : optimalJob?.status === 'running'
      ? 'searching'
      : 'unproven'

  const expected = expectedMove(guide)
  // After the first quarter of a half turn, only the remaining quarter is shown on the 3D cube.
  const turnNow = nextTurn(guide)
  useEffect(() => {
    get3()?.highlight(turnNow)
  }, [turnNow, get3, sceneVersion])
  useEffect(() => () => get3()?.highlight(null), [get3])

  // Turns dragged on the 3D cube count as turns on the real cube.
  useEffect(() => {
    const controller = get3()
    if (!controller) return
    return controller.onUserMove((event) => dispatch({ type: 'MOVES_DONE', moves: event.moves }))
  }, [get3, sceneVersion])

  const onResult = useCallback((r: ScheduledResult) => frameHandlerRef.current?.(r), [])

  const onScanned = (facelets: Facelets, scannedColors: Scheme): boolean => {
    const parsed = fromFacelets(facelets)
    const controller = get3()
    if (!parsed.ok) return false
    if (!controller) {
      setNotice('Hãy chuyển khối 3D về kích thước 3x3.')
      return false
    }
    const r = controller.setFacelets(facelets)
    if (!r.ok) {
      setNotice(r.reason === 'busy' ? 'Khối 3D đang xoay, thử lại sau giây lát.' : 'Trạng thái không hợp lệ.')
      return false
    }
    setNotice(null)
    setColors(scannedColors)
    dispatch({ type: 'SCANNED', cube: parsed.state })
    return true
  }

  const confirmReview = () => {
    // Drags while reviewing may have turned layers on the 3D cube: restore the scanned state.
    if (guide.cube) get3()?.setFacelets(toFacelets(guide.cube))
    dispatch({ type: 'CONFIRM_REVIEW' })
  }

  const report = (move: Move) => {
    dispatch({ type: 'MOVES_DONE', moves: [move] })
    get3()?.playMove(move).catch(() => {})
  }

  /**
   * "Bắt đầu giải": solves the cube shown in 3D as it is now (scrambled, or part solved by the
   * user). No review: the state comes from the 3D cube itself.
   */
  const startSolving = () => {
    if (!sizeOk) {
      const ok = nxn.takeScene()
      setNotice(ok ? null : 'Khối 3D đang xoay, thử lại sau giây lát.')
      if (ok) nxn.dispatch({ type: 'CONFIRM_REVIEW' })
      return
    }
    const facelets = get3()?.getFacelets()
    if (!facelets || !fromFacelets(facelets).ok) {
      setNotice('Không đọc được trạng thái khối 3D (đang xoay hoặc không hợp lệ).')
      return
    }
    // onScanned writes it back, which is refused while the cube is still turning.
    if (onScanned(facelets, colors)) dispatch({ type: 'CONFIRM_REVIEW' })
  }

  // "Xáo trộn": guidance for the previous cube no longer applies. Nothing is solved until the
  // user asks (they may want to solve it themselves); a scan in progress is kept.
  const seenScramble = useRef(scrambleVersion)
  useEffect(() => {
    if (scrambleVersion === seenScramble.current) return
    seenScramble.current = scrambleVersion
    setNotice(null)
    if (guideRef.current.phase !== 'SCANNING') dispatch({ type: 'START_SCAN', purpose: 'initial' })
    if (nxn.guide.phase !== 'SCANNING') nxn.dispatch({ type: 'START_SCAN' })
  }, [scrambleVersion, nxn.guide.phase, nxn.dispatch])

  // Reset in the playground: the cube is solved again, so is the guidance (no state put back on it).
  const seenReset = useRef(resetVersion)
  useEffect(() => {
    if (resetVersion === seenReset.current) return
    seenReset.current = resetVersion
    setNotice(null)
    dispatch({ type: 'RESET_SOLVED' })
    nxn.dispatch({ type: 'RESET_SOLVED' })
  }, [resetVersion, nxn.dispatch])

  // A new solving method applies to the cube being solved right away.
  const seenMode = useRef(solveModeSetting)
  useEffect(() => {
    if (solveModeSetting === seenMode.current) return
    seenMode.current = solveModeSetting
    dispatch({ type: 'RESOLVE' })
  }, [solveModeSetting])

  const beginnerStage: BeginnerStage | null =
    solveMode === 'beginner' && beginnerPlan?.solution === guide.solution
      ? (beginnerPlan.stages.find((st) => guide.index >= st.start && guide.index < st.end) ?? null)
      : null
  const nxnGuiding = !sizeOk && nxn.guide.phase === 'GUIDING' && nxn.expected

  const scanning = guide.phase === 'SCANNING'
  const guiding = guide.phase === 'GUIDING' || guide.phase === 'RECOVERING'
  const summary = nxnGuiding ? (
    <>
      <span className="panel-summary-text">
        Bước {nxn.guide.index + 1}/{nxn.guide.solution.length}: <strong>{nxn.expected}</strong>
      </span>
      {collapsed && (
        <button className="scramble" onClick={nxn.done}>
          Đã xoay
        </button>
      )}
    </>
  ) : !sizeOk ? (
    <span className="panel-summary-text">{NXN_SUMMARY[nxn.guide.phase] ?? ''}</span>
  ) : guiding && expected ? (
    <>
      <span className="panel-summary-text">
        Bước {guide.index + 1}/{guide.solution.length}: <strong>{expected}</strong>
      </span>
      {collapsed && (
        <button className="scramble" onClick={() => report(turnNow ?? expected)}>
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
      cameraEnabled={open && !collapsed && (sizeOk ? scanning : nxn.guide.phase === 'SCANNING') && (scanMode === 'webcam' || canShutter)}
      hidden={!open}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((v) => !v)}
      summary={summary}
      overlay={overlay}
      grabRef={grabStillRef}
      onResult={onResult}
    >
      <div className="scan-mode" role="tablist" aria-label="Phương pháp giải">
        {(['fast', 'beginner'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={solveMode === m}
            className={solveMode === m ? 'active' : ''}
            disabled={!sizeOk && m === 'fast'}
            title={!sizeOk && m === 'fast' ? `Khối ${cubeSize}x${cubeSize} chỉ có cách giải cho người mới học` : undefined}
            onClick={() => setSolveMode(m)}
          >
            {m === 'fast' ? 'Giải nhanh' : 'Người mới học'}
          </button>
        ))}
      </div>

      {!sizeOk && (
        <div className="scan">
          {/* Kept mounted while reviewing so "Quay lại" returns to the same faces and edits. */}
          {(nxn.guide.phase === 'SCANNING' || nxn.guide.phase === 'REVIEWING') && (
            <div className="scan" hidden={nxn.guide.phase !== 'SCANNING'}>
              {notice && <div className="scan-error">{notice}</div>}
              <button className="scramble" onClick={startSolving}>
                Bắt đầu giải khối 3D đang hiển thị
              </button>
              <NxnScanView
                key={`${cubeSize}-${nxn.guide.scanId}`}
                n={cubeSize as CubeSize}
                mode={scanMode}
                onModeChange={setScanMode}
                vision={vision}
                frameHandlerRef={frameHandlerRef}
                grabStillRef={grabStillRef}
                canShutter={canShutter}
                onOverlay={setOverlay}
                onConfirm={(stickers, scheme) => {
                  setColors(scheme)
                  nxn.dispatch({ type: 'SCANNED', stickers })
                }}
                schemeSettings={schemeSettings}
                onSchemeSettings={changeScheme}
              />
            </div>
          )}

          {nxn.guide.phase === 'REVIEWING' && (
            <div className="scan">
              <div className="scan-step-title">Kiểm tra trên khối 3D</div>
              <div className="scan-step-text">Khối 3D đang hiển thị trạng thái sẽ giải. So sánh từng mặt với khối thật.</div>
              <div className="scan-actions">
                <button className="reset" onClick={() => nxn.dispatch({ type: 'BACK_TO_SCAN' })}>
                  Quay lại
                </button>
                <button className="scramble" onClick={nxn.confirmReview}>
                  Đúng rồi — Giải
                </button>
              </div>
            </div>
          )}

          {nxn.guide.phase === 'SOLVING' && (
            <div className="scan-status">
              Đang tính lời giải{cubeSize === 5 ? ' (khối 5x5 có thể mất 5–15 giây)' : ''}...
            </div>
          )}

          {nxn.guide.phase === 'GUIDING' && (
            <NxnGuideView
              guide={nxn.guide}
              nextPart={nxn.nextPart}
              onDone={nxn.done}
              onRescan={() => nxn.dispatch({ type: 'START_SCAN' })}
            />
          )}

          {nxn.guide.phase === 'COMPLETED' && (
            <div className="scan">
              <div className="scan-step-title">Hoàn thành!</div>
              <div className="scan-step-text">
                {nxn.guide.history.length ? `Khối đã được giải sau ${nxn.guide.history.length} bước.` : 'Khối đã ở trạng thái đã giải.'}
              </div>
              <button className="scramble" onClick={() => nxn.dispatch({ type: 'START_SCAN' })}>
                Giải khối khác
              </button>
            </div>
          )}

          {nxn.guide.phase === 'ERROR' && (
            <div className="scan">
              <div className="scan-error">
                {nxn.guide.errorKind === 'invalid'
                  ? `Trạng thái không hợp lệ: ${nxn.guide.error}`
                  : nxn.guide.errorKind === 'timeout'
                    ? 'Quá thời gian tính lời giải. Thử lại.'
                    : `Không tìm được lời giải: ${nxn.guide.error}`}
              </div>
              <button className="scramble" onClick={() => nxn.dispatch({ type: 'START_SCAN' })}>
                Làm lại
              </button>
            </div>
          )}
        </div>
      )}

      <div className="scan" hidden={!sizeOk}>
        {notice && <div className="scan-error">{notice}</div>}

        {scanning && (
          <button className="scramble" onClick={startSolving}>
            Bắt đầu giải khối 3D đang hiển thị
          </button>
        )}

        {/* Kept mounted while reviewing so "Sửa lại" returns to the same faces and edits. */}
        {sizeOk && (scanning || guide.phase === 'REVIEWING') && (
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
              schemeSettings={schemeSettings}
              onSchemeSettings={changeScheme}
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
            beginnerStage={solveMode === 'beginner' ? beginnerStage : undefined}
            onDone={() => turnNow && report(turnNow)}
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
      </div>
    </CameraPanel>
  )
}
