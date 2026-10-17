import { useState } from 'react'
import { applyMoves, SOLVED } from '../../smart-solver/core/cubie'
import { toFacelets } from '../../smart-solver/core/facelets'
import type { CubieState, Face } from '../../smart-solver/core/types'
import { CROSS } from '../goals'
import { edgeCell } from '../cells'
import MiniCube from './MiniCube'
import { TypedText, typingDuration, useNarrationTime } from './LessonNarration'

/** One correct cross edge; the other three are at UR (flipped), DR and FR. Even permutation and flip parity. */
export const CROSS_STORY_STATE: CubieState = {
  ...SOLVED,
  ep: [3, 1, 8, 4, 2, 5, 6, 7, 0, 9, 10, 11],
  eo: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
}
export const CROSS_STORY_MOVE = "R'" as const
export const CROSS_STORY_RESULT = applyMoves(CROSS_STORY_STATE, [CROSS_STORY_MOVE])
const correctText = 'Cạnh đang đúng: trắng hướng lên U, màu bên khớp tâm. Giữ nguyên cạnh này.'
const wrongText = 'Cạnh đang sai: ba cạnh còn lại chưa đúng. Một ở U nhưng sai hướng màu, một ở D, một ở hàng giữa.'
const moveText = 'Đưa về hàng giữa: chọn mặt bên có ô cạnh trên U đang sai để tránh làm mất cạnh đã đúng. Trong ví dụ, ô cạnh trên U của mặt R đang sai; xoay R′ để đưa cạnh này xuống hàng giữa.'
const finalText = 'Đã đưa cạnh về hàng giữa. Từ đây, ta sẽ chọn cách xoay để ô trắng hướng lên U.'
const PULSE_MS = 1000
const EDGE_BEAT_MS = PULSE_MS + 100
const correctAt = typingDuration(correctText)
const wrongStart = correctAt + EDGE_BEAT_MS
const wrongAt = wrongStart + typingDuration(wrongText)
const WRONG_ORDER = [3, 2, 0] as const // U → D → middle, matching the explanation.
const moveStart = wrongAt + WRONG_ORDER.length * PULSE_MS
const focusAt = moveStart + typingDuration(moveText)
const turnAt = focusAt + EDGE_BEAT_MS
export const CROSS_STORY_DURATION = turnAt + 1300 + typingDuration(finalText) + 300
export const CROSS_STORY_CUES = { correctAt, wrongAt, moveStart, focusAt, turnAt }

/** Exactly one edge draws attention at a time. Each wrong edge gets its own full beat. */
export function crossStoryFocus(time: number) {
  if (time >= focusAt) return { piece: 3, pulse: time < focusAt + PULSE_MS ? 'focus' : null, active: time < turnAt + 1300 }
  if (time >= wrongAt) {
    const index = Math.min(WRONG_ORDER.length - 1, Math.floor((time - wrongAt) / PULSE_MS))
    return { piece: WRONG_ORDER[index]!, pulse: time < moveStart ? `wrong-${index}` : null, active: time < moveStart }
  }
  const active = time >= correctAt && time < correctAt + PULSE_MS
  return { piece: 1, pulse: active ? 'correct' : null, active }
}

export default function CrossMiddleStory({ faceColors }: { faceColors: Record<Face, number> }) {
  const time = useNarrationTime()
  const [ended, setEnded] = useState(false)
  const instant = time === Infinity
  const finished = instant || ended
  const state = finished ? CROSS_STORY_RESULT : CROSS_STORY_STATE
  const focus = crossStoryFocus(finished ? Infinity : time)
  const cells = [edgeCell(state.ep.indexOf(focus.piece))]
  const turning = !instant && !ended && time >= turnAt
  const emphasizing = !finished && (focus.active || turning)
  return <div style={{ display: 'grid', gap: '10px', padding: '12px', border: '1px solid var(--rb-border)', borderRadius: 'var(--rb-r-md)' }}>
    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}><TypedText text={correctText} /></p>
    <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--rb-bg-1)', borderRadius: 'var(--rb-r-md)', visibility: time < correctAt ? 'hidden' : 'visible' }}>
    <div style={{ width: '100%', maxWidth: '200px', margin: '0 auto' }}>
      <MiniCube facelets={toFacelets(state)} faceColors={faceColors} view="front" grayRest dimRest={emphasizing}
        label={finished ? 'Cạnh sai ở U đã xuống hàng giữa; cạnh đúng vẫn giữ nguyên' : 'Một cạnh đúng; ba cạnh sai ở U, D và hàng giữa'}
        keep={[{ kind: 'centers' }, { kind: 'cells', cells: CROSS.map((piece) => edgeCell(state.ep.indexOf(piece))) }]}
        spotlight={{ kind: 'cells', cells: emphasizing ? cells : [] }}
        pulse={emphasizing ? focus.pulse : null} pulseDuration={PULSE_MS}
        motion={turning ? { notation: CROSS_STORY_MOVE, id: 1, duration: 1300 } : null} onMotionEnd={() => setEnded(true)} />
    </div>
    </div>
    {time >= wrongStart && <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}><TypedText text={wrongText} start={wrongStart} /></p>}
    {time >= moveStart && <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}><TypedText text={moveText} start={moveStart} /></p>}
    {finished && <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}><TypedText text={finalText} start={turnAt + 1300} /></p>}
  </div>
}
