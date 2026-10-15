import { useMemo } from 'react'
import { applyMoves, SOLVED } from '../../smart-solver/core/cubie'
import type { CubieState } from '../../smart-solver/core/types'
import { generateTopCrossScramble, TOP_CROSS_LEVELS, TOP_CROSS_LINE_CARD, TOP_CROSS_L_CARD } from '../copy/lesson5'
import { buildTopCrossGuide, PATTERN_LABEL, topCrossPattern, type TopCrossMethod } from '../guide/topCrossGuide'

const NAMES = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }
// D viewed directly from below: DF at the top, DR on the right.
const EDGE_AT: Record<number, number> = { 1: 5, 3: 6, 5: 4, 7: 7 }

function BottomPattern({ state, color }: { state: CubieState; color: string }) {
  const label = PATTERN_LABEL[topCrossPattern(state)]
  return (
    <span style={{ display: 'grid', justifyItems: 'center', gap: '3px', minWidth: 0 }}>
      <svg viewBox="0 0 62 62" width="48" height="48" role="img" aria-label={`${label} ở mặt đáy D`} style={{ maxWidth: '100%', height: 'auto' }}>
        {Array.from({ length: 9 }, (_, i) => {
          const slot = EDGE_AT[i]
          const active = i === 4 || (slot !== undefined && state.eo[slot] === 0)
          return <rect key={i} x={i % 3 * 21} y={Math.floor(i / 3) * 21} width="19" height="19" rx="2" fill={active ? color : 'var(--rb-surface-2)'} stroke="var(--rb-border)" />
        })}
      </svg>
      <span style={{ fontSize: '10px', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
    </span>
  )
}

export default function TopCrossMethodPreview({ method, bottomColor }: { method: TopCrossMethod; bottomColor: number }) {
  const routes = useMemo(() => TOP_CROSS_LEVELS.map((level) => {
    let state = applyMoves(SOLVED, generateTopCrossScramble(level.id, () => 0))
    const states = [state]
    const formulas: string[] = []
    for (let i = 0; i < 3; i += 1) {
      const guide = buildTopCrossGuide(state, NAMES, method)
      if (!guide) break
      formulas.push(guide.formula === TOP_CROSS_L_CARD.formula ? 'L' : 'Đối')
      state = guide.states[guide.states.length - 1]!
      states.push(state)
    }
    return { id: level.id, states, formulas }
  }), [method])
  const color = `#${bottomColor.toString(16).padStart(6, '0')}`

  return (
    <div style={{ display: 'grid', gap: '12px', padding: '12px', border: '1px solid var(--rb-border)', borderRadius: 'var(--rb-r-md)', color: 'var(--rb-text)' }}>
      <div style={{ fontSize: '13px', fontWeight: 700 }}>Minh hoạ cách dùng {method === 'dual' ? 'hai công thức' : 'một công thức'}</div>
      <div style={{ fontSize: '12px', color: 'var(--rb-text-muted)', lineHeight: 1.5 }}>
        Nhìn thẳng vào mặt đáy D. Ô tô màu là tâm và cạnh đã hướng đúng; bỏ qua các góc. Mỗi mũi tên là một lượt công thức, căn lại D khi cần.
      </div>
      {routes.map((route) => (
        <div key={route.id} style={{ display: 'grid', gap: '5px' }}>
          <div style={{ fontSize: '12px', color: 'var(--rb-text-muted)' }}>{PATTERN_LABEL[topCrossPattern(route.states[0]!)]} · {route.formulas.length} lượt</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '3px' }}>
            {route.states.map((state, i) => (
              <span key={i} style={{ display: 'contents' }}>
                {i > 0 && <span style={{ display: 'grid', justifyItems: 'center', flex: '0 0 22px', paddingTop: '6px', color: 'var(--rb-accent-link)' }}>
                  <span style={{ fontSize: '10px' }}>{route.formulas[i - 1]}</span>
                  <span aria-hidden="true">→</span>
                </span>}
                <BottomPattern state={state} color={color} />
              </span>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: 'grid', gap: '5px', fontSize: '12px', lineHeight: 1.5 }}>
        <div><strong>L:</strong> {TOP_CROSS_L_CARD.formula}</div>
        {method === 'dual' && <div><strong>Đối:</strong> {TOP_CROSS_LINE_CARD.formula}</div>}
      </div>
    </div>
  )
}
