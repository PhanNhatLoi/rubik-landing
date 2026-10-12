import { useRef, type CSSProperties } from 'react'
import { FACES, type Face } from '../core/types'
import { displayRotation, slotsFor, type Hold, type Slot } from '../scan/scanGuide'

export type CellMark = 'changed' | 'uncertain' | null

export interface NetCell {
  /** CSS color, or null when not scanned yet. */
  color: string | null
  mark: CellMark
}

export interface ScanNetProps {
  /** Stickers per side (default 3). */
  n?: number
  /** 6·n² cells in URFDLB order, each face in its standard layout. */
  cells: NetCell[]
  /** How the user holds the cube right now; the net mirrors it. */
  hold: Hold
  /** Face being scanned, highlighted. */
  activeFace: Face | null
  onCellClick?: (index: number) => void
  onFaceClick?: (face: Face) => void
}

// Cross layout in face-size units: left, center, right, back on the middle row.
const SLOT_POS: Record<Slot, { col: number; row: number }> = {
  top: { col: 1, row: 0 },
  left: { col: 0, row: 1 },
  center: { col: 1, row: 1 },
  right: { col: 2, row: 1 },
  back: { col: 3, row: 1 },
  bottom: { col: 1, row: 2 }
}

interface Placement {
  col: number
  /** Cumulative rotation in quarter turns, so CSS always animates the short way round. */
  turns: number
  /** Changes when a face jumps more than one slot (back ↔ left): remounted with a fade instead of sliding. */
  generation: number
}

/**
 * The six faces laid out as the cube is held: front in the middle, its real neighbours around it,
 * the far side at the right end. Moving to the next face slides and turns the faces into place.
 */
// Sticker size per cube size, so every net is about as wide as the 3x3 one.
const CELL_PX: Record<number, number> = { 2: 29, 3: 20, 4: 15, 5: 12 }

export default function ScanNet({ n = 3, cells, hold, activeFace, onCellClick, onFaceClick }: ScanNetProps) {
  const placements = useRef<Partial<Record<Face, Placement>>>({})
  const slots = slotsFor(hold)
  const per = n * n
  // Odd cubes: the fixed center picks the face; even cubes have none (faces are picked elsewhere).
  const center = n % 2 ? (per - 1) / 2 : -1

  return (
    <div className="scan-net" style={{ '--n': n, '--cell': `${CELL_PX[n] ?? 20}px` } as CSSProperties}>
      {FACES.map((face, fi) => {
        const slot = slots[face]
        const pos = SLOT_POS[slot]
        const quarter = displayRotation(face, hold)
        const prev = placements.current[face]
        let placement: Placement
        if (!prev) placement = { col: pos.col, turns: quarter, generation: 0 }
        else {
          const delta = ((quarter - prev.turns) % 4 + 6) % 4 - 2
          const jump = Math.abs(pos.col - prev.col) > 1
          placement = { col: pos.col, turns: jump ? quarter : prev.turns + delta, generation: prev.generation + (jump ? 1 : 0) }
        }
        placements.current[face] = placement

        return (
          <div
            key={`${face}-${placement.generation}`}
            className={`scan-net-face slot-${slot}${face === activeFace ? ' active' : ''}${placement.generation ? ' entered' : ''}`}
            style={{
              transform: `translate(calc(${pos.col} * var(--face)), calc(${pos.row} * var(--face))) rotate(${placement.turns * 90}deg)`
            }}
          >
            {Array.from({ length: per }, (_, k) => {
              const index = fi * per + k
              const cell = cells[index]
              const isCenter = k === center
              return (
                <button
                  key={k}
                  type="button"
                  className={`facelet${cell?.mark ? ` ${cell.mark}` : ''}${cell?.color ? '' : ' empty'}`}
                  style={cell?.color ? { background: cell.color } : undefined}
                  title={isCenter ? 'Quét lại mặt này' : undefined}
                  aria-label={isCenter ? 'Quét lại mặt này' : 'Đổi màu ô'}
                  onClick={() => (isCenter ? onFaceClick?.(face) : onCellClick?.(index))}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
