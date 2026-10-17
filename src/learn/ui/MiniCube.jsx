import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { applyNotation, fromFacelets54, notationToTurn } from '../guide/physical'

const CORE = 0x0f1116
const GRAY = 0x64748b
/** Material order of a box: +x, -x, +y, -y, +z, -z. */
const KEYS = ['px', 'nx', 'py', 'ny', 'pz', 'nz']

const FACE_AT = {
  U: (x, y) => y === 2,
  D: (x, y) => y === 0,
  R: (x) => x === 2,
  L: (x) => x === 0,
  F: (x, y, z) => z === 2,
  B: (x, y, z) => z === 0
}

/**
 * @typedef {{ kind: 'centers' | 'edges' | 'corners' } | { kind: 'face', face: string } | { kind: 'cells', cells: number[][] } | { kind: 'slice', axis: 'x' | 'y' | 'z' }} Target
 */

/** Whether the cubie at grid (x, y, z) is one the spotlight points at. */
function lit(spotlight, x, y, z) {
  if (Array.isArray(spotlight)) return spotlight.some((t) => lit(t, x, y, z))
  if (spotlight.kind === 'face') return FACE_AT[spotlight.face](x, y, z)
  if (spotlight.kind === 'slice') return [x, y, z][{ x: 0, y: 1, z: 2 }[spotlight.axis]] === 1
  if (spotlight.kind === 'cells') return spotlight.cells.some((c) => c[0] === x && c[1] === y && c[2] === z)
  const outer = [x, y, z].filter((v) => v !== 1).length
  return outer === { centers: 1, edges: 2, corners: 3 }[spotlight.kind]
}

/**
 * A small perspective 3x3 drawn from facelets, with optional explicit turn playback.
 * @param {{
 *   facelets: string,
 *   faceColors: Record<string, number>,
 *   label: string,
 *   spotlight?: Target | Target[] | null,
 *   view?: 'front' | 'frontLeft' | 'back' | 'below',
 *   turns?: string[],
 *   grayRest?: boolean,
 *   keep?: Target | Target[] | null,
 *   destination?: number[] | null,
 *   motion?: { notation: string, id: number, duration?: number } | null,
 *   onMotionEnd?: () => void,
 *   pulse?: string | null,
 *   pulseDuration?: number,
 *   dimRest?: boolean,
 *   viewFront?: 'F' | 'R' | 'B' | 'L',
 *   viewSide?: 'right' | 'left',
 * }} props
 */
export default function MiniCube({ facelets, faceColors, label, spotlight = null, view = 'front', turns = [], grayRest = false, keep = null, destination = null, motion = null, onMotionEnd, pulse = null, pulseDuration = 1000, dimRest = false, viewFront = 'F', viewSide = 'right' }) {
  const canvasRef = useRef(null)
  const endRef = useRef(onMotionEnd)
  endRef.current = onMotionEnd
  const spotlightKey = JSON.stringify(spotlight)
  const keepKey = JSON.stringify(keep)
  const turnsKey = turns.join(' ')
  const destinationKey = JSON.stringify(destination)
  const motionKey = motion ? `${motion.id}:${motion.notation}:${motion.duration ?? 1200}` : ''

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const light = new THREE.DirectionalLight(0xffffff, 1.1)
    light.position.set(3, 6, 8)
    scene.add(light)
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(0, 0, 9.5)

    const group = new THREE.Group()
    const geometry = new THREE.BoxGeometry(0.96, 0.96, 0.96)
    const materials = []
    const glowing = []
    const moving = []
    const turn = motion ? notationToTurn(motion.notation) : null
    // Fixed-position turns (faces or slices) applied to the drawn cube, e.g. ["M", "D2"].
    const cubies = turns.reduce(applyNotation, fromFacelets54(facelets))
    const stickers = new Map(cubies.map((c) => [`${c.grid.x},${c.grid.y},${c.grid.z}`, c.stickers]))
    for (let x = 0; x < 3; x += 1) {
      for (let y = 0; y < 3; y += 1) {
        for (let z = 0; z < 3; z += 1) {
          const faces = stickers.get(`${x},${y},${z}`)
          const muted = grayRest && spotlight && !lit(spotlight, x, y, z) && !(keep && lit(keep, x, y, z))
          const mats = KEYS.map((key) => {
            const face = faces?.[key]
            const mat = new THREE.MeshStandardMaterial({ color: face ? (muted ? GRAY : faceColors[face]) : CORE, roughness: 0.35, metalness: 0.1 })
            if (face && dimRest && spotlight && !lit(spotlight, x, y, z)) mat.color.multiplyScalar(0.18)
            materials.push(mat)
            return mat
          })
          if (spotlight && lit(spotlight, x, y, z)) {
            // Glow in the sticker's own color so it stays recognisable.
            mats.forEach((m) => {
              if (m.color.getHex() === CORE) return
              m.emissive.copy(m.color)
              m.emissiveIntensity = 0.4
              glowing.push(m)
            })
          }
          const cubie = new THREE.Mesh(geometry, mats)
          cubie.position.set(x - 1, y - 1, z - 1)
          group.add(cubie)
          if (turn && { x, y, z }[turn.axis] === turn.layer) moving.push(cubie)
        }
      }
    }
    let markerGeometry = null
    if (destination) {
      markerGeometry = new THREE.RingGeometry(0.13, 0.20, 32)
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x2563eb, side: THREE.DoubleSide })
      materials.push(markerMaterial)
      const marker = new THREE.Mesh(markerGeometry, markerMaterial)
      marker.rotation.x = -Math.PI / 2
      marker.position.set(destination[0] - 1, destination[1] - 1 + 0.49, destination[2] - 1)
      group.add(marker)
      // The ring denotes a U slot: it follows U alignment, not the old edge leaving on a side turn.
      if (turn?.axis === 'y' && destination[1] === turn.layer) moving.push(marker)
    }
    const pivot = new THREE.Group()
    if (turn) {
      group.add(pivot)
      moving.forEach((mesh) => pivot.add(mesh))
    }
    // 'front' shows the front, top and right faces like the main cube; 'back' shows back, bottom and left.
    if (view === 'back') group.rotation.set(-0.45, Math.PI - 0.6, 0)
    else if (view === 'frontLeft') group.rotation.set(0.45, 0.6, 0)
    else if (view === 'below') group.rotation.set(-0.5, -['F', 'R', 'B', 'L'].indexOf(viewFront) * Math.PI / 2 + (viewSide === 'left' ? 0.6 : -0.6), 0)
    else group.rotation.set(0.45, -0.6, 0)
    scene.add(group)

    const resize = () => {
      const size = canvas.clientWidth
      if (!size) return
      renderer.setSize(size, size, false)
      renderer.render(scene, camera)
    }
    resize()
    let frame = 0
    let disposed = false
    if (turn || pulse) {
      const started = performance.now()
      const duration = turn ? motion.duration ?? 1200 : pulseDuration
      const animate = (now) => {
        if (disposed) return
        const t = Math.max(0, Math.min(1, (now - started) / duration))
        const eased = t * t * (3 - 2 * t)
        if (turn) pivot.rotation[turn.axis] = turn.steps * Math.PI / 2 * eased
        if (pulse) glowing.forEach((m) => { m.emissiveIntensity = 0.4 + 1.1 * Math.sin(Math.PI * t) })
        renderer.render(scene, camera)
        if (t < 1) frame = requestAnimationFrame(animate)
        else if (turn) endRef.current?.()
      }
      frame = requestAnimationFrame(animate)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      geometry.dispose()
      markerGeometry?.dispose()
      materials.forEach((m) => m.dispose())
      renderer.dispose()
    }
  }, [facelets, faceColors, view, spotlightKey, turnsKey, grayRest, keepKey, destinationKey, motionKey, pulse, pulseDuration, dimRest, viewFront, viewSide])

  return <canvas ref={canvasRef} role="img" aria-label={label} style={{ width: '100%', height: 'auto', aspectRatio: '1', display: 'block' }} />
}
