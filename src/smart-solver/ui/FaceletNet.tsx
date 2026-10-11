import { FACES, type Face } from '../core/types'

export type CellMark = 'changed' | 'uncertain' | null

export interface NetCell {
  /** CSS color, or null when not scanned yet. */
  color: string | null
  mark: CellMark
}

export interface FaceletNetProps {
  /** 54 cells in URFDLB order. */
  cells: NetCell[]
  /** Face currently being scanned, highlighted. */
  activeFace: Face | null
  onCellClick?: (index: number) => void
  onFaceClick?: (face: Face) => void
}

// Cross layout:   U
//               L F R B
//                 D
const POSITION: Record<Face, { col: number; row: number }> = {
  U: { col: 1, row: 0 },
  L: { col: 0, row: 1 },
  F: { col: 1, row: 1 },
  R: { col: 2, row: 1 },
  B: { col: 3, row: 1 },
  D: { col: 1, row: 2 }
}

export default function FaceletNet({ cells, activeFace, onCellClick, onFaceClick }: FaceletNetProps) {
  return (
    <div className="facelet-net">
      {FACES.map((face, fi) => (
        <div
          key={face}
          className={`facelet-face${face === activeFace ? ' active' : ''}`}
          style={{ gridColumn: POSITION[face].col + 1, gridRow: POSITION[face].row + 1 }}
        >
          {Array.from({ length: 9 }, (_, k) => {
            const index = fi * 9 + k
            const cell = cells[index]
            const isCenter = k === 4
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
      ))}
    </div>
  )
}
