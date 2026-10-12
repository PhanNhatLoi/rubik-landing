export type Axis = 'x' | 'y' | 'z'
export type StickerKey = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz'
export type Stickers<T> = Record<StickerKey, T | null>
export interface Grid {
  x: number
  y: number
  z: number
}

export function normalizeSteps(steps: number): number {
  let s = ((steps % 4) + 4) % 4
  if (s === 3) s = -1
  return s
}

/** dir = +1 rotates +90° around the axis (right-hand rule), dir = -1 rotates -90°. */
export function rotateGridIndex(grid: Grid, axis: Axis, dir: number, size: number): Grid {
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

export function rotateStickers<T>(stickers: Stickers<T>, axis: Axis, dir: number): Stickers<T> {
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
