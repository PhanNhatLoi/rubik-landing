import { edgeCell } from '../cells'
import FormulaPreview from './FormulaPreview'
import type { CubieState, Face } from '../../smart-solver/core/types'
import type { LAST_EDGES_FORMULA_PICTURES } from '../copy/lesson6'
import LastEdgesDiagram from './LastEdgesDiagram'

export default function LastEdgesFormulaExample({ example, faceColors, colorNames }: {
  example: typeof LAST_EDGES_FORMULA_PICTURES[number]
  faceColors: Record<Face, number>; colorNames: Record<Face, string>
}) {
  const row = (state: CubieState, label: string) => <div>
    <div style={{ fontSize: '12px', marginBottom: '4px' }}>{label}</div>
    <LastEdgesDiagram state={state} faceColors={faceColors} colorNames={colorNames} anchor="F" label={`${label}: cả bốn cạnh giữa hàng dưới giữ màu, tâm D vàng, mọi khối khác xám`} />
  </div>
  return <div style={{ display: 'grid', gap: '10px', padding: '12px', border: '1px solid var(--rb-border)', borderRadius: 'var(--rb-r-md)', background: 'var(--rb-surface-1)', fontSize: '13px', lineHeight: 1.5, color: 'var(--rb-text-muted)' }}>
    <strong style={{ color: 'var(--rb-text)' }}>Chiều {example.route}</strong>
    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--rb-accent-link)' }}>{example.moves.join(' ').replaceAll("'", '′')}</div>
    <div>Cạnh ở vị trí F giữ nguyên. Cả bốn cạnh giữa hàng dưới đều giữ màu để bạn so thứ tự trước và sau.</div>
    <FormulaPreview state={example.before} moves={example.moves} faceColors={faceColors} label={`Đổi cạnh ${example.route}`} view="below" cells={[4, 5, 6, 7].map(edgeCell)} result="Đã đủ một lượt đổi cạnh: F giữ nguyên, ba cạnh còn lại đổi vòng. Quan sát thứ tự mới." />
    {row(example.before, 'Trước khi xoay')}
    <div aria-hidden="true" style={{ textAlign: 'center', fontSize: '20px', color: 'var(--rb-accent-link)' }}>↓</div>
    {row(example.after, 'Sau một lượt công thức')}
    <div>Theo dõi thứ tự cả bốn cạnh có màu; lấy tâm D vàng làm mốc đáy và bỏ qua các ô xám.</div>
  </div>
}
