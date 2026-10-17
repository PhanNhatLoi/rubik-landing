import type { Face } from '../../smart-solver/core/types'
import { LAST_FACE_FORMULA_PICTURES } from '../copy/lesson8'
import { compactHalfTurns } from '../guide/lastFaceGuide'
import { cornerCell } from '../cells'
import FormulaPreview from './FormulaPreview'

const notation = (moves: readonly string[]) => compactHalfTurns(moves).replaceAll("'", '′')
export default function LastFaceFormulaCard({ example, faceColors }: { example: typeof LAST_FACE_FORMULA_PICTURES[number]; faceColors: Record<Face, number> }) {
  const { variant, before } = example
  return <div data-no-typing style={{ padding: '12px', border: '1px solid var(--rb-border)', borderRadius: 'var(--rb-r-md)', background: 'var(--rb-surface-1)', display: 'grid', gap: '12px' }}>
    <strong style={{ fontSize: '15px', color: 'var(--rb-text)' }}>{variant.side === 'right' ? 'Bắt đầu bên phải · R′' : 'Bắt đầu bên trái · L'}</strong>
    <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--rb-text-muted)' }}>
      {variant.side === 'right' ? 'Tác động cặp góc bên phải mặt mốc F.' : 'Tác động cặp góc bên trái mặt mốc F.'} Mẫu nhìn từ dưới, trắng ở trên và vàng ở đáy.
    </div>
    {[variant.moves.slice(0, 8), variant.moves.slice(8)].map((half, i) => <div key={i} style={{ display: 'grid', gap: '5px', padding: '10px', borderRadius: 'var(--rb-r-sm)', background: 'var(--rb-surface-2)' }}>
      <span style={{ fontSize: '11px', color: 'var(--rb-text-muted)' }}>Nửa {i + 1}/2 · {i === 0 ? 'bên bắt đầu' : 'bên đối diện'}</span>
      <strong style={{ color: 'var(--rb-accent-link)', fontSize: '16px', lineHeight: 1.6 }}>{notation(half)}</strong>
    </div>)}
    <FormulaPreview state={before} moves={notation(variant.moves)} faceColors={faceColors} label={`Lật góc từ ${variant.side === 'right' ? 'R′' : 'L'}`} view="below" viewFront="F" viewSide={variant.side} cells={variant.affected.map(cornerCell)} result="Đã làm đủ hai nửa: mẫu này đã hoàn thành Rubik, các cạnh và vị trí góc được giữ nguyên." />
  </div>
}
