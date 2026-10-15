import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { applyNotation, fromFacelets54 } from '../guide/physical'

const CORE = 0x0f1116
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
 * A small, still 3x3 drawn from facelets, for before/after comparisons.
 * @param {{
 *   facelets: string,
 *   faceColors: Record<string, number>,
 *   label: string,
 *   spotlight?: Target | Target[] | null,
 *   view?: 'front' | 'back' | 'below',
 *   turns?: string[],
 * }} props
 */
export default function MiniCube({ facelets, faceColors, label, spotlight = null, view = 'front', turns = [] }) {
  const canvasRef = useRef(null)
  const spotlightKey = JSON.stringify(spotlight)
  const turnsKey = turns.join(' ')

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
    // Fixed-position turns (faces or slices) applied to the drawn cube, e.g. ["M", "D2"].
    const cubies = turns.reduce(applyNotation, fromFacelets54(facelets))
    const stickers = new Map(cubies.map((c) => [`${c.grid.x},${c.grid.y},${c.grid.z}`, c.stickers]))
    for (let x = 0; x < 3; x += 1) {
      for (let y = 0; y < 3; y += 1) {
        for (let z = 0; z < 3; z += 1) {
          const faces = stickers.get(`${x},${y},${z}`)
          const mats = KEYS.map((key) => {
            const face = faces?.[key]
            const mat = new THREE.MeshStandardMaterial({ color: face ? faceColors[face] : CORE, roughness: 0.35, metalness: 0.1 })
            materials.push(mat)
            return mat
          })
          if (spotlight && lit(spotlight, x, y, z)) {
            // Glow in the sticker's own color so it stays recognisable.
            mats.forEach((m) => {
              if (m.color.getHex() === CORE) return
              m.emissive.copy(m.color)
              m.emissiveIntensity = 0.4
            })
          }
          const cubie = new THREE.Mesh(geometry, mats)
          cubie.position.set(x - 1, y - 1, z - 1)
          group.add(cubie)
        }
      }
    }
    // 'front' shows the front, top and right faces like the main cube; 'back' shows back, bottom and left.
    if (view === 'back') group.rotation.set(-0.45, Math.PI - 0.6, 0)
    else if (view === 'below') group.rotation.set(-0.5, -0.6, 0)
    else group.rotation.set(0.45, -0.6, 0)
    scene.add(group)

    const resize = () => {
      const size = canvas.clientWidth
      if (!size) return
      renderer.setSize(size, size, false)
      renderer.render(scene, camera)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    return () => {
      observer.disconnect()
      geometry.dispose()
      materials.forEach((m) => m.dispose())
      renderer.dispose()
    }
  }, [facelets, faceColors, view, spotlightKey, turnsKey])

  return <canvas ref={canvasRef} role="img" aria-label={label} style={{ width: '100%', aspectRatio: '1', display: 'block' }} />
}
