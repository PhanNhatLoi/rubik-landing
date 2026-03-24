import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const COLORS = {
  white: 0xf4f4f4,
  yellow: 0xf4c430,
  green: 0x16c172,
  blue: 0x2a6cff,
  red: 0xff4b3e,
  orange: 0xff8c2b,
  core: 0x0f1116
}

function getVariantFaceColors() {
  return [COLORS.red, COLORS.orange, COLORS.white, COLORS.yellow, COLORS.green, COLORS.blue]
}

export default function App() {
  const mountRef = useRef(null)
  const [size, setSize] = useState(3)
  const [resetKey, setResetKey] = useState(0)
  const [showSizeModal, setShowSizeModal] = useState(false)
  const [timeMs, setTimeMs] = useState(0)
  const [moves, setMoves] = useState(0)
  const [running, setRunning] = useState(false)
  const [scrambled, setScrambled] = useState(false)
  const [solved, setSolved] = useState(true)

  const scrambleRef = useRef(null)
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
    const mount = mountRef.current
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
    const { cubeGroup, cubies } = createRubikGroup(size, spacing)
    scene.add(cubeGroup)

    const raycaster = new THREE.Raycaster()
    const pointerNdc = new THREE.Vector2()
    const cameraDir = camera.position.clone().normalize()
    let zoomRadius = camera.position.length()

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
    let lastMove = null

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

    const expectedFaceColors = getVariantFaceColors()

    function normalizeSteps(steps) {
      let s = ((steps % 4) + 4) % 4
      if (s === 3) s = -1
      return s
    }

    function rotateGridIndex(grid, axis, dir) {
      const c = (size - 1) / 2
      const x = grid.x - c
      const y = grid.y - c
      const z = grid.z - c
      let nx = x
      let ny = y
      let nz = z

      if (axis === 'x') {
        if (dir === 1) {
          ny = -z
          nz = y
        } else {
          ny = z
          nz = -y
        }
      }

      if (axis === 'y') {
        if (dir === 1) {
          nx = z
          nz = -x
        } else {
          nx = -z
          nz = x
        }
      }

      if (axis === 'z') {
        if (dir === 1) {
          nx = -y
          ny = x
        } else {
          nx = y
          ny = -x
        }
      }

      return {
        x: Math.round(nx + c),
        y: Math.round(ny + c),
        z: Math.round(nz + c)
      }
    }

    function rotateStickers(stickers, axis, dir) {
      const s = { ...stickers }
      const n = { ...stickers }

      if (axis === 'x') {
        if (dir === 1) {
          n.pz = s.py
          n.ny = s.pz
          n.nz = s.ny
          n.py = s.nz
        } else {
          n.nz = s.py
          n.py = s.pz
          n.pz = s.ny
          n.ny = s.nz
        }
        n.px = s.px
        n.nx = s.nx
      }

      if (axis === 'y') {
        if (dir === 1) {
          n.nz = s.px
          n.px = s.pz
          n.pz = s.nx
          n.nx = s.nz
        } else {
          n.pz = s.px
          n.px = s.nz
          n.nz = s.nx
          n.nx = s.pz
        }
        n.py = s.py
        n.ny = s.ny
      }

      if (axis === 'z') {
        if (dir === 1) {
          n.py = s.px
          n.nx = s.py
          n.ny = s.nx
          n.px = s.ny
        } else {
          n.ny = s.px
          n.px = s.py
          n.py = s.nx
          n.nx = s.ny
        }
        n.pz = s.pz
        n.nz = s.nz
      }

      return n
    }

    function isCubeSolved() {
      for (const cubie of cubies) {
        const { x, y, z } = cubie.userData.grid
        const stickers = cubie.userData.stickers
        if (x === size - 1 && stickers.px !== expectedFaceColors[0]) return false
        if (x === 0 && stickers.nx !== expectedFaceColors[1]) return false
        if (y === size - 1 && stickers.py !== expectedFaceColors[2]) return false
        if (y === 0 && stickers.ny !== expectedFaceColors[3]) return false
        if (z === size - 1 && stickers.pz !== expectedFaceColors[4]) return false
        if (z === 0 && stickers.nz !== expectedFaceColors[5]) return false
      }
      return true
    }

    function attachLayerByIndex(axis, layerIndex) {
      axisName = axis
      axisVector.set(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0)
      axisWorld = axisVector.clone().applyQuaternion(cubeGroup.quaternion).normalize()
      layerValue = layerIndex

      pivot = new THREE.Group()
      cubeGroup.add(pivot)

      activeCubies = []
      cubies.forEach((cubie) => {
        if (cubie.userData.grid[axis] === layerIndex) {
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
          cubie.userData.grid = rotateGridIndex(cubie.userData.grid, axisName, dir)
          cubie.userData.stickers = rotateStickers(cubie.userData.stickers, axisName, dir)
        })
      }
    }

    function finalizeLayer(steps = 0, source = 'user') {
      if (!pivot) return
      pivot.updateMatrixWorld(true)

      applyRotationToState(steps)

      activeCubies.forEach((cubie) => {
        cubeGroup.attach(cubie)
        const ix = getIndexFromPosition(cubie.position.x, spacing, size)
        const iy = getIndexFromPosition(cubie.position.y, spacing, size)
        const iz = getIndexFromPosition(cubie.position.z, spacing, size)
        cubie.position.x = getCoordFromIndex(ix, spacing, size)
        cubie.position.y = getCoordFromIndex(iy, spacing, size)
        cubie.position.z = getCoordFromIndex(iz, spacing, size)
        cubie.userData.grid = { x: ix, y: iy, z: iz }
        cubie.rotation.x = Math.round(cubie.rotation.x / (Math.PI / 2)) * (Math.PI / 2)
        cubie.rotation.y = Math.round(cubie.rotation.y / (Math.PI / 2)) * (Math.PI / 2)
        cubie.rotation.z = Math.round(cubie.rotation.z / (Math.PI / 2)) * (Math.PI / 2)
      })

      cubeGroup.remove(pivot)
      pivot = null
      activeCubies = []
      axisName = null

      if (source === 'user' && steps !== 0 && scrambledRef.current) {
        if (solvedRef.current) setSolved(false)
        if (!runningRef.current) setRunning(true)
        setMoves((prev) => prev + 1)
      }

      if (source === 'user' && scrambledRef.current) {
        const solvedNow = isCubeSolved()
        if (solvedNow) {
          setSolved(true)
          setRunning(false)
        }
      }
    }

    function startTweenToSteps(steps, source) {
      const step = Math.PI / 2
      const normalized = normalizeSteps(steps)
      if (!normalized) {
        finalizeLayer(0, source)
        return
      }
      lastMove = { steps: normalized, source }
      const start = pivot.rotation[axisName]
      tween = {
        axis: axisName,
        start,
        end: normalized * step,
        startTime: performance.now(),
        duration: 220
      }
    }

    function startAutoMove(move) {
      if (!move) return
      if (pivot || tween) return
      attachLayerByIndex(move.axis, move.layer)
      pivot.rotation[move.axis] = 0
      startTweenToSteps(move.steps, 'scramble')
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

    function resize() {
      const rect = mount.getBoundingClientRect()
      camera.aspect = rect.width / rect.height
      camera.updateProjectionMatrix()
      camera.lookAt(0, 0, 0)
      renderer.setSize(rect.width, rect.height)
    }

    function onWheel(event) {
      event.preventDefault()
      const delta = event.deltaY * 0.003
      zoomRadius = THREE.MathUtils.clamp(zoomRadius + delta, 5.5, 14)
      camera.position.copy(cameraDir.clone().multiplyScalar(zoomRadius))
      camera.lookAt(0, 0, 0)
    }

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
          finalizeLayer(lastMove?.steps ?? 0, lastMove?.source ?? 'user')
          lastMove = null
        }
      }

      if (!tween && !pivot && moveQueue.length > 0) {
        isAuto = true
        startAutoMove(moveQueue.shift())
      }

      if (!tween && moveQueue.length === 0 && isAuto) {
        isAuto = false
      }

      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }

    scrambleRef.current = () => {
      if (tween || pivot || moveQueue.length > 0) return
      moveQueue = generateScrambleSequence()
      isAuto = true
      setScrambled(true)
      setSolved(false)
      setMoves(0)
      setTimeMs(0)
      setRunning(false)
      timeRef.current = 0
      movesRef.current = 0
    }

    const raf = requestAnimationFrame(animate)

    return () => {
      scrambleRef.current = null
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

  return (
    <div className="app">
      <div className="canvas-wrap" ref={mountRef} />
      <div className="intro">
        <div className="intro-title">Rubik 3D Playground</div>
        <div className="intro-text">Xoay nền để đổi góc nhìn, kéo trực tiếp mặt rubik để quay tầng.</div>
        <div className="stats">
          <div className="stat">
            <span className="label">Time</span>
            <span className="value">{formatTime(timeMs)}</span>
          </div>
          <div className="stat">
            <span className="label">Moves</span>
            <span className="value">{moves}</span>
          </div>
        </div>
        <div className="actions">
          <button className="scramble" onClick={() => scrambleRef.current?.()}>
            Xáo trộn
          </button>
          <button className="reset" onClick={() => setResetKey((v) => v + 1)}>
            Reset
          </button>
        </div>
        <div className="status">
          {scrambled ? (solved ? 'Đã giải' : running ? 'Đang giải...' : 'Sẵn sàng') : 'Nhấn xáo trộn để bắt đầu'}
        </div>
      </div>
      <div className="controls">
        <div className="control">
          <label>Size</label>
          <button className="size-btn" onClick={() => setShowSizeModal(true)}>
            {size}x{size}
          </button>
        </div>
      </div>
      {showSizeModal && (
        <div className="modal-backdrop" onClick={() => setShowSizeModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Chọn kích thước</div>
            <div className="modal-grid">
              {[3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  className={`modal-option${size === n ? ' active' : ''}`}
                  onClick={() => {
                    setSize(n)
                    setShowSizeModal(false)
                  }}
                >
                  {n}x{n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
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

function createRubikGroup(size, spacing) {
  const cubeGroup = new THREE.Group()
  const cubies = []
  const half = (size - 1) / 2

  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      for (let k = 0; k < size; k += 1) {
        const cubie = createCubie(i, j, k, size)
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

function createCubie(i, j, k, size) {
  const geometry = new THREE.BoxGeometry(0.98, 0.98, 0.98)
  const isOuterPosX = i === size - 1
  const isOuterNegX = i === 0
  const isOuterPosY = j === size - 1
  const isOuterNegY = j === 0
  const isOuterPosZ = k === size - 1
  const isOuterNegZ = k === 0

  const baseColors = getVariantFaceColors()
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
