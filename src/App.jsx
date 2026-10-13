import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { normalizeSteps, rotateGridIndex, rotateStickers } from './rubikLogic'
import { fromFacelets } from './smart-solver/core'
import {
  faceletsToStickerMap,
  gridKey,
  layerTurnToEvent,
  moveToLayerTurn,
  readOrientation,
  stickerModelToFacelets
} from './smart-solver/adapter/stickerModel'
import { layerTurnToToken, sceneToStickers, stickersToScene, tokenToLayerTurn } from './smart-solver/adapter/nxnModel'
import SmartSolverPanel from './smart-solver/ui/SmartSolverPanel'
import { useMediaQuery, DESKTOP_QUERY } from './ui/useMediaQuery'
import { usePersistentHost } from './ui/usePersistentHost'
import PlayShell from './ui/PlayShell'
import SizeSheet from './ui/SizeSheet'

const COLORS = {
  white: 0xf4f4f4,
  yellow: 0xf4c430,
  green: 0x16c172,
  blue: 0x2a6cff,
  red: 0xff4b3e,
  orange: 0xff8c2b,
  core: 0x0f1116
}

/** Sticker colors in createCubie order: +x, -x, +y, -y, +z, -z. */
function getVariantFaceColors(faceColor) {
  return [faceColor.R, faceColor.L, faceColor.U, faceColor.D, faceColor.F, faceColor.B]
}

const STICKER_KEYS = ['px', 'nx', 'py', 'ny', 'pz', 'nz']
const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B']
const DEFAULT_FACE_COLOR = { R: COLORS.red, L: COLORS.orange, U: COLORS.white, D: COLORS.yellow, F: COLORS.green, B: COLORS.blue }
const HIGHLIGHT_EMISSIVE = 0x2a3f66
const ARROW_COLOR = 0x5ee7ff

export default function App() {
  const stage = usePersistentHost('canvas-wrap')
  const solver = usePersistentHost('solver-host')
  const [solverPhase, setSolverPhase] = useState('SCANNING')
  const [size, setSize] = useState(3)
  const [resetKey, setResetKey] = useState(0)
  const [showSizeModal, setShowSizeModal] = useState(false)
  const sizeButtonRef = useRef(null)
  const [showCamera, setShowCamera] = useState(false)
  // Mounted on first open, then only hidden, so the scan/guidance survives closing the panel.
  const [cameraMounted, setCameraMounted] = useState(false)
  const [solverHeadSlot, setSolverHeadSlot] = useState(null)
  // Tells the smart solver a new scene/controller exists (child effects run before this one's).
  const [sceneVersion, setSceneVersion] = useState(0)
  // Bumped when a scramble animation has finished, so the smart solver can take the new state.
  const [scrambleVersion, setScrambleVersion] = useState(0)
  const [activeTab, setActiveTab] = useState('play')
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [timeMs, setTimeMs] = useState(0)
  const [moves, setMoves] = useState(0)
  const [running, setRunning] = useState(false)
  const [scrambled, setScrambled] = useState(false)
  const [solved, setSolved] = useState(true)

  const handleSelectTab = useCallback((tab) => {
    setActiveTab(tab)
    if (tab === 'solver') {
      setCameraMounted(true)
      setShowCamera(true)
    } else {
      setShowCamera(false)
    }
  }, [])

  const handleOpenSolver = useCallback(() => {
    setCameraMounted(true)
    setShowCamera(true)
  }, [])

  const handleCloseSolver = useCallback(() => {
    setShowCamera(false)
  }, [])

  const handleOpenSizeModal = useCallback(() => {
    setShowSizeModal(true)
  }, [])

  const handleCloseSizeModal = useCallback(() => {
    setShowSizeModal(false)
  }, [])

  const handleSelectSize = useCallback((newSize) => {
    setSize(newSize)
  }, [])

  const scrambleRef = useRef(null)
  const zoomInRef = useRef(null)
  const zoomOutRef = useRef(null)
  const cubeControllerRef = useRef(null)
  // Center colors survive size changes and resets (the smart solver may set the user's scheme).
  const faceColorRef = useRef({ ...DEFAULT_FACE_COLOR })
  const getCubeController = useCallback(() => cubeControllerRef.current, [])
  const movesRef = useRef(moves)
  const runningRef = useRef(running)
  const scrambledRef = useRef(scrambled)
  const solvedRef = useRef(solved)
  const timeRef = useRef(timeMs)
  const timerRef = useRef(null)

  useEffect(() => { movesRef.current = moves }, [moves])
  useEffect(() => { runningRef.current = running }, [running])
  useEffect(() => { scrambledRef.current = scrambled }, [scrambled])
  useEffect(() => { solvedRef.current = solved }, [solved])
  useEffect(() => { timeRef.current = timeMs }, [timeMs])

  useEffect(() => {
    setMoves(0)
    setTimeMs(0)
    setRunning(false)
    setScrambled(false)
    setSolved(true)
  }, [size, resetKey])

  useEffect(() => {
    if (!running) return
    let last = performance.now()
    timerRef.current = window.setInterval(() => {
      const now = performance.now()
      timeRef.current += now - last
      last = now
      setTimeMs(timeRef.current)
    }, 100)
    return () => {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [running])

  useEffect(() => {
    const mount = stage.host
    if (!mount) return

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x05070c, 12, 50)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(0, 3.1, 9)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x05070c, 1)
    mount.appendChild(renderer.domElement)

    const ambient = new THREE.AmbientLight(0xffffff, 0.55)
    scene.add(ambient)

    const key = new THREE.DirectionalLight(0xffffff, 0.85)
    key.position.set(6, 8, 6)
    scene.add(key)

    const rim = new THREE.DirectionalLight(0x6bb6ff, 0.5)
    rim.position.set(-6, -3, -8)
    scene.add(rim)

    const stars = createStarField()
    scene.add(stars)

    const spacing = 1.06
    const faceColor = faceColorRef.current
    let colorFace = new Map(Object.entries(faceColor).map(([face, color]) => [color, face]))
    const { cubeGroup, cubies } = createRubikGroup(size, spacing, faceColor)
    scene.add(cubeGroup)

    const raycaster = new THREE.Raycaster()
    const pointerNdc = new THREE.Vector2()
    const cameraDir = camera.position.clone().normalize()
    let zoomRadius = camera.position.length()
    let hasUserZoomed = false
    const zoomStep = 0.7

    let isPointerDown = false
    let mode = null
    let startX = 0
    let startY = 0
    let hitPoint = new THREE.Vector3()
    let faceNormalWorld = new THREE.Vector3()
    let axisName = null
    let axisVector = new THREE.Vector3()
    let axisWorld = new THREE.Vector3()
    let layerValue = 0
    let pivot = null
    let activeCubies = []
    let dragAngle = 0
    let viewPlane = new THREE.Plane()
    const planeStart = new THREE.Vector3()
    const planeCurrent = new THREE.Vector3()
    let tween = null
    let moveQueue = []
    let isAuto = false
    let scrambling = false
    let lastMove = null
    const userMoveListeners = new Set()
    const userTurnListeners = new Set()
    /** { move } relative to the centers (3x3) or { token } in the scene frame (any size). */
    let highlighted = null

    function setPointerNdc(event) {
      const rect = renderer.domElement.getBoundingClientRect()
      pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    }

    function intersectCubies(event) {
      setPointerNdc(event)
      raycaster.setFromCamera(pointerNdc, camera)
      return raycaster.intersectObjects(cubies, false)
    }

    function getPlanePoint(event, target) {
      setPointerNdc(event)
      raycaster.setFromCamera(pointerNdc, camera)
      raycaster.ray.intersectPlane(viewPlane, target)
    }

    function pickAxis(dragWorld) {
      if (dragWorld.length() < 0.08) return null
      const axisWorldHint = faceNormalWorld.clone().cross(dragWorld).normalize()
      if (axisWorldHint.length() < 0.2) return null

      const axes = [
        { name: 'x', vec: new THREE.Vector3(1, 0, 0) },
        { name: 'y', vec: new THREE.Vector3(0, 1, 0) },
        { name: 'z', vec: new THREE.Vector3(0, 0, 1) }
      ]

      let best = null
      let bestScore = 0

      axes.forEach((axis) => {
        const axisWorldVec = axis.vec.clone().applyQuaternion(cubeGroup.quaternion).normalize()
        if (Math.abs(axisWorldVec.dot(faceNormalWorld)) > 0.8) return
        const score = Math.abs(axisWorldVec.dot(axisWorldHint))
        if (score > bestScore) {
          bestScore = score
          best = axis
        }
      })

      return best
    }

    const colorToFace = (color) => colorFace.get(color) ?? null

    function readSceneOrientation() {
      return readOrientation(cubies.map((c) => c.userData), colorToFace)
    }

    // Curved arrow around the layer to turn: an arc in the layer's plane plus a cone head.
    const arrowGroup = new THREE.Group()
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: ARROW_COLOR, transparent: true, opacity: 0.85 })
    const arrowAxis = new THREE.Vector3()
    let arrowOffset = 0
    arrowGroup.visible = false
    cubeGroup.add(arrowGroup)

    function buildArrow(turn) {
      arrowGroup.children.forEach((child) => child.geometry.dispose())
      arrowGroup.clear()
      if (!turn) return
      // Built around +Z, centred on +X; positive steps turn +X towards +Y (right-hand rule).
      const span = Math.abs(turn.steps) === 2 ? Math.PI : Math.PI / 2
      const sign = turn.steps > 0 ? 1 : -1
      const radius = 1.5 * spacing * Math.SQRT2 + 0.35
      const points = []
      for (let i = 0; i <= 32; i += 1) {
        const a = -span / 2 + (span * i) / 32
        points.push(new THREE.Vector3(radius * Math.cos(a), radius * Math.sin(a), 0))
      }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, 0.07, 8, false), arrowMaterial)
      const end = (sign * span) / 2
      const tangent = new THREE.Vector3(-Math.sin(end) * sign, Math.cos(end) * sign, 0)
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 20), arrowMaterial)
      head.position.set(radius * Math.cos(end), radius * Math.sin(end), 0).addScaledVector(tangent, 0.18)
      head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent)
      arrowGroup.add(tube, head)
      arrowAxis.set(turn.axis === 'x' ? 1 : 0, turn.axis === 'y' ? 1 : 0, turn.axis === 'z' ? 1 : 0)
      arrowOffset = getCoordFromIndex(turn.layers.reduce((a, b) => a + b, 0) / turn.layers.length, spacing, size)
    }

    const arrowBasis = new THREE.Matrix4()
    const arrowX = new THREE.Vector3()
    const arrowY = new THREE.Vector3()
    /** Keeps the arc on the side of the layer facing the camera. */
    function orientArrow(time) {
      const toCamera = cubeGroup.worldToLocal(camera.position.clone())
      arrowX.copy(toCamera).addScaledVector(arrowAxis, -toCamera.dot(arrowAxis))
      if (arrowX.lengthSq() < 1e-6) arrowX.set(arrowAxis.y, arrowAxis.z, arrowAxis.x)
      arrowX.normalize()
      arrowY.crossVectors(arrowAxis, arrowX)
      arrowBasis.makeBasis(arrowX, arrowY, arrowAxis)
      arrowGroup.quaternion.setFromRotationMatrix(arrowBasis)
      arrowGroup.position.copy(arrowAxis).multiplyScalar(arrowOffset)
      arrowMaterial.opacity = 0.6 + 0.3 * Math.sin(time * 0.006)
    }

    function toMultiLayer(turn) {
      return { axis: turn.axis, layers: [turn.layer], steps: turn.steps }
    }

    function applyHighlight() {
      const turn = highlighted?.move
        ? toMultiLayer(moveToLayerTurn(highlighted.move, readSceneOrientation() ?? undefined))
        : highlighted?.token
          ? tokenToLayerTurn(highlighted.token, size)
          : null
      cubies.forEach((cubie) => {
        const lit = turn && turn.layers.includes(cubie.userData.grid[turn.axis])
        cubie.material.forEach((m) => m.emissive.setHex(lit ? HIGHLIGHT_EMISSIVE : 0x000000))
      })
      buildArrow(turn)
    }

    /** Every face one color, whichever way round the cube is (a slice turn moves the centers). */
    function isCubeSolved() {
      const faceColorSeen = {}
      for (const cubie of cubies) {
        const { x, y, z } = cubie.userData.grid
        const onFace = { px: x === size - 1, nx: x === 0, py: y === size - 1, ny: y === 0, pz: z === size - 1, nz: z === 0 }
        for (const key of STICKER_KEYS) {
          if (!onFace[key]) continue
          const color = cubie.userData.stickers[key]
          if (!(key in faceColorSeen)) faceColorSeen[key] = color
          else if (faceColorSeen[key] !== color) return false
        }
      }
      return true
    }

    function attachLayers(axis, layers) {
      axisName = axis
      axisVector.set(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0)
      axisWorld = axisVector.clone().applyQuaternion(cubeGroup.quaternion).normalize()
      layerValue = layers.length === 1 ? layers[0] : null

      pivot = new THREE.Group()
      cubeGroup.add(pivot)

      activeCubies = []
      cubies.forEach((cubie) => {
        if (layers.includes(cubie.userData.grid[axis])) {
          activeCubies.push(cubie)
          pivot.attach(cubie)
        }
      })
    }

    function applyRotationToState(steps) {
      if (!steps) return
      const dir = Math.sign(steps)
      const times = Math.abs(steps)
      for (let i = 0; i < times; i += 1) {
        activeCubies.forEach((cubie) => {
          cubie.userData.grid = rotateGridIndex(cubie.userData.grid, axisName, dir, size)
          cubie.userData.stickers = rotateStickers(cubie.userData.stickers, axisName, dir)
        })
      }
    }

    function finalizeLayer(steps = 0, source = 'user') {
      if (!pivot) return
      pivot.updateMatrixWorld(true)
      const turn = { axis: axisName, layer: layerValue, steps }
      const orientation = size === 3 ? readSceneOrientation() : null

      applyRotationToState(steps)

      activeCubies.forEach((cubie) => {
        cubeGroup.attach(cubie)
        const { x, y, z } = cubie.userData.grid
        cubie.position.x = getCoordFromIndex(x, spacing, size)
        cubie.position.y = getCoordFromIndex(y, spacing, size)
        cubie.position.z = getCoordFromIndex(z, spacing, size)
        cubie.rotation.x = Math.round(cubie.rotation.x / (Math.PI / 2)) * (Math.PI / 2)
        cubie.rotation.y = Math.round(cubie.rotation.y / (Math.PI / 2)) * (Math.PI / 2)
        cubie.rotation.z = Math.round(cubie.rotation.z / (Math.PI / 2)) * (Math.PI / 2)
        cubie.updateMatrixWorld(true)
      })

      cubeGroup.remove(pivot)
      pivot = null
      activeCubies = []
      axisName = null

      // Turns made from the smart solver's guidance ("Đã xoay") count like dragged ones.
      const byPlayer = source === 'user' || source === 'controller'
      if (byPlayer && steps !== 0 && scrambledRef.current) {
        if (solvedRef.current) setSolved(false)
        if (!runningRef.current) setRunning(true)
        setMoves((prev) => prev + 1)
      }

      if (byPlayer && scrambledRef.current) {
        const solvedNow = isCubeSolved()
        if (solvedNow) {
          setSolved(true)
          setRunning(false)
        }
      }

      applyHighlight()

      if (source === 'user' && steps !== 0 && orientation) {
        const event = layerTurnToEvent(turn, orientation)
        if (event) userMoveListeners.forEach((listener) => listener(event))
      }
      const token = source === 'user' && turn.layer !== null ? layerTurnToToken(turn, size) : null
      if (token) userTurnListeners.forEach((listener) => listener(token))
    }

    function startTweenToSteps(steps, source, callbacks = {}) {
      const step = Math.PI / 2
      const normalized = normalizeSteps(steps)
      if (!normalized) {
        finalizeLayer(0, source)
        callbacks.onDone?.()
        return
      }
      lastMove = { steps: normalized, source, ...callbacks }
      const start = pivot.rotation[axisName]
      tween = {
        axis: axisName,
        start,
        end: normalized * step,
        startTime: performance.now(),
        duration: 100
      }
    }

    function startAutoMove(move) {
      if (!move) return
      if (pivot || tween) return
      const turn = move.move
        ? toMultiLayer(moveToLayerTurn(move.move, readSceneOrientation() ?? undefined))
        : move.token
          ? tokenToLayerTurn(move.token, size)
          : toMultiLayer(move)
      attachLayers(turn.axis, turn.layers)
      pivot.rotation[turn.axis] = 0
      startTweenToSteps(turn.steps, move.source ?? 'scramble', move)
    }

    function generateScrambleSequence() {
      const length = 16 + size * 6
      const sequence = []
      const axes = ['x', 'y', 'z']
      for (let i = 0; i < length; i += 1) {
        const axis = axes[Math.floor(Math.random() * axes.length)]
        const layer = Math.floor(Math.random() * size)
        const stepRand = Math.random()
        const steps = stepRand > 0.85 ? 2 : stepRand > 0.425 ? 1 : -1
        sequence.push({ axis, layer, steps })
      }
      return sequence
    }

    function setupPivot(axis) {
      axisName = axis.name
      axisVector.copy(axis.vec)
      axisWorld = axisVector.clone().applyQuaternion(cubeGroup.quaternion).normalize()

      const grid = activeCubies[0].userData.grid
      layerValue = grid[axisName]

      pivot = new THREE.Group()
      cubeGroup.add(pivot)

      const newActive = []
      cubies.forEach((cubie) => {
        const value = cubie.userData.grid[axisName]
        if (value === layerValue) {
          newActive.push(cubie)
          pivot.attach(cubie)
        }
      })

      activeCubies = newActive
    }

    function onPointerDown(event) {
      if (tween || isAuto || moveQueue.length > 0) return
      isPointerDown = true
      startX = event.clientX
      startY = event.clientY

      const hits = intersectCubies(event)
      if (hits.length === 0) {
        mode = 'orbit'
        return
      }

      mode = 'twist'
      const hit = hits[0]
      hitPoint.copy(hit.point)

      const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)
      faceNormalWorld.copy(hit.face.normal).applyNormalMatrix(normalMatrix).normalize()

      const viewDir = new THREE.Vector3()
      camera.getWorldDirection(viewDir)
      viewPlane.setFromNormalAndCoplanarPoint(viewDir, hitPoint)
      getPlanePoint(event, planeStart)

      activeCubies = [hit.object]
      axisName = null
      dragAngle = 0
    }

    function onPointerMove(event) {
      if (!isPointerDown || tween) return

      if (mode === 'orbit') {
        const dx = event.clientX - startX
        const dy = event.clientY - startY
        startX = event.clientX
        startY = event.clientY

        cubeGroup.rotation.y += dx * 0.005
        cubeGroup.rotation.x += dy * 0.005
        cubeGroup.rotation.x = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, cubeGroup.rotation.x))
        return
      }

      if (mode === 'twist') {
        if (!axisName) {
          getPlanePoint(event, planeCurrent)
          const dragWorld = planeCurrent.clone().sub(planeStart)
          const axis = pickAxis(dragWorld)
          if (!axis) return
          setupPivot(axis)
        }

        if (!pivot) return
        getPlanePoint(event, planeCurrent)
        const dragWorld = planeCurrent.clone().sub(planeStart)
        const tangent = new THREE.Vector3().crossVectors(axisWorld, faceNormalWorld).normalize()
        const sign = Math.sign(dragWorld.dot(tangent)) || 1
        const magnitude = Math.min(dragWorld.length() / (spacing * 1.6), 1.2)
        dragAngle = sign * magnitude * (Math.PI / 2)
        pivot.rotation[axisName] = dragAngle
      }
    }

    function onPointerUp() {
      if (!isPointerDown) return
      isPointerDown = false

      if (mode === 'twist' && pivot && axisName) {
        const step = Math.PI / 2
        const target = Math.round(dragAngle / step)
        startTweenToSteps(target, 'user')
      }

      mode = null
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

    function isDesktopViewport() {
      if (typeof window === 'undefined') return false
      return window.matchMedia ? window.matchMedia(DESKTOP_QUERY).matches : window.innerWidth >= 960
    }

    function getDefaultScale() {
      return isDesktopViewport() ? 0.9 : 0.78
    }

    function getDefaultZoom() {
      return isDesktopViewport() ? 9.6 : 11.2
    }

    function resize() {
      const rect = mount.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      camera.aspect = rect.width / rect.height
      camera.updateProjectionMatrix()
      camera.lookAt(0, 0, 0)
      renderer.setSize(rect.width, rect.height)

      if (!hasUserZoomed) {
        cubeGroup.scale.setScalar(getDefaultScale())
        zoomRadius = getDefaultZoom()
        camera.position.copy(cameraDir.clone().multiplyScalar(zoomRadius))
        camera.lookAt(0, 0, 0)
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      resize()
    })
    resizeObserver.observe(mount)

    function applyZoom(delta) {
      hasUserZoomed = true
      zoomRadius = THREE.MathUtils.clamp(zoomRadius + delta, 5.5, 14)
      camera.position.copy(cameraDir.clone().multiplyScalar(zoomRadius))
      camera.lookAt(0, 0, 0)
    }

    function onWheel(event) {
      event.preventDefault()
      applyZoom(event.deltaY * 0.003)
    }

    zoomInRef.current = () => applyZoom(-zoomStep)
    zoomOutRef.current = () => applyZoom(zoomStep)

    resize()
    window.addEventListener('resize', resize)

    let lastTime = performance.now()
    function animate(time) {
      const delta = (time - lastTime) / 1000
      lastTime = time

      stars.rotation.y += delta * 0.02
      stars.rotation.x += delta * 0.01

      if (tween && pivot) {
        const t = Math.min((time - tween.startTime) / tween.duration, 1)
        const eased = 1 - Math.pow(1 - t, 3)
        pivot.rotation[tween.axis] = THREE.MathUtils.lerp(tween.start, tween.end, eased)
        if (t >= 1) {
          tween = null
          const finished = lastMove
          finalizeLayer(finished?.steps ?? 0, finished?.source ?? 'user')
          lastMove = null
          finished?.onDone?.()
        }
      }

      if (!tween && !pivot && moveQueue.length > 0) {
        isAuto = true
        startAutoMove(moveQueue.shift())
      }

      if (!tween && moveQueue.length === 0 && isAuto) {
        isAuto = false
        if (scrambling) {
          scrambling = false
          setScrambleVersion((v) => v + 1)
        }
      }

      arrowGroup.visible = highlighted !== null && !tween && !pivot && arrowGroup.children.length > 0
      if (arrowGroup.visible) orientArrow(time)

      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }

    scrambleRef.current = () => {
      if (tween || pivot || moveQueue.length > 0) return
      moveQueue = generateScrambleSequence()
      isAuto = true
      scrambling = true
      setScrambled(true)
      setSolved(false)
      setMoves(0)
      setTimeMs(0)
      setRunning(false)
      timeRef.current = 0
      movesRef.current = 0
    }

    const raf = requestAnimationFrame(animate)

    const isBusy = () => Boolean(tween || pivot || moveQueue.length > 0)
    const labelOf = (color) => FACE_ORDER.indexOf(colorFace.get(color) ?? '')

    function paintStickers(stickerMap, toColor) {
      cubies.forEach((cubie) => {
        const faces = stickerMap.get(gridKey(cubie.userData.grid))
        const stickers = {}
        STICKER_KEYS.forEach((key, i) => {
          const face = faces?.[key]
          stickers[key] = face == null ? null : toColor(face)
          cubie.material[i].color.setHex(stickers[key] ?? COLORS.core)
        })
        cubie.userData.stickers = stickers
        cubie.rotation.set(0, 0, 0)
        cubie.updateMatrixWorld(true)
      })
      applyHighlight()
    }

    function queueMove(entry) {
      return new Promise((resolve, reject) => {
        moveQueue.push({ ...entry, source: 'controller', onDone: resolve, onCancel: () => reject(new Error('cube scene disposed')) })
      })
    }

    /** @type {import('./smart-solver/adapter/types').NxnController} */
    const nxnController = {
      size,
      getStickers() {
        return sceneToStickers(cubies.map((c) => c.userData), size, labelOf)
      },
      setStickers(stickers) {
        if (isBusy()) return false
        paintStickers(stickersToScene(stickers, size), (label) => faceColor[FACE_ORDER[label]] ?? COLORS.core)
        return true
      },
      playTurn(token) {
        return queueMove({ token })
      },
      highlightTurn(token) {
        highlighted = token ? { token } : null
        applyHighlight()
      },
      onUserTurn(listener) {
        userTurnListeners.add(listener)
        return () => userTurnListeners.delete(listener)
      },
      setFaceColors(colors) {
        if (isBusy()) return false
        // Read the state with the old colors, then repaint it with the new ones.
        const stickers = nxnController.getStickers()
        Object.assign(faceColor, colors)
        colorFace = new Map(Object.entries(faceColor).map(([face, color]) => [color, face]))
        nxnController.setStickers(stickers)
        return true
      }
    }

    /** @type {import('./smart-solver/adapter/types').NxnController} */
    const controller = size !== 3 ? nxnController : {
      ...nxnController,
      getFacelets() {
        return stickerModelToFacelets(cubies.map((c) => c.userData), colorToFace)
      },
      setFacelets(facelets) {
        if (isBusy()) return { ok: false, reason: 'busy' }
        const result = fromFacelets(facelets)
        if (!result.ok) return { ok: false, reason: 'invalid', errors: result.errors }
        paintStickers(faceletsToStickerMap(facelets), (face) => faceColor[face])
        return { ok: true }
      },
      playMove(move) {
        return queueMove({ move })
      },
      highlight(move) {
        highlighted = move ? { move } : null
        applyHighlight()
      },
      onUserMove(listener) {
        userMoveListeners.add(listener)
        return () => userMoveListeners.delete(listener)
      }
    }
    cubeControllerRef.current = controller
    setSceneVersion((v) => v + 1)
    if (import.meta.env.DEV) window.__cube = controller

    return () => {
      resizeObserver.disconnect()
      lastMove?.onCancel?.()
      moveQueue.forEach((move) => move.onCancel?.())
      moveQueue = []
      userMoveListeners.clear()
      userTurnListeners.clear()
      cubeControllerRef.current = null
      if (import.meta.env.DEV && window.__cube === controller) delete window.__cube
      scrambleRef.current = null
      zoomInRef.current = null
      zoomOutRef.current = null
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.dispose()
      mount.removeChild(renderer.domElement)
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
          else obj.material.dispose()
        }
      })
    }
  }, [size, resetKey])

  const statusText = scrambled
    ? solved
      ? 'Đã giải'
      : running
        ? 'Đang giải...'
        : 'Sẵn sàng'
    : 'Nhấn xáo trộn để bắt đầu'

  return (
    <>
      <PlayShell
        stageSlotRef={stage.slotRef}
        solverSlotRef={solver.slotRef}
        solverPhase={solverPhase}
        timeMs={timeMs}
        moves={moves}
        running={running}
        statusText={statusText}
        size={size}
        onScramble={() => scrambleRef.current?.()}
        onReset={() => setResetKey((v) => v + 1)}
        onZoomIn={() => zoomInRef.current?.()}
        onZoomOut={() => zoomOutRef.current?.()}
        onOpenSize={handleOpenSizeModal}
        onChangeSize={(n) => setSize(n)}
        isDesktop={isDesktop}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        showSolver={showCamera}
        onOpenSolver={handleOpenSolver}
        onCloseSolver={handleCloseSolver}
        sizeTriggerRef={sizeButtonRef}
      />

      {cameraMounted && solver.host && createPortal(
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {showCamera && <div className="solver-head" ref={setSolverHeadSlot} />}
          <SmartSolverPanel
            open={showCamera}
            headerSlot={solverHeadSlot}
            getController={getCubeController}
            cubeSize={size}
            sceneVersion={sceneVersion}
            scrambleVersion={scrambleVersion}
            resetVersion={resetKey}
            onRequestSize={setSize}
            onPhaseChange={setSolverPhase}
          />
        </div>,
        solver.host
      )}

      <SizeSheet
        isOpen={showSizeModal}
        currentSize={size}
        onSelect={handleSelectSize}
        onClose={handleCloseSizeModal}
        triggerRef={sizeButtonRef}
      />
    </>
  )
}

function getIndexFromPosition(value, spacing, size) {
  const half = (size - 1) / 2
  return Math.round(value / spacing + half)
}

function getCoordFromIndex(index, spacing, size) {
  const half = (size - 1) / 2
  return (index - half) * spacing
}

function createRubikGroup(size, spacing, faceColor) {
  const cubeGroup = new THREE.Group()
  const cubies = []
  const half = (size - 1) / 2

  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      for (let k = 0; k < size; k += 1) {
        const cubie = createCubie(i, j, k, size, faceColor)
        cubie.position.set((i - half) * spacing, (j - half) * spacing, (k - half) * spacing)
        const stickers = cubie.userData.stickers
        cubie.userData = {
          isCubie: true,
          grid: { x: i, y: j, z: k },
          home: { x: i, y: j, z: k },
          stickers
        }
        cubeGroup.add(cubie)
        cubies.push(cubie)
      }
    }
  }

  cubeGroup.rotation.y = Math.PI * 0.15
  cubeGroup.rotation.x = -Math.PI * 0.08

  return { cubeGroup, cubies }
}

function createCubie(i, j, k, size, faceColor) {
  const geometry = new THREE.BoxGeometry(0.98, 0.98, 0.98)
  const isOuterPosX = i === size - 1
  const isOuterNegX = i === 0
  const isOuterPosY = j === size - 1
  const isOuterNegY = j === 0
  const isOuterPosZ = k === size - 1
  const isOuterNegZ = k === 0

  const baseColors = getVariantFaceColors(faceColor)
  let faceColors = [
    isOuterPosX ? baseColors[0] : COLORS.core,
    isOuterNegX ? baseColors[1] : COLORS.core,
    isOuterPosY ? baseColors[2] : COLORS.core,
    isOuterNegY ? baseColors[3] : COLORS.core,
    isOuterPosZ ? baseColors[4] : COLORS.core,
    isOuterNegZ ? baseColors[5] : COLORS.core
  ]

  const stickers = {
    px: isOuterPosX ? faceColors[0] : null,
    nx: isOuterNegX ? faceColors[1] : null,
    py: isOuterPosY ? faceColors[2] : null,
    ny: isOuterNegY ? faceColors[3] : null,
    pz: isOuterPosZ ? faceColors[4] : null,
    nz: isOuterNegZ ? faceColors[5] : null
  }

  const materials = faceColors.map((color) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.1
  }))
  const mesh = new THREE.Mesh(geometry, materials)
  mesh.userData = { stickers }
  return mesh
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const centis = Math.floor((ms % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`
}

function createStarField() {
  const count = 1400
  const positions = new Float32Array(count * 3)

  for (let i = 0; i < count; i += 1) {
    const radius = 18 + Math.random() * 50
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const idx = i * 3
    positions[idx] = radius * Math.sin(phi) * Math.cos(theta)
    positions[idx + 1] = radius * Math.cos(phi)
    positions[idx + 2] = radius * Math.sin(phi) * Math.sin(theta)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.PointsMaterial({
    color: 0x7aa6ff,
    size: 0.12,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.75
  })

  return new THREE.Points(geometry, material)
}
