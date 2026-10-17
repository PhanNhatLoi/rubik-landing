import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
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
import GuideView, { type OptimalStatus } from './GuideView'
import NxnGuideView from './NxnGuideView'
import NxnScanView from './NxnScanView'
import { buildScheme, duplicateColors, loadSchemeSettings, saveSchemeSettings, schemeHex, type Scheme, type SchemeSettings } from './palette'
import { DESKTOP_QUERY, useMediaQuery } from '../../ui/useMediaQuery'
import ScanView, { type ScanMode } from './ScanView'
import { useNxnGuide } from './useNxnGuide'
import {
  RoadmapView,
  NotationView,
  StepView,
  CheckpointView,
  PracticeSourceView,
  PracticeView,
  PracticeDoneView,
  PreconditionView,
  CrossLessonView,
  CornerLessonView,
  MiddleLessonView,
  TopCrossLessonView,
  LastEdgesLessonView,
  LastCornersLessonView,
  LastFaceLessonView
} from '../../learn/ui'
import { STAGES, type StageDef, type StageId } from '../../learn/stages'
import {
  PRACTICE_SAMPLES,
  buildPracticeState,
  checkPrecondition,
  type PracticeSample
} from '../../learn/engine/practice'
import {
  getLearnProgress,
  markStageCompleted,
  markStagePracticed,
  type LearnProgress
} from '../../learn/engine/storage'
import { CURRICULUM_STAGES } from '../../learn/curriculum'
import { firstUndoneFrom } from '../../learn/engine/stagePlan'
import { basicStageInProgress, planBasicStage } from '../../learn/engine/basicSolve'
import { SOLVED, applyMoves, invertMove, isSolved } from '../core/cubie'
import { inverseToken } from '../adapter/nxnModel'
import type { CubieState } from '../core/types'

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
  onPhaseChange?: (phase: string) => void
  /** Menu entry on screen: only 'scan' (and a practice scan inside 'learn') switches the camera on. */
  section: 'learn' | 'scan' | 'solve'
  onSelectSection: (section: 'learn' | 'scan' | 'solve') => void
  /** Back to the menu list. */
  onCloseSection: () => void
  /** True while the lesson wants the 3D cube out of the way (phones only use this). */
  onStageHiddenChange?: (hidden: boolean) => void
  /** Reports the collapsed/expanded state so the host layout can give the space back to the 3D cube. */
  onCollapsedChange?: (collapsed: boolean) => void
}

export default function SmartSolverPanel({
  open,
  headerSlot,
  getController,
  cubeSize,
  sceneVersion,
  scrambleVersion,
  resetVersion,
  onRequestSize,
  onPhaseChange,
  section,
  onSelectSection,
  onCloseSection,
  onStageHiddenChange,
  onCollapsedChange
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
  const solveMode: SolveMode = sizeOk && section !== 'learn' ? solveModeSetting : 'beginner'
  const [nxnSolver, setNxnSolver] = useState<NxnSolverClient | null>(null)
  useEffect(() => {
    const client = new NxnSolverClient()
    setNxnSolver(client)
    return () => client.dispose()
  }, [])
  const nxn = useNxnGuide(cubeSize, !sizeOk, getController, sceneVersion, nxnSolver)
  type LearnScreen =
    | 'guide'
    | 'roadmap'
    | 'notation'
    | 'checkpoint'
    | 'practice_source'
    | 'practice'
    | 'practice_done'
    | 'precondition'
    | 'lesson_cross'
    | 'lesson_corners'
    | 'lesson_middle'
    | 'lesson_topCross'
    | 'lesson_lastEdges'
    | 'lesson_lastCorners'
    | 'lesson_lastFace'
    | null

  /** The big step being guided in the basic 3x3 solve, valid while `guide.solution` is that plan's moves. */
  const [beginnerPlan, setBeginnerPlan] = useState<{ solution: Move[]; stage: StageDef; whys: string[] } | null>(null)
  const [lessonPractice, setLessonPractice] = useState(false)
  const [learnView, setLearnView] = useState<LearnScreen>(section === 'learn' ? 'roadmap' : null)
  const [notationFrom, setNotationFrom] = useState<LearnScreen>('roadmap')
  const [activeStageId, setActiveStageId] = useState<StageId>('cross')
  const [progressState, setProgressState] = useState<LearnProgress>(getLearnProgress)

  // Practice session state
  const [practiceStage, setPracticeStage] = useState<StageDef | null>(null)
  const [practiceSample, setPracticeSample] = useState<PracticeSample | null>(null)
  const [practiceCube, setPracticeCube] = useState<CubieState | null>(null)
  // One entry per turn the learner made (a slice turn is one entry of two moves), with the cube before it.
  const [practiceHistory, setPracticeHistory] = useState<{ moves: Move[]; before: CubieState; token?: string }[]>([])
  /** Set when a turn was just recorded, until the 3D cube reports which layer it was (same drag). */
  const awaitingTurnToken = useRef(false)
  const [practiceStats, setPracticeStats] = useState<{ moves: number; seconds: number; hints: number } | null>(null)
  const [missingStages, setMissingStages] = useState<StageId[]>([])
  const [scanModeForPractice, setScanModeForPractice] = useState(false)

  const learnViewRef = useRef(learnView)
  learnViewRef.current = learnView
  const practiceCubeRef = useRef(practiceCube)
  practiceCubeRef.current = practiceCube
  const practiceHistoryRef = useRef(practiceHistory)
  practiceHistoryRef.current = practiceHistory
  /** Updates the history now (not on the next render), so quick turns or taps never see a stale list. */
  const writeHistory = (next: typeof practiceHistory) => {
    practiceHistoryRef.current = next
    setPracticeHistory(next)
  }

  /** The tracked practice cube, read from what the 3D cube really shows (`fallback` if it can't be read). */
  const syncFromScene = useCallback(
    (fallback: CubieState) => {
      const facelets = get3()?.getFacelets()
      const parsed = facelets ? fromFacelets(facelets) : null
      const next = parsed?.ok ? parsed.state : fallback
      practiceCubeRef.current = next
      setPracticeCube(next)
    },
    [get3]
  )

  const LESSON_VIEW_STAGE: Record<StageId, LearnScreen> = {
    cross: 'lesson_cross', corners: 'lesson_corners', middle: 'lesson_middle', topCross: 'lesson_topCross',
    topEdges: 'lesson_lastEdges', topCorners: 'lesson_lastCorners', topFace: 'lesson_lastFace'
  }
  // Finishing a lesson's practice cube (after at least one move) records the lesson as completed.
  useEffect(() => {
    if (!learnView?.startsWith('lesson_') || !practiceCube || !practiceHistory.length) return
    const stage = CURRICULUM_STAGES.find((s) => LESSON_VIEW_STAGE[s.id] === learnView)
    if (!stage || !stage.isDone(practiceCube) || progressState.completed.includes(stage.id)) return
    markStageCompleted(stage.id)
    setProgressState(getLearnProgress())
  }, [learnView, practiceCube, practiceHistory, progressState])

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
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const stageHidden = open && section === 'learn' && (learnView === 'roadmap' || ((learnView === 'notation' || learnView === 'lesson_cross' || learnView === 'lesson_corners' || learnView === 'lesson_middle' || learnView === 'lesson_topCross' || learnView === 'lesson_lastEdges' || learnView === 'lesson_lastCorners' || learnView === 'lesson_lastFace') && !lessonPractice))
  const [collapsedSetting, setCollapsed] = useState(false)
  // Only phones can collapse the panel; on desktop it is always expanded.
  // Collapsing only exists to give the 3D cube room, so it's off while the cube is out of the way.
  const canCollapse = !isDesktop && !stageHidden
  const collapsed = collapsedSetting && canCollapse
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
    if (solveMode === 'beginner') {
      // Basic solve: only the big step the cube is in is planned, with the lesson guides (never the whole solution).
      const plan = planBasicStage(guide.cube, Object.fromEntries(FACES.map((f) => [f, colors[f].label])) as Record<Face, string>)
      if (!plan) {
        fail(new Error('không lập được hướng dẫn cho bước này'))
        return
      }
      setBeginnerPlan({ solution: plan.moves, stage: plan.stage, whys: plan.whys })
      dispatch({ type: 'SOLVED', epoch, moves: plan.moves, ms: 0 })
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
    return controller.onUserMove((event) => {
      if ((learnViewRef.current === 'practice' || learnViewRef.current === 'lesson_cross' || learnViewRef.current === 'lesson_corners' || learnViewRef.current === 'lesson_middle' || learnViewRef.current === 'lesson_topCross' || learnViewRef.current === 'lesson_lastEdges' || learnViewRef.current === 'lesson_lastCorners' || learnViewRef.current === 'lesson_lastFace') && practiceCubeRef.current) {
        const before = practiceCubeRef.current
        syncFromScene(applyMoves(before, event.moves))
        writeHistory([...practiceHistoryRef.current, { moves: event.moves, before }])
        awaitingTurnToken.current = true
        return
      }
      dispatch({ type: 'MOVES_DONE', moves: event.moves })
    })
  }, [get3, sceneVersion])

  // The same drag, named by the fixed layer it turned: undo turns that exact layer back.
  useEffect(() => {
    const controller = get3()
    if (!controller) return
    return controller.onUserTurn((token) => {
      if (!awaitingTurnToken.current) return
      awaitingTurnToken.current = false
      const prev = practiceHistoryRef.current
      writeHistory(prev.map((t, i) => (i === prev.length - 1 && !t.token ? { ...t, token } : t)))
    })
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
    if (scanModeForPractice && solveMode === 'beginner' && !learnView && practiceStage && guide.cube) {
      const precond = checkPrecondition(practiceStage, guide.cube)
      if (precond.ok) {
        setPracticeCube(guide.cube)
        setPracticeHistory([])
        setScanModeForPractice(false)
        setLearnView('practice')
        return
      } else {
        setMissingStages(precond.missing)
        setScanModeForPractice(false)
        setLearnView('precondition')
        return
      }
    }
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

  useEffect(() => {
    onCollapsedChange?.(collapsed)
  }, [collapsed, onCollapsedChange])

  // The tutorial opens on its roadmap; other sections never show tutorial screens. Adjusted while
  // rendering (not in an effect) so the camera never starts for a frame on the way in.
  const [seenSection, setSeenSection] = useState(section)
  if (seenSection !== section) {
    setSeenSection(section)
    setLearnView((v) => (section === 'learn' ? (v ?? 'roadmap') : null))
    setScanModeForPractice(false)
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

  /** Why the current move is made, while the guide still follows the plan (not an undo of a wrong turn). */
  const moveWhy = beginnerPlan?.solution === guide.solution ? beginnerPlan.whys[guide.index] : undefined

  const learnOverlay = learnView !== null && learnView !== 'guide'
  const guidingNow = guide.phase === 'GUIDING' || guide.phase === 'RECOVERING'
  const activeStageDef: StageDef = CURRICULUM_STAGES.find((s) => s.id === activeStageId) ?? CURRICULUM_STAGES[0]!
  // While guiding, the big step is the one the plan was made for. The cube cannot tell: a formula
  // temporarily undoes earlier steps, so reading it from the cube would flip back and forth.
  const currentStageDef: StageDef =
    learnView !== 'checkpoint' && guidingNow && guide.cube
      ? (beginnerPlan?.stage ?? basicStageInProgress(guide.cube) ?? CURRICULUM_STAGES[CURRICULUM_STAGES.length - 1]!)
      : activeStageDef

  const nextStageDef: StageDef | null = CURRICULUM_STAGES[currentStageDef.index + 1] ?? null

  // Open the checkpoint when the moves of the big step are used up (or the cube is finished).
  const lastStageRef = useRef<StageDef | null>(null)
  useEffect(() => {
    if (solveMode !== 'beginner' || (learnView && learnView !== 'guide')) return
    const last = lastStageRef.current
    if (guidingNow && guide.cube) {
      const now = beginnerPlan?.stage ?? last
      if (now) {
        lastStageRef.current = now
        setActiveStageId(now.id)
        if (guide.phase === 'GUIDING' && guide.index >= guide.solution.length) setLearnView('checkpoint')
      }
    } else if (guide.phase === 'VERIFYING' && last) {
      lastStageRef.current = null
      setActiveStageId(last.id)
      setLearnView('checkpoint')
    } else if (guide.phase !== 'VERIFYING') {
      lastStageRef.current = null
    }
  }, [solveMode, learnView, guidingNow, guide.phase, guide.cube, guide.index, guide.solution, beginnerPlan])

  const handleLearnFromStage = (stage: StageDef) => {
    const controller = get3()
    if (!controller) return

    const facelets = controller.getFacelets()
    const parsed = facelets ? fromFacelets(facelets) : null
    let cube = parsed?.ok ? parsed.state : (guide.cube ?? SOLVED)

    const pre = checkPrecondition(stage, cube)
    if (!pre.ok) {
      setPracticeStage(stage)
      setMissingStages(pre.missing)
      setLearnView('precondition')
      return
    }

    const target = firstUndoneFrom(stage, cube)
    if (!target) {
      // Fully solved cube (nothing of the user's to lose): load a sample so there is something to learn.
      if (!isSolved(cube)) return
      cube = buildPracticeState(stage.id, (PRACTICE_SAMPLES[stage.id] ?? PRACTICE_SAMPLES.cross)[0]!)
      applyFaceletsSafely(toFacelets(cube))
    }

    lastStageRef.current = null
    setScanModeForPractice(false)
    setActiveStageId((target ?? stage).id)
    // The solver effect computes the solution (and `beginnerPlan`) for the confirmed cube.
    dispatch({ type: 'START_SCAN', purpose: 'initial' })
    dispatch({ type: 'SCANNED', cube })
    dispatch({ type: 'CONFIRM_REVIEW' })
    setLearnView('guide')
  }

  const applyFaceletsSafely = useCallback((facelets: Facelets, callback?: () => void) => {
    let tries = 0
    let timer = 0
    const apply = () => {
      const r = get3()?.setFacelets(facelets)
      if (r && !r.ok && r.reason === 'busy' && tries++ < 10) {
        timer = window.setTimeout(apply, 200)
      } else if (callback) {
        callback()
      }
    }
    apply()
    return () => window.clearTimeout(timer)
  }, [get3])

  const handleCheckpointMatch = () => {
    markStageCompleted(currentStageDef.id)
    setProgressState(getLearnProgress())
    if (nextStageDef) {
      // The next big step is planned only now, from the cube as it is.
      setLearnView(null)
      dispatch({ type: 'RESOLVE' })
    } else {
      dispatch({ type: 'SKIP_VERIFY' })
      setLearnView(null)
    }
  }

  const handleCheckpointNeedFix = () => {
    setScanModeForPractice(false)
    setLearnView(null)
    dispatch({ type: 'START_SCAN', purpose: 'initial' })
  }

  const handleOpenPractice = (stage: StageDef) => {
    setPracticeStage(stage)
    setLearnView('practice_source')
  }

  const handleStartPracticeSample = (stage: StageDef, sample: PracticeSample) => {
    const cube = buildPracticeState(stage.id, sample)
    const facelets = toFacelets(cube)
    setPracticeStage(stage)
    setPracticeSample(sample)
    setPracticeCube(cube)
    setPracticeHistory([])
    applyFaceletsSafely(facelets, () => {
      setLearnView('practice')
    })
  }

  const handleUndoPractice = () => {
    const history = practiceHistoryRef.current
    if (!history.length || !practiceCubeRef.current) return
    const last = history[history.length - 1]!
    writeHistory(history.slice(0, -1))
    // The tracked cube is read back from the 3D cube once the undo has finished, so it can't drift from it.
    const settle = () => syncFromScene(last.before)
    if (last.token) {
      // Turn the very same layer back (a face or a middle slice), animated.
      get3()?.playTurn(inverseToken(last.token)).then(settle, () => {})
    } else if (last.moves.length === 1) {
      get3()?.playMove(invertMove(last.moves[0]!)).then(settle, () => {})
    } else {
      applyFaceletsSafely(toFacelets(last.before), settle)
    }
  }

  const handlePracticeStageComplete = (stats: { moves: number; seconds: number; hints: number }) => {
    if (practiceStage) {
      markStagePracticed(practiceStage.id)
      setProgressState(getLearnProgress())
    }
    setPracticeStats(stats)
    setLearnView('practice_done')
  }
  const nxnGuiding = !sizeOk && nxn.guide.phase === 'GUIDING' && nxn.expected

  const scanning = guide.phase === 'SCANNING'
  const guiding = guide.phase === 'GUIDING' || guide.phase === 'RECOVERING'

  const currentPhase = sizeOk ? guide.phase : nxn.guide.phase
  /** The scan screen (camera or photo) is on screen; elsewhere "SCANNING" just means nothing is being solved yet. */
  const cameraSection = section === 'scan' || (section === 'learn' && !learnOverlay)
  const faceColorsHex = useMemo(() => schemeHex(colors), [colors])
  useEffect(() => {
    onStageHiddenChange?.(stageHidden)
  }, [stageHidden, onStageHiddenChange])
  const reportedPhase = currentPhase === 'SCANNING' && !cameraSection ? 'IDLE' : currentPhase
  useEffect(() => {
    onPhaseChange?.(reportedPhase)
  }, [reportedPhase, onPhaseChange])

  const summary = nxnGuiding ? (
    <>
      <span className="panel-summary-text">
        Bước {nxn.guide.index + 1}/{nxn.guide.solution.length}: <strong>{nxn.expected}</strong>
      </span>
      {collapsed && (
        <button
          type="button"
          className="rb-btn rb-btn--primary"
          onClick={nxn.done}
        >
          Đã xoay
        </button>
      )}
    </>
  ) : !sizeOk ? (
    <span className="panel-summary-text">{NXN_SUMMARY[nxn.guide.phase] ?? ''}</span>
  ) : guiding && expected ? (
    <>
      <span className="panel-summary-text">
        {solveMode === 'beginner' ? `Giai đoạn ${currentStageDef.index + 1}/7 · nước ${guide.index + 1}: ` : `Bước ${guide.index + 1}/${guide.solution.length}: `}
        <strong>{expected}</strong>
      </span>
      {collapsed && (
        <button
          type="button"
          className="rb-btn rb-btn--primary"
          onClick={() => report(turnNow ?? expected)}
        >
          Đã xoay
        </button>
      )}
    </>
  ) : (
    <span className="panel-summary-text">{PHASE_SUMMARY[guide.phase]}</span>
  )

  const startCard =
    section === 'solve' && !learnOverlay && (sizeOk ? scanning : nxn.guide.phase === 'SCANNING') ? (
      <div className="scan">
        {notice && <div className="rb-alert">{notice}</div>}
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rb-text)' }}>Giải khối 3D đang hiển thị</div>
        <div style={{ fontSize: '13px', color: 'var(--rb-text-muted)', marginTop: '4px' }}>
          Chọn cách giải ở trên rồi bấm bắt đầu. Muốn giải khối thật? Hãy quét nó trước.
        </div>
        <button type="button" className="rb-btn rb-btn--primary" style={{ width: '100%', height: '48px', marginTop: '12px' }} onClick={startSolving}>
          Bắt đầu giải
        </button>
        <div style={{ textAlign: 'center', marginTop: '6px' }}>
          <button type="button" className="rb-btn rb-btn--link" onClick={() => onSelectSection('scan')}>
            Quét khối thật
          </button>
        </div>
      </div>
    ) : null

  return (
    <CameraPanel
      title=""
      headerSlot={headerSlot}
      vision={vision}
      cameraEnabled={open && cameraSection && !collapsed && (sizeOk ? scanning : nxn.guide.phase === 'SCANNING') && (scanMode === 'webcam' || canShutter)}
      hidden={!open}
      collapsed={collapsed}
      onToggleCollapsed={!canCollapse ? undefined : () => setCollapsed((v) => !v)}
      // "Đang quét các mặt" makes no sense in the lessons; only the guided steps (with "Đã xoay") belong there.
      summary={section === 'learn' && !guiding ? undefined : summary}
      overlay={overlay}
      grabRef={grabStillRef}
      onResult={onResult}
    >
      {section !== 'learn' && (
      <div className="rb-seg" role="tablist" aria-label="Phương pháp giải">
        {(['fast', 'beginner'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={solveMode === m}
            className="rb-seg__item"
            style={{ minHeight: '40px', height: '40px' }}
            disabled={!sizeOk && m === 'fast'}
            title={!sizeOk && m === 'fast' ? `Khối ${cubeSize}x${cubeSize} chỉ có cách giải cho người mới học` : undefined}
            onClick={() => {
              setSolveMode(m)
            }}
          >
            {m === 'fast' ? 'Giải nhanh' : 'Cơ bản'}
          </button>
        ))}
      </div>
      )}

      {startCard}

      {section === 'learn' && !sizeOk && (
        <div className="scan">
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rb-text)' }}>Bài học dùng khối 3x3</div>
          <div style={{ fontSize: '13px', color: 'var(--rb-text-muted)', marginTop: '4px' }}>Hãy chuyển khối 3D về 3x3 để học và luyện tập.</div>
          <button type="button" className="rb-btn rb-btn--primary" style={{ width: '100%', height: '48px', marginTop: '12px' }} onClick={() => onRequestSize(3)}>
            Chuyển sang 3x3
          </button>
        </div>
      )}

      {!sizeOk && section !== 'learn' && (
        <div className="scan">
          {/* Kept mounted while reviewing so "Quay lại" returns to the same faces and edits. */}
          {(nxn.guide.phase === 'SCANNING' || nxn.guide.phase === 'REVIEWING') && (
            <div className="scan" hidden={nxn.guide.phase !== 'SCANNING' || section !== 'scan'}>
              {notice && <div className="rb-alert">{notice}</div>}
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
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rb-text)' }}>Kiểm tra trên khối 3D</div>
              <div style={{ fontSize: '13px', color: 'var(--rb-text-muted)', marginTop: '4px' }}>Khối 3D đang hiển thị trạng thái sẽ giải. So sánh từng mặt với khối thật.</div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="rb-btn rb-btn--ghost" style={{ flex: 1, height: '48px' }} onClick={() => nxn.dispatch({ type: 'BACK_TO_SCAN' })}>
                  Quay lại
                </button>
                <button type="button" className="rb-btn rb-btn--primary" style={{ flex: 1, height: '48px' }} onClick={nxn.confirmReview}>
                  Đúng rồi — Giải
                </button>
              </div>
            </div>
          )}

          {nxn.guide.phase === 'SOLVING' && (
            <div className="rb-alert" style={{ marginTop: '8px' }}>
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
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rb-text)' }}>Hoàn thành!</div>
              <div style={{ fontSize: '13px', color: 'var(--rb-text-muted)', marginTop: '4px' }}>
                {nxn.guide.history.length ? `Khối đã được giải sau ${nxn.guide.history.length} bước.` : 'Khối đã ở trạng thái đã giải.'}
              </div>
              <button type="button" className="rb-btn rb-btn--primary" style={{ width: '100%', height: '48px', marginTop: '12px' }} onClick={() => nxn.dispatch({ type: 'START_SCAN' })}>
                Giải khối khác
              </button>
            </div>
          )}

          {nxn.guide.phase === 'ERROR' && (
            <div className="scan">
              <div className="rb-alert">
                {nxn.guide.errorKind === 'invalid'
                  ? `Trạng thái không hợp lệ: ${nxn.guide.error}`
                  : nxn.guide.errorKind === 'timeout'
                    ? 'Quá thời gian tính lời giải. Thử lại.'
                    : `Không tìm được lời giải: ${nxn.guide.error}`}
              </div>
              <button type="button" className="rb-btn rb-btn--primary" style={{ width: '100%', height: '48px', marginTop: '12px' }} onClick={() => nxn.dispatch({ type: 'START_SCAN' })}>
                Làm lại
              </button>
            </div>
          )}
        </div>
      )}

      <div className="scan" hidden={!sizeOk}>
        {notice && <div className="rb-alert">{notice}</div>}

        {/* Beginner mode views: Roadmap, Notation, Checkpoint, and Practice views */}
        {solveMode === 'beginner' && learnView === 'roadmap' && (
          <RoadmapView
            currentStageId={guidingNow ? currentStageDef.id : undefined}
            cubeState={guide.cube}
            completedStages={progressState.completed}
            practicedStages={progressState.practiced}
            onSelectStage={handleLearnFromStage}
            onOpenPractice={handleOpenPractice}
            lessonStageIds={['cross', 'corners', 'middle', 'topCross', 'topEdges', 'topCorners', 'topFace']}
            pendingStageIds={[]}
            onOpenLesson={(stage) => {
              if (stage.id === 'cross') setLearnView('lesson_cross')
              if (stage.id === 'corners') setLearnView('lesson_corners')
              if (stage.id === 'middle') setLearnView('lesson_middle')
              if (stage.id === 'topCross') setLearnView('lesson_topCross')
              if (stage.id === 'topEdges') setLearnView('lesson_lastEdges')
              if (stage.id === 'topCorners') setLearnView('lesson_lastCorners')
              if (stage.id === 'topFace') setLearnView('lesson_lastFace')
            }}
            onOpenNotation={() => {
              setNotationFrom('roadmap')
              setLearnView('notation')
            }}
            onClose={() => {
              if (guide.phase === 'GUIDING' || guide.phase === 'RECOVERING') {
                setLearnView('guide')
              } else {
                onCloseSection()
              }
            }}
          />
        )}

        {solveMode === 'beginner' && learnView === 'notation' && (
          <NotationView
            onBack={() => setLearnView(notationFrom)}
            onHighlightMove={(m) => get3()?.highlight(m)}
            onSpotlight={(t) => get3()?.spotlight(t)}
            onHighlightTurn={(t) => get3()?.highlightTurn(t)}
            faceColors={faceColorsHex}
            practice={lessonPractice}
            onPracticeChange={setLessonPractice}
            colorNames={Object.fromEntries(FACES.map((f) => [f, colors[f].label])) as Record<Face, string>}
          />
        )}

        {solveMode === 'beginner' && learnView === 'lesson_cross' && (
          <CrossLessonView
            faceColors={faceColorsHex}
            cube={practiceCube}
            moveCount={practiceHistory.length}
            onUndo={handleUndoPractice}
            onLoadSetup={(setup) => {
              const cube = applyMoves(SOLVED, setup)
              setPracticeCube(cube)
              writeHistory([])
              applyFaceletsSafely(toFacelets(cube), () => syncFromScene(cube))
            }}
            onHighlightMove={(m) => get3()?.highlight(m)}
            onHighlightTurn={(t) => get3()?.highlightTurn(t)}
            onSpotlight={(t) => get3()?.spotlight(t)}
            onMark={(c) => get3()?.mark(c)}
            colorNames={Object.fromEntries(FACES.map((f) => [f, colors[f].label])) as Record<Face, string>}
            practice={lessonPractice}
            onPracticeChange={setLessonPractice}
            onExit={() => {
              get3()?.highlight(null)
              setPracticeCube(null)
              writeHistory([])
              setLearnView('roadmap')
            }}
          />
        )}

        {solveMode === 'beginner' && learnView === 'lesson_corners' && (
          <CornerLessonView
            faceColors={faceColorsHex}
            cube={practiceCube}
            moveCount={practiceHistory.length}
            onUndo={handleUndoPractice}
            onLoadSetup={(setup) => {
              const cube = applyMoves(SOLVED, setup)
              setPracticeCube(cube)
              writeHistory([])
              applyFaceletsSafely(toFacelets(cube), () => syncFromScene(cube))
            }}
            onHighlightMove={(m) => get3()?.highlight(m)}
            onHighlightTurn={(t) => get3()?.highlightTurn(t)}
            onSpotlight={(t) => get3()?.spotlight(t)}
            onMark={(c) => get3()?.mark(c)}
            colorNames={Object.fromEntries(FACES.map((f) => [f, colors[f].label])) as Record<Face, string>}
            practice={lessonPractice}
            onPracticeChange={setLessonPractice}
            onExit={() => {
              get3()?.highlight(null)
              setPracticeCube(null)
              writeHistory([])
              setLearnView('roadmap')
            }}
          />
        )}

        {solveMode === 'beginner' && learnView === 'lesson_middle' && (
          <MiddleLessonView
            faceColors={faceColorsHex}
            cube={practiceCube}
            moveCount={practiceHistory.length}
            onUndo={handleUndoPractice}
            onLoadSetup={(setup) => {
              const cube = applyMoves(SOLVED, setup)
              setPracticeCube(cube)
              writeHistory([])
              applyFaceletsSafely(toFacelets(cube), () => syncFromScene(cube))
            }}
            onHighlightMove={(m) => get3()?.highlight(m)}
            onHighlightTurn={(t) => get3()?.highlightTurn(t)}
            onSpotlight={(t) => get3()?.spotlight(t)}
            onMark={(c) => get3()?.mark(c)}
            colorNames={Object.fromEntries(FACES.map((f) => [f, colors[f].label])) as Record<Face, string>}
            practice={lessonPractice}
            onPracticeChange={setLessonPractice}
            onExit={() => {
              get3()?.highlight(null)
              setPracticeCube(null)
              writeHistory([])
              setLearnView('roadmap')
            }}
          />
        )}

        {solveMode === 'beginner' && learnView === 'lesson_topCross' && (
          <TopCrossLessonView
            faceColors={faceColorsHex}
            cube={practiceCube}
            moveCount={practiceHistory.length}
            onUndo={handleUndoPractice}
            onLoadSetup={(setup) => {
              const cube = applyMoves(SOLVED, setup)
              setPracticeCube(cube)
              writeHistory([])
              applyFaceletsSafely(toFacelets(cube), () => syncFromScene(cube))
            }}
            onHighlightMove={(m) => get3()?.highlight(m)}
            onHighlightTurn={(t) => get3()?.highlightTurn(t)}
            onSpotlight={(t) => get3()?.spotlight(t)}
            onMark={(c) => get3()?.mark(c)}
            colorNames={Object.fromEntries(FACES.map((f) => [f, colors[f].label])) as Record<Face, string>}
            practice={lessonPractice}
            onPracticeChange={setLessonPractice}
            onExit={() => {
              get3()?.highlight(null)
              setPracticeCube(null)
              writeHistory([])
              setLearnView('roadmap')
            }}
          />
        )}

        {solveMode === 'beginner' && learnView === 'lesson_lastEdges' && (
          <LastEdgesLessonView
            faceColors={faceColorsHex}
            cube={practiceCube}
            moveCount={practiceHistory.length}
            onUndo={handleUndoPractice}
            onLoadSetup={(setup) => {
              const cube = applyMoves(SOLVED, setup)
              setPracticeCube(cube)
              writeHistory([])
              applyFaceletsSafely(toFacelets(cube), () => syncFromScene(cube))
            }}
            onHighlightMove={(m) => get3()?.highlight(m)}
            onHighlightTurn={(t) => get3()?.highlightTurn(t)}
            onSpotlight={(t) => get3()?.spotlight(t)}
            onMark={(c) => get3()?.mark(c)}
            colorNames={Object.fromEntries(FACES.map((f) => [f, colors[f].label])) as Record<Face, string>}
            practice={lessonPractice}
            onPracticeChange={setLessonPractice}
            onExit={() => {
              get3()?.highlight(null)
              setPracticeCube(null)
              writeHistory([])
              setLearnView('roadmap')
            }}
          />
        )}

        {solveMode === 'beginner' && learnView === 'lesson_lastCorners' && (
          <LastCornersLessonView
            faceColors={faceColorsHex}
            cube={practiceCube}
            moveCount={practiceHistory.length}
            onUndo={handleUndoPractice}
            onLoadSetup={(setup) => {
              const cube = applyMoves(SOLVED, setup)
              setPracticeCube(cube)
              writeHistory([])
              applyFaceletsSafely(toFacelets(cube), () => syncFromScene(cube))
            }}
            onHighlightMove={(m) => get3()?.highlight(m)}
            onHighlightTurn={(t) => get3()?.highlightTurn(t)}
            onSpotlight={(t) => get3()?.spotlight(t)}
            onMark={(c) => get3()?.mark(c)}
            colorNames={Object.fromEntries(FACES.map((f) => [f, colors[f].label])) as Record<Face, string>}
            practice={lessonPractice}
            onPracticeChange={setLessonPractice}
            onExit={() => {
              get3()?.highlight(null)
              setPracticeCube(null)
              writeHistory([])
              setLearnView('roadmap')
            }}
          />
        )}

        {solveMode === 'beginner' && learnView === 'lesson_lastFace' && (
          <LastFaceLessonView
            faceColors={faceColorsHex}
            cube={practiceCube}
            moveCount={practiceHistory.length}
            onUndo={handleUndoPractice}
            onLoadSetup={(setup) => {
              const cube = applyMoves(SOLVED, setup)
              setPracticeCube(cube)
              writeHistory([])
              applyFaceletsSafely(toFacelets(cube), () => syncFromScene(cube))
            }}
            onHighlightMove={(m) => get3()?.highlight(m)}
            onHighlightTurn={(t) => get3()?.highlightTurn(t)}
            onSpotlight={(t) => get3()?.spotlight(t)}
            onMark={(c) => get3()?.mark(c)}
            colorNames={Object.fromEntries(FACES.map((f) => [f, colors[f].label])) as Record<Face, string>}
            practice={lessonPractice}
            onPracticeChange={setLessonPractice}
            onExit={() => {
              get3()?.highlight(null)
              setPracticeCube(null)
              writeHistory([])
              setLearnView('roadmap')
            }}
          />
        )}

        {solveMode === 'beginner' && learnView === 'checkpoint' && (
          <CheckpointView
            stage={currentStageDef}
            cubeState={guide.cube}
            nextStage={nextStageDef}
            onMatch={handleCheckpointMatch}
            onNeedFix={handleCheckpointNeedFix}
            onOpenRoadmap={() => setLearnView('roadmap')}
            onOpenNotation={() => {
              setNotationFrom('checkpoint')
              setLearnView('notation')
            }}
          />
        )}

        {solveMode === 'beginner' && learnView === 'practice_source' && practiceStage && (
          <PracticeSourceView
            stage={practiceStage}
            onSelectSample={(sample) => handleStartPracticeSample(practiceStage, sample)}
            onStartScan={() => {
              setScanModeForPractice(true)
              dispatch({ type: 'START_SCAN', purpose: 'initial' })
              setLearnView(null)
            }}
            onBack={() => setLearnView('roadmap')}
            onOpenNotation={() => {
              setNotationFrom('practice_source')
              setLearnView('notation')
            }}
          />
        )}

        {solveMode === 'beginner' && learnView === 'practice' && practiceStage && practiceCube && (
          <PracticeView
            stage={practiceStage}
            cubeState={practiceCube}
            onHighlightMove={(m) => get3()?.highlight(m)}
            onUndo={handleUndoPractice}
            canUndo={practiceHistory.length > 0}
            moveHistory={practiceHistory.flatMap((t) => t.moves)}
            onStageComplete={handlePracticeStageComplete}
            onQuit={() => {
              get3()?.highlight(null)
              setLearnView('practice_source')
            }}
            onOpenNotation={() => {
              setNotationFrom('practice')
              setLearnView('notation')
            }}
          />
        )}

        {solveMode === 'beginner' && learnView === 'practice_done' && practiceStage && practiceStats && (
          <PracticeDoneView
            stage={practiceStage}
            stats={practiceStats}
            nextStage={STAGES[practiceStage.index + 1] ?? null}
            onNextStage={() => {
              const next = STAGES[practiceStage.index + 1]
              if (next) handleOpenPractice(next)
            }}
            onPracticeAgain={() => {
              if (practiceSample) {
                handleStartPracticeSample(practiceStage, practiceSample)
              } else {
                setLearnView('practice_source')
              }
            }}
            onBackToRoadmap={() => {
              get3()?.highlight(null)
              setLearnView('roadmap')
            }}
          />
        )}

        {solveMode === 'beginner' && learnView === 'precondition' && practiceStage && (
          <PreconditionView
            stage={practiceStage}
            missingStages={missingStages}
            onLearnMissingStage={(missingId) => {
              const missingDef = STAGES.find((s) => s.id === missingId)
              if (missingDef) handleLearnFromStage(missingDef)
            }}
            onUsePresetSample={() => setLearnView('practice_source')}
            onRescan={() => {
              setScanModeForPractice(true)
              dispatch({ type: 'START_SCAN', purpose: 'initial' })
              setLearnView(null)
            }}
            onBack={() => setLearnView('practice_source')}
          />
        )}

        {/* Kept mounted while reviewing so "Sửa lại" returns to the same faces and edits. */}
        {sizeOk && (scanning || guide.phase === 'REVIEWING') && (
          <div hidden={!scanning || learnOverlay || section === 'solve'}>
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
              onOpenLearn={() => onSelectSection('learn')}
            />
          </div>
        )}

        {!learnOverlay && guide.phase === 'REVIEWING' && (
          <div className="scan">
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rb-text)' }}>Kiểm tra trên khối 3D</div>
            <div style={{ fontSize: '13px', color: 'var(--rb-text-muted)', marginTop: '4px' }}>
              Khối 3D đang hiển thị trạng thái vừa quét. Kéo vào vùng nền để xoay khối 3D và so sánh từng mặt với khối thật.
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button type="button" className="rb-btn rb-btn--ghost" style={{ flex: 1, height: '48px' }} onClick={() => dispatch({ type: 'BACK_TO_SCAN' })}>
                Sửa lại
              </button>
              <button type="button" className="rb-btn rb-btn--primary" style={{ flex: 1, height: '48px' }} onClick={confirmReview}>
                Đúng rồi — Giải
              </button>
            </div>
          </div>
        )}

        {(!learnView || learnView === 'guide') && guide.phase === 'SOLVING' && (
          <div className="rb-alert" style={{ marginTop: '8px' }}>Đang tính lời giải...</div>
        )}

        {(!learnView || learnView === 'guide') && (guide.phase === 'GUIDING' || guide.phase === 'RECOVERING') && (
          solveMode === 'beginner' ? (
            <StepView
              guide={guide}
              colors={colors}
              currentStage={currentStageDef}
              bigSteps
              moveWhy={moveWhy}
              onDone={() => turnNow && report(turnNow)}
              onWrong={report}
              onOpenRoadmap={() => setLearnView('roadmap')}
              onOpenNotation={() => {
                setNotationFrom('guide')
                setLearnView('notation')
              }}
              onCheckStage={() => setLearnView('checkpoint')}
              onRescan={() => dispatch({ type: 'START_SCAN', purpose: 'initial' })}
              onAutoPlay={turnNow ? () => report(turnNow) : undefined}
            />
          ) : (
            <GuideView
              guide={guide}
              colors={colors}
              optimalStatus={optimalStatus}
              beginnerStage={undefined}
              onDone={() => turnNow && report(turnNow)}
              onWrong={report}
              onRescan={() => dispatch({ type: 'START_SCAN', purpose: 'initial' })}
            />
          )
        )}

        {guide.phase === 'VERIFYING' && (
          <div className="scan">
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rb-text)' }}>Theo tính toán, khối đã được giải</div>
            <div style={{ fontSize: '13px', color: 'var(--rb-text-muted)', marginTop: '4px' }}>Quét lại 6 mặt để xác nhận khối thật đúng như vậy.</div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button type="button" className="rb-btn rb-btn--ghost" style={{ flex: 1, height: '48px' }} onClick={() => dispatch({ type: 'SKIP_VERIFY' })}>
                Bỏ qua
              </button>
              <button type="button" className="rb-btn rb-btn--primary" style={{ flex: 1, height: '48px' }} onClick={() => dispatch({ type: 'START_SCAN', purpose: 'verify' })}>
                Quét xác nhận
              </button>
            </div>
          </div>
        )}

        {guide.phase === 'COMPLETED' && (
          <div className="scan">
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rb-text)' }}>Hoàn thành!</div>
            <div style={{ fontSize: '13px', color: 'var(--rb-text-muted)', marginTop: '4px' }}>
              {guide.history.length ? `Khối đã được giải sau ${guide.history.length} bước.` : 'Khối đã ở trạng thái đã giải.'}
            </div>
            <button type="button" className="rb-btn rb-btn--primary" style={{ width: '100%', height: '48px', marginTop: '12px' }} onClick={() => dispatch({ type: 'START_SCAN', purpose: 'initial' })}>
              Quét khối mới
            </button>
          </div>
        )}

        {guide.phase === 'ERROR' && (
          <div className="scan">
            <div className="rb-alert">Không tìm được lời giải: {guide.error}</div>
            <button type="button" className="rb-btn rb-btn--primary" style={{ width: '100%', height: '48px', marginTop: '12px' }} onClick={() => dispatch({ type: 'START_SCAN', purpose: 'initial' })}>
              Quét lại
            </button>
          </div>
        )}
      </div>
    </CameraPanel>
  )
}
