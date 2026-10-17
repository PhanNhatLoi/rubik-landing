import { useMemo, useState } from 'react'
import type { CubieState, Face } from '../../smart-solver/core/types'
import { toFacelets } from '../../smart-solver/core/facelets'
import { formulaPreviewCells, formulaPreviewFrames } from '../guide/formulaPreview'
import MiniCube from './MiniCube'

interface Props {
  state: CubieState
  moves: readonly string[] | string
  faceColors: Record<Face, number>
  label: string
  cells: number[][]
  view?: 'front' | 'frontLeft' | 'below' | 'back'
  viewFront?: Exclude<Face, 'U' | 'D'>
  viewSide?: 'right' | 'left'
  result?: string
}
const notation = (token: string) => token.replaceAll("'", '′')
function Player({ state, moves, faceColors, label, cells, view = 'front', viewFront = 'F', viewSide = 'right', result = 'Đã chạy hết công thức. So sánh kết quả với khối ban đầu.' }: Props) {
  const frames = useMemo(() => formulaPreviewFrames(state, moves), [state, moves])
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [run, setRun] = useState(0)
  const finished = index === frames.steps.length
  const active = frames.steps[index]
  const selected = formulaPreviewCells(frames.physical[0]!, frames.physical[index]!, cells)
  return <div role="group" aria-label={`Chạy thử: ${label}`} style={{ display: 'grid', gap: '10px', padding: '10px', border: '1px solid var(--rb-accent-tint-border)', borderRadius: 'var(--rb-r-md)', background: 'var(--rb-surface-1)' }}>
    <strong style={{ fontSize: '13px', color: 'var(--rb-text)' }}>Xem trước công thức trên khối 3D</strong>
    <div aria-label="Công thức chạy thử" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{frames.tokens.map((token, i) => <span key={i} aria-current={playing && active?.tokenIndex === i ? 'step' : undefined} style={{ padding: '3px 6px', borderRadius: '4px', fontSize: '15px', fontWeight: 700, color: playing && active?.tokenIndex === i ? 'var(--rb-text)' : 'var(--rb-accent-link)', background: playing && active?.tokenIndex === i ? 'var(--rb-accent-tint-border)' : undefined }}>{notation(token)}</span>)}</div>
    <div style={{ width: '100%', maxWidth: '280px', margin: '0 auto' }}>
      <MiniCube facelets={frames.facelets[index]!} faceColors={faceColors} label={`${label}: ${finished ? 'sau công thức' : index === 0 ? 'trước công thức' : `sau ${index} lần xoay`}`} view={view} viewFront={viewFront} viewSide={viewSide}
        spotlight={{ kind: 'cells', cells: selected }} keep={{ kind: 'centers' }} grayRest
        motion={playing && active ? { notation: active.notation, id: run * 1000 + index, duration: 1200 } : null}
        onMotionEnd={() => { const next = index + 1; setIndex(next); if (next === frames.steps.length) setPlaying(false) }} />
    </div>
    <div role="status" aria-live="polite" style={{ minHeight: '40px', fontSize: '13px', lineHeight: 1.5, color: 'var(--rb-text-muted)' }}>
      {finished ? result : playing && active ? `Đang xoay ${notation(active.notation)} · ${index + 1}/${frames.steps.length}${frames.tokens[active.tokenIndex]!.includes('2') ? ' · Nửa vòng được chia thành hai lần xoay chậm.' : ''}` : 'Bấm Chạy thử để xem chậm từng nước. Khối sẽ dừng ở kết quả cuối.'}
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      <button type="button" className="rb-btn rb-btn--secondary" style={{ minHeight: '44px', height: 'auto', whiteSpace: 'normal' }} onClick={() => {
        if (playing) return
        if (finished) setIndex(0)
        setRun((n) => n + 1); setPlaying(true)
      }} disabled={playing || !frames.steps.length}>{finished ? '↻ Chạy lại' : '▶ Chạy thử'}</button>
      <button type="button" className="rb-btn rb-btn--ghost" style={{ minHeight: '44px' }} onClick={() => { setPlaying(false); setIndex(0); setRun((n) => n + 1) }}>Về đầu</button>
    </div>
  </div>
}
/** A new selected formula/matching sample starts a fresh, independent preview. */
export default function FormulaPreview(props: Props) {
  const key = `${toFacelets(props.state)}:${typeof props.moves === 'string' ? props.moves : props.moves.join(' ')}:${props.view}:${props.viewFront}:${props.viewSide}`
  return <Player key={key} {...props} />
}
