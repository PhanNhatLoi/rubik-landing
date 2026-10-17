import { useMemo } from 'react'
import type { Face } from '../../smart-solver/core/types'
import { getTopCrossExamples } from '../copy/topCrossExamples'
import { PATTERN_LABEL, TOP_SLOTS, type TopCrossMethod } from '../guide/topCrossGuide'
import { edgeCell } from '../cells'
import FormulaPreview from './FormulaPreview'

export default function TopCrossWorkedExamples({ method, faceColors, colorNames }: {
  method: TopCrossMethod; faceColors: Record<Face, number>; colorNames: Record<Face, string>
}) {
  const examples = useMemo(() => getTopCrossExamples(method, colorNames), [method, colorNames])
  return <>{examples.map((example) => {
    const title = example.level === 'easy' ? 'Ví dụ: hai cạnh đối' : 'Ví dụ: chấm'
    const route = [example.rounds[0]!.kind, ...example.rounds.map((round) => round.next)].map((kind) => PATTERN_LABEL[kind]).join(' → ')
    return <div key={`${method}:${example.level}`} data-no-typing style={{ padding: '12px', border: '1px solid var(--rb-border)', borderRadius: 'var(--rb-r-md)', background: 'var(--rb-surface-1)', display: 'grid', gap: '10px' }}>
      <strong style={{ color: 'var(--rb-text)' }}>{title}</strong>
      <div style={{ fontSize: '13px', color: 'var(--rb-accent-link)' }}>{route} · {example.rounds.length} lượt</div>
      <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: 'var(--rb-text)' }}>
        {example.level === 'easy' ? 'Mẫu đã căn hai cạnh hướng xuống thành hàng ngang trái–phải.' : 'Chưa có cạnh nào hướng xuống. Làm công thức chữ L để tạo chữ L, rồi lặp lại để có dấu cộng.'}
      </p>
      {example.rounds.map((round, i) => {
        const alignment = round.steps.slice(0, round.steps.length - round.formula.split(/\s+/).length).map((step) => step.notation.replaceAll("'", '′')).join(' ')
        return <div key={i} style={{ display: 'grid', gap: '4px', fontSize: '13px', lineHeight: 1.5, color: 'var(--rb-text-muted)' }}>
          <strong style={{ color: 'var(--rb-text)' }}>Lượt {i + 1}: {round.title}</strong>
          <div>{alignment ? `Căn ${alignment} để chữ L nằm ở sau–trái, rồi làm công thức:` : i === 0 ? 'Dùng công thức:' : 'Không cần căn D, lặp lại công thức:'}</div>
          <div style={{ color: 'var(--rb-accent-link)', fontWeight: 700 }}>{round.formula}</div>
        </div>
      })}
      <FormulaPreview state={example.before} moves={example.moves} faceColors={faceColors} label={title} view="below" cells={TOP_SLOTS.map(edgeCell)} result="Đã tạo dấu cộng vàng ở D và giữ nguyên hai tầng phía trên." />
    </div>
  })}</>
}
