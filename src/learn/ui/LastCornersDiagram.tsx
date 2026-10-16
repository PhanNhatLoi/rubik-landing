import { useId } from 'react'
import { CORNER_COLORS, CORNER_FACELETS, toFacelets } from '../../smart-solver/core/facelets'
import type { CubieState, Face } from '../../smart-solver/core/types'
import { LAST_CORNER_LABEL, type LastCornersVariant, type lastCornerClue } from '../guide/lastCornersGuide'

const POS: Record<number, { x: number; y: number }> = { 4: { x: 220, y: 8 }, 5: { x: 20, y: 8 }, 6: { x: 20, y: 222 }, 7: { x: 220, y: 222 } }
const hex = (v: number) => `#${v.toString(16).padStart(6, '0')}`
const ink = (v: number) => (((v >> 16) & 255) * 299 + ((v >> 8) & 255) * 587 + (v & 255) * 114) / 1000 < 140 ? '#fff' : '#111'
const SHAPES = ['44,6 78,24 44,42 10,24', '10,24 44,42 44,80 10,62', '44,42 78,24 78,62 44,80']
const TEXT_POS = [[44, 27], [26, 55], [61, 55]]

export default function LastCornersDiagram({ state, faceColors, colorNames, label, variant, clue }: {
  state: CubieState; faceColors: Record<Face, number>; colorNames: Record<Face, string>; label: string
  variant?: LastCornersVariant; clue?: ReturnType<typeof lastCornerClue>
}) {
  const marker = `corner-cycle-${useId().replaceAll(':', '')}`
  const facelets = toFacelets(state)
  return <svg viewBox="0 0 360 370" width="360" role="img" aria-label={label} style={{ width: '100%', maxWidth: '360px', height: 'auto', display: 'block', margin: '0 auto' }}>
    <title>{label}</title>
    <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="var(--rb-accent-link)" /></marker></defs>
    {variant?.cycle.map((from, i) => {
      const to = variant.cycle[(i + 1) % 3]!
      const a = { x: POS[from]!.x + 60, y: POS[from]!.y + 76 }
      const b = { x: POS[to]!.x + 60, y: POS[to]!.y + 76 }
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy)
      const ux = dx / length, uy = dy / length
      const bend = Math.abs(dx) > 0 && Math.abs(dy) > 0 ? 65 : 24
      const d = `M ${a.x + ux * 72} ${a.y + uy * 72} Q ${(a.x + b.x) / 2 - uy * bend} ${(a.y + b.y) / 2 + ux * bend} ${b.x - ux * 72} ${b.y - uy * 72}`
      return <path key={from} data-from-corner={LAST_CORNER_LABEL[from]} data-to-corner={LAST_CORNER_LABEL[to]} aria-label={`${LAST_CORNER_LABEL[from]} → ${LAST_CORNER_LABEL[to]}`} d={d} fill="none" stroke="var(--rb-accent-link)" strokeWidth="2.5" markerEnd={`url(#${marker})`} />
    })}
    {Array.from({ length: 9 }, (_, i) => <rect key={i} x={137 + i % 3 * 30} y={143 + Math.floor(i / 3) * 30} width="26" height="26" rx="3" fill={i === 4 ? hex(faceColors.D) : '#64748b'} stroke="var(--rb-border)" />)}
    <text x="180" y="191" textAnchor="middle" fontSize="13" fill={ink(faceColors.D)}>D</text>
    {['F', 'R', 'B', 'L'].map((face, i) => <text key={face} x={[180, 350, 180, 10][i]} y={[16, 190, 367, 190][i]} fontSize="14" textAnchor="middle" fill="var(--rb-text)">{face}</text>)}
    {[4, 5, 6, 7].map((slot) => {
      const p = POS[slot]!
      const colors = CORNER_FACELETS[slot]!.map((i) => facelets[i] as Face)
      const expected = CORNER_COLORS[slot]!
      const correct = state.cp[slot] === slot
      return <g key={slot} transform={`translate(${p.x} ${p.y})`} data-corner={LAST_CORNER_LABEL[slot]} data-position-correct={correct}>
        {variant?.anchor === slot && <rect x="0" y="0" width="120" height="140" rx="8" fill="none" stroke="var(--rb-accent-link)" strokeWidth="2" strokeDasharray="5 3" />}
        {clue?.neighbor === slot && <rect x="2" y="2" width="116" height="136" rx="8" fill="none" stroke="#f59e0b" strokeWidth="2" />}
        <text x="60" y="16" fontSize="12" textAnchor="middle" fill="var(--rb-text)">{LAST_CORNER_LABEL[slot]}{correct ? ' ✓ đúng chỗ' : clue?.neighbor === slot ? ' · 2/3 màu' : ''}</text>
        <svg x="16" y="21" width="88" height="82" viewBox="0 0 88 84" role="img" aria-label={`Góc ${LAST_CORNER_LABEL[slot]}, bộ màu ${CORNER_COLORS[state.cp[slot]!]!.map((f) => colorNames[f]).join(', ')}${correct ? ', đúng vị trí dù có thể chưa đúng hướng' : ''}`}>
          {colors.map((f, i) => <g key={i}><polygon points={SHAPES[i]} fill={hex(faceColors[f])} stroke="#0f172a" strokeWidth="1.5" /><text x={TEXT_POS[i]![0]} y={TEXT_POS[i]![1]} textAnchor="middle" fontSize="10" fill={ink(faceColors[f])}>{expected[i]}</text></g>)}
        </svg>
        <text x="8" y="119" fontSize="10" fill="var(--rb-text-muted)">Cần:</text>
        {expected.map((f, i) => <rect key={f} x={38 + i * 20} y="107" width="16" height="16" rx="2" fill={hex(faceColors[f])}><title>{colorNames[f]}</title></rect>)}
        <text x="60" y="135" textAnchor="middle" fontSize="9" fill="var(--rb-text-muted)">Bộ màu, không xét hướng</text>
      </g>
    })}
  </svg>
}
