import { useState } from 'react'
import { applyMoves, SOLVED } from '../../smart-solver/core/cubie'
import { toFacelets } from '../../smart-solver/core/facelets'
import type { CubieState, Face, Move } from '../../smart-solver/core/types'
import { edgeCell } from '../cells'
import { CROSS } from '../goals'
import { CROSS_STORY_RESULT } from './CrossMiddleStory'
import MiniCube from './MiniCube'

export const CROSS_SIDE_EXAMPLES = [
  { state: applyMoves(SOLVED, ['F']), whiteFace: 'R' },
  { state: applyMoves(SOLVED, ["U'", "R'"]), whiteFace: 'F' }
] as const
export const CROSS_ALIGNMENT_MOVES: Move[] = ['U2', "F'", 'U2']
export const CROSS_LIFT_EXAMPLE = CROSS_STORY_RESULT
export const CROSS_MIDDLE_EXAMPLES = [
  { id: 'upper', title: 'Cạnh ở tầng trên U', state: applyMoves(CROSS_SIDE_EXAMPLES[0].state, ['R']), moves: ["R'"] as Move[], captions: ['Cạnh sáng đang ở hàng trên của mặt R.', 'Cạnh đã về hàng giữa, nằm giữa hai mặt F và R.'] },
  { id: 'lower', title: 'Cạnh ở tầng đáy D', state: applyMoves(CROSS_SIDE_EXAMPLES[0].state, ["R'"]), moves: ['R'] as Move[], captions: ['Cạnh sáng đang ở hàng dưới của mặt R.', 'Cạnh đã về hàng giữa, nằm giữa hai mặt F và R.'] }
] as const
const cell = (state: CubieState, edgePiece = 1) => edgeCell(state.ep.indexOf(edgePiece))

/** All illustrations share the app's perspective renderer and physical sticker model. */
export function CrossPrincipleDiagram({ state, faceColors, label, destination = false, motion = null, onMotionEnd, edgePiece = 1, showCross = false }: {
  state: CubieState; faceColors: Record<Face, number>; label: string; destination?: boolean | number[]
  motion?: { notation: string; id: number; duration?: number } | null; onMotionEnd?: () => void
  edgePiece?: number; showCross?: boolean
}) {
  return <MiniCube facelets={toFacelets(state)} faceColors={faceColors} label={label} view="front" grayRest
    spotlight={{ kind: 'cells', cells: [cell(state, edgePiece)] }} keep={showCross ? [{ kind: 'centers' }, { kind: 'cells', cells: CROSS.map((piece) => cell(state, piece)) }] : { kind: 'centers' }}
    destination={destination ? Array.isArray(destination) ? destination : [1, 2, 2] : null}
    motion={motion} onMotionEnd={onMotionEnd} />
}

function TurnDemo({ state, moves, captions, faceColors, label, targets, compact = false, correct, edgePiece = 1, showCross = false }: {
  state: CubieState; moves: readonly Move[]; captions: readonly string[]; faceColors: Record<Face, number>; label: string; targets?: number[][]; compact?: boolean; correct?: boolean; edgePiece?: number; showCross?: boolean
}) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [run, setRun] = useState(0)
  const current = applyMoves(state, moves.slice(0, index))
  const start = () => { if (index === moves.length) setIndex(0); setRun((v) => v + 1); setPlaying(true) }
  const reset = () => { setPlaying(false); setIndex(0); setRun((v) => v + 1) }
  return <div style={{ display: 'grid', gap: '8px', minWidth: 0 }}>
    <div style={{ position: 'relative', width: '100%', maxWidth: compact ? '190px' : '300px', margin: '0 auto' }}>
      <CrossPrincipleDiagram state={current} faceColors={faceColors} label={`${label}: ${captions[index] ?? ''}`} destination={targets?.[index] ?? false} edgePiece={edgePiece} showCross={showCross}
        motion={playing ? { notation: moves[index]!, id: run * 100 + index, duration: 1300 } : null}
        onMotionEnd={() => { const next = index + 1; setIndex(next); if (next === moves.length) setPlaying(false) }} />
      {correct !== undefined && !playing && index === moves.length && <div role="img" aria-label={correct ? 'Đúng: ô trắng hướng lên U' : 'Sai: ô trắng không hướng lên U'} style={{ position: 'absolute', top: '12%', right: '8%', zIndex: 1, pointerEvents: 'none', fontSize: '28px', lineHeight: 1, fontWeight: 800, color: correct ? 'var(--rb-success-text)' : '#f87171', textShadow: '0 2px 5px #000' }}>{correct ? '✓' : '✕'}</div>}
    </div>
    <div role="status" aria-live="polite" style={{ minHeight: compact ? '20px' : '40px', textAlign: 'center', fontSize: '13px', lineHeight: 1.5, color: 'var(--rb-text)' }}>
      {playing ? `Đang xoay ${moves[index]!.replaceAll("'", '′')}…` : captions[index]}
    </div>
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
      <button type="button" className="rb-btn rb-btn--secondary" disabled={playing} onClick={start} style={{ minHeight: '44px', height: 'auto', whiteSpace: 'normal', padding: '8px 12px' }}>
        {index === moves.length ? '↻ Xem lại' : `▶ ${compact ? moves.join(' ').replaceAll("'", '′') : 'Xem xoay'}`}
      </button>
      {!compact && <button type="button" className="rb-btn rb-btn--ghost" onClick={reset} style={{ minHeight: '44px' }}>Về đầu</button>}
    </div>
  </div>
}
function MiddleDemo({ faceColors }: { faceColors: Record<Face, number> }) {
  const [selected, setSelected] = useState(0)
  const example = CROSS_MIDDLE_EXAMPLES[selected]!
  return <div style={{ display: 'grid', gap: '12px', padding: '12px', border: '1px solid var(--rb-border)', borderRadius: 'var(--rb-r-md)' }}>
    <div role="group" aria-label="Chọn vị trí bắt đầu của cạnh" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
      {CROSS_MIDDLE_EXAMPLES.map((v, i) => <button key={v.id} type="button" aria-pressed={selected === i} className="rb-btn rb-btn--secondary" onClick={() => setSelected(i)} style={{ height: 'auto', minHeight: '44px', whiteSpace: 'normal', padding: '8px', background: selected === i ? 'var(--rb-accent-tint)' : undefined, borderColor: selected === i ? 'var(--rb-accent-link)' : undefined, color: selected === i ? 'var(--rb-accent-link)' : undefined }}>{selected === i ? '✓ ' : ''}{v.title}</button>)}
    </div>
    <TurnDemo key={example.id} state={example.state} moves={example.moves} captions={example.captions} faceColors={faceColors} label={example.title} />
    <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--rb-text-muted)' }}>U ở trên · F xanh lá ở trước · R đỏ bên phải.<br />Chỉ theo dõi cạnh trắng–xanh lá đang sáng.</div>
  </div>
}
export default function CrossPrincipleExamples({ faceColors, mode }: { faceColors: Record<Face, number>; mode: 'middle' | 'lift' | 'align' }) {
  if (mode === 'middle') return <MiddleDemo faceColors={faceColors} />
  if (mode === 'lift') return <div style={{ display: 'grid', gap: '18px' }}>
    <div role="group" aria-label="Tiếp tục khối mẫu ở phần trước: hai cách đưa cạnh lên U" style={{ padding: '8px', border: '1px solid var(--rb-border)', borderRadius: 'var(--rb-r-md)' }}>
      <div style={{ width: '48%', margin: '0 auto' }}><CrossPrincipleDiagram state={CROSS_LIFT_EXAMPLE} faceColors={faceColors} label="Cạnh trắng–xanh dương vừa được đưa xuống hàng giữa ở phần trước" edgePiece={3} showCross /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {(['R', "F'"] as Move[]).map((move) => <TurnDemo key={move} state={CROSS_LIFT_EXAMPLE} moves={[move]} captions={['', '']} faceColors={faceColors} label={`So sánh kết quả sau ${move}`} compact correct={move !== 'R'} edgePiece={3} showCross />)}
      </div>
    </div>
  </div>
  return <TurnDemo state={CROSS_LIFT_EXAMPLE} moves={CROSS_ALIGNMENT_MOVES} faceColors={faceColors} label="Căn U, đưa cạnh trắng–xanh dương lên và trả U" edgePiece={3} showCross
    targets={[[1, 2, 0], [1, 2, 2], [1, 2, 2], [1, 2, 0]]}
    captions={['◎ đánh dấu ô đích trên U. Bấm xem chuỗi U2 → F′ → U2.', 'Đã căn U2: ô đích ở đường đi qua F. U2 là xoay U nửa vòng.', 'Đã xoay F′: ô trắng hướng lên. Còn bước trả U.', 'Đã trả U2: cạnh trắng–xanh dương đúng mặt và khớp tâm B; cạnh trắng–xanh lá ban đầu vẫn đúng.']} />
}
