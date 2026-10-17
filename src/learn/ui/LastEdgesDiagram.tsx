import { useId } from 'react'
import type { CubieState, Face } from '../../smart-solver/core/types'
import { EDGE_COLORS } from '../../smart-solver/core/facelets'
import LastEdgeFace from './LastEdgeFace'

const POSITIONS = [
  { face: 'F', slot: 5, x: 154, y: 0 },
  { face: 'R', slot: 4, x: 300, y: 145 },
  { face: 'B', slot: 7, x: 154, y: 290 },
  { face: 'L', slot: 6, x: 8, y: 145 }
] as const

export default function LastEdgesDiagram({ state, faceColors, colorNames, label, anchor, direction }: {
  state: CubieState; faceColors: Record<Face, number>; colorNames: Record<Face, string>; label: string; anchor?: Face | null; direction?: 'right' | 'left'
}) {
  const arrowId = `edge-cycle-${useId().replaceAll(':', '')}`
  const sides: Face[] = ['F', 'R', 'B', 'L']
  const anchorIndex = Math.max(0, sides.indexOf(anchor ?? 'F'))
  const cycle = (direction === 'right' ? [1, 3, 2] : [3, 1, 2]).map((i) => sides[(i + anchorIndex) % 4]!)
  const paths = direction === 'right'
    ? ['M 300 194 Q 210 104 120 194', 'M 70 272 Q 82 330 154 354', 'M 266 354 Q 338 330 350 272']
    : ['M 120 194 Q 210 104 300 194', 'M 350 272 Q 338 330 266 354', 'M 154 354 Q 82 330 70 272']
  return <svg viewBox="0 0 420 425" width="360" role="img" aria-label={label} style={{ display: 'block', width: '100%', maxWidth: '360px', height: 'auto', margin: '0 auto' }}>
    <title>{label}</title>
    <defs><marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--rb-accent-link)" /></marker></defs>
    {direction && <g transform={`rotate(${anchorIndex * 90} 210 210)`}>
      {paths.map((d, i) => <path key={d} data-from={cycle[i]} data-to={cycle[(i + 1) % 3]} aria-label={`${cycle[i]} → ${cycle[(i + 1) % 3]}`} d={d} fill="none" stroke="var(--rb-accent-link)" strokeWidth="3" markerEnd={`url(#${arrowId})`} />)}
    </g>}
    <rect x="194" y="202" width="32" height="32" rx="5" fill={`#${faceColors.D.toString(16).padStart(6, '0')}`}><title>Tâm D — mặt đáy làm cơ sở quan sát</title></rect>
    <text x="210" y="224" textAnchor="middle" fontSize="16" fill="#111">D</text>
    {POSITIONS.map(({ face, slot, x, y }) => {
      const color = EDGE_COLORS[state.ep[slot]!]![1]
      const description = `${face}: cạnh ${colorNames[color]}${anchor === face ? ', mặt mốc giữ lại' : ''}`
      return <g key={face} transform={`translate(${x} ${y})`}>
        {anchor === face && <rect x="4" y="0" width="104" height="130" rx="8" fill="none" stroke="var(--rb-accent-link)" strokeWidth="2" strokeDasharray="5 3" />}
        <text x="56" y="15" textAnchor="middle" fontSize="14" fill="var(--rb-text)">{face}{anchor === face ? ' · giữ' : ''}</text>
        <LastEdgeFace x={0} y={22} edgeColor={faceColors[color]} label={description} highlight={face !== anchor} />
      </g>
    })}
  </svg>
}
