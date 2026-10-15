import { useState } from 'react'
import { applyMoves } from '../../smart-solver/core/cubie'
import { EDGE_COLORS } from '../../smart-solver/core/facelets'
import type { CubieState, Face } from '../../smart-solver/core/types'
import { LAST_EDGES_ORDER_CASES } from '../copy/lesson6'
import { LAST_EDGES_LEFT, LAST_EDGES_RIGHT } from '../guide/lastEdgesGuide'
import { LAST_EDGE_RING, lastEdgesOrderChoices, lastEdgesOrderDone, lastEdgesOrderOptions } from '../guide/lastEdgesOrder'
import LastEdgesDiagram from './LastEdgesDiagram'

const hex = (v: number) => `#${v.toString(16).padStart(6, '0')}`
const notation = (moves: readonly string[]) => moves.join(' ').replaceAll("'", '′')
export type LastEdgesSelectedFrames = Partial<Record<number, Face>>
interface ChoiceSelection {
  selectedFrames?: LastEdgesSelectedFrames
  onFrameChange?: (round: number, front: Face) => void
}
interface Colors { faceColors: Record<Face, number>; colorNames: Record<Face, string> }
function OrderChoice({ state, faceColors, colorNames, round = 1, selectedFrames, onFrameChange }: Colors & ChoiceSelection & { state: CubieState; round?: number }) {
  const [selected, setSelected] = useState(0)
  const options = lastEdgesOrderChoices(state)
  const option = options.find((v) => v.front === selectedFrames?.[round]) ?? options[selected] ?? options[0]
  if (!option) return <div>Đã đúng thứ tự vòng. Chỉ căn D ở cuối, không cần thêm công thức.</div>
  const prepare = lastEdgesOrderOptions(state).length === 0
  const after = applyMoves(state, option.moves)
  const anchorColor = EDGE_COLORS[state.ep[option.anchor]!]![1]
  const cycle = option.direction === 'right' ? [option.right, option.left, option.back] : [option.left, option.right, option.back]
  const slots: Partial<Record<Face, number>> = { F: 5, R: 4, B: 7, L: 6 }
  return <div style={{ display: 'grid', gap: '10px' }}>
    <strong>Lượt {round}: {prepare ? 'chọn cạnh giữ lại cho lượt chuẩn bị' : 'chọn một trong hai cạnh có thể giữ lại'}</strong>
    <div role="group" aria-label={`Chọn mặt chính cho lượt ${round}`} style={{ display: 'grid', gap: '6px' }}>
      {options.map((v, i) => {
        const color = EDGE_COLORS[state.ep[v.anchor]!]![1]
        return <button key={`${v.front}-${v.direction}`} type="button" className="rb-btn rb-btn--secondary" aria-pressed={option === v} onClick={() => { setSelected(i); onFrameChange?.(round, v.front) }} style={{ minHeight: '44px', height: 'auto', whiteSpace: 'normal', padding: '8px', borderColor: option === v ? 'var(--rb-accent-link)' : undefined }}>
          Giữ cạnh {colorNames[color]} ở {v.front} · bản {v.direction === 'right' ? 'R′' : 'L'}
        </button>
      })}
    </div>
    <LastEdgesDiagram state={state} faceColors={faceColors} colorNames={colorNames} anchor={option.front} direction={option.direction} label={`Chọn cạnh ${colorNames[anchorColor]} ở ${option.front} làm F mốc; mũi tên chỉ ba cạnh sẽ đi đâu`} />
    <div>Mũi tên theo lựa chọn này: {cycle.map((from, i) => `cạnh ${colorNames[EDGE_COLORS[state.ep[slots[from]!]!]![1]]} đi ${from} → ${cycle[(i + 1) % 3]}`).join('; ')}. Cạnh {colorNames[anchorColor]} giữ nguyên.</div>
    <div>Lấy mặt đang có cạnh <strong>{colorNames[anchorColor]}</strong> (vị trí {option.front}) làm F mốc. Không cần cạnh này khớp tâm.</div>
    <div style={{ padding: '10px', border: '1px solid var(--rb-accent-tint-border)', borderRadius: 'var(--rb-r-sm)' }}>
      <div>Công thức theo F mốc vừa chọn:</div>
      <strong style={{ display: 'block', fontSize: '17px', color: 'var(--rb-accent-link)' }}>{notation(option.direction === 'right' ? LAST_EDGES_RIGHT : LAST_EDGES_LEFT)}</strong>
      <div style={{ marginTop: '6px' }}>Nếu giữ cách nhìn và ký hiệu cố định của khối ảo:</div>
      <strong>{notation(option.moves)}</strong>
    </div>
    <details><summary style={{ minHeight: '44px', cursor: 'pointer' }}>Xem thứ tự sau lượt {round}</summary>
      <LastEdgesDiagram state={after} faceColors={faceColors} colorNames={colorNames} label={`Thứ tự cạnh sau lượt ${round}`} />
    </details>
    {lastEdgesOrderDone(after) ? <div style={{ color: 'var(--rb-accent-link)' }}>Bốn cạnh đã đúng thứ tự vòng. Cuối cùng chỉ căn D để đưa chúng về đúng vị trí trên khối.</div>
      : round < 2 && <OrderChoice key={`${option.front}-${option.direction}`} state={after} faceColors={faceColors} colorNames={colorNames} round={round + 1} selectedFrames={selectedFrames} onFrameChange={onFrameChange} />}
  </div>
}

export default function LastEdgesOrderCases({ faceColors, colorNames, selectedCaseIndex, onCaseChange, selectedFrames, onFrameChange }: Colors & ChoiceSelection & {
  selectedCaseIndex?: number; onCaseChange?: (index: number) => void
}) {
  const [selected, setSelected] = useState(0)
  const caseIndex = selectedCaseIndex ?? selected
  const example = LAST_EDGES_ORDER_CASES[caseIndex]!
  return <div style={{ display: 'grid', gap: '12px', fontSize: '13px', lineHeight: 1.5, color: 'var(--rb-text-muted)' }}>
    <div role="group" aria-label="Sáu tổ hợp thứ tự bốn cạnh" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
      {LAST_EDGES_ORDER_CASES.map((c, i) => <button key={c.id} type="button" className="rb-btn rb-btn--secondary" aria-pressed={caseIndex === i} onClick={() => { setSelected(i); onCaseChange?.(i) }} style={{ display: 'grid', height: 'auto', minHeight: '86px', padding: '8px', gap: '6px', whiteSpace: 'normal', borderColor: caseIndex === i ? 'var(--rb-accent-link)' : undefined }}>
        <span>Tổ hợp {i + 1} · {c.rounds ? `${c.rounds} lượt` : 'đúng thứ tự'}</span>
        <span style={{ display: 'flex', justifyContent: 'center', gap: '4px' }} aria-hidden="true">{c.ring.map((piece) => <span key={piece} style={{ width: '20px', height: '20px', borderRadius: '3px', background: hex(faceColors[EDGE_COLORS[piece]![1]]) }} />)}</span>
        <span style={{ fontSize: '11px' }}>{c.ring.map((piece) => colorNames[EDGE_COLORS[piece]![1]]).join(' → ')}</span>
      </button>)}
    </div>
    <div style={{ padding: '12px', border: '1px solid var(--rb-border)', borderRadius: 'var(--rb-r-md)', display: 'grid', gap: '10px' }}>
      <strong style={{ color: 'var(--rb-text)' }}>Tổ hợp {caseIndex + 1}: đọc theo vòng F → R → B → L</strong>
      <div>{LAST_EDGE_RING.map((slot) => colorNames[EDGE_COLORS[example.state.ep[slot]!]![1]]).join(' → ')}</div>
      {example.rounds === 0 ? <>
        <LastEdgesDiagram state={example.state} faceColors={faceColors} colorNames={colorNames} anchor="F" direction="right" label="Tổ hợp 1: giữ cạnh F, ba cạnh còn lại đổi vòng R → L → B → R" />
        <div>Mũi tên minh hoạ nguyên tắc: giữ cạnh F, ba cạnh R → L → B → R đổi vòng. Không có mũi tên di chuyển cạnh F.</div>
        <div>Thứ tự vòng ở hình này đã đúng. Nếu đang có thứ tự này, chỉ căn D ở cuối; không cần áp dụng công thức đổi cạnh.</div>
      </> : <OrderChoice key={example.id} state={example.state} faceColors={faceColors} colorNames={colorNames} selectedFrames={selectedFrames} onFrameChange={onFrameChange} />}
    </div>
  </div>
}
