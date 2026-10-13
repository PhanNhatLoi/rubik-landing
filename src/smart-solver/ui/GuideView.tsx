import { useState } from 'react'
import { parseMove } from '../core/cubie'
import { FACES, type Face, type Move } from '../core/types'
import { OPTIMAL_SEARCH_MAX_REMAINING, type GuideState } from '../guidance/fsm'
import type { Scheme } from './palette'
import { POSITION_NAME } from './ScanView'

const DIRECTION: Record<1 | 2 | 3, string> = {
  1: 'xoay theo chiều kim đồng hồ',
  2: 'xoay nửa vòng (180°)',
  3: 'xoay ngược chiều kim đồng hồ'
}

export function describeMove(move: Move, colors: Scheme): string {
  const { face, turns } = parseMove(move)
  return `Mặt ${POSITION_NAME[face]} (${colors[face].label}): ${DIRECTION[turns]}, khi nhìn thẳng vào mặt đó.`
}

export type OptimalStatus = 'proven' | 'searching' | 'unproven'

/** A stage of the beginner method: solution indices [start, end). */
export interface BeginnerStage {
  title: string
  algorithms: string[]
  start: number
  end: number
  index: number
  count: number
}

export interface GuideViewProps {
  guide: GuideState
  colors: Scheme
  optimalStatus: OptimalStatus
  /** Beginner mode: the stage of the current step (null once off the plan after a wrong turn). */
  beginnerStage?: BeginnerStage | null
  onDone: () => void
  onWrong: (move: Move) => void
  onRescan: () => void
}

export default function GuideView({ guide, colors, optimalStatus, beginnerStage, onDone, onWrong, onRescan }: GuideViewProps) {
  const beginner = beginnerStage !== undefined
  const [picking, setPicking] = useState(false)
  const move = guide.solution[guide.index]
  const total = guide.solution.length
  if (!move) return null
  const { face } = parseMove(move)

  const progressPercent = total > 0 ? Math.round(((guide.index) / total) * 100) : 0

  return (
    <div className="guide">
      {/* Thanh tiến độ giải */}
      <div className="rb-progress" aria-hidden="true" style={{ margin: '4px 0 12px' }}>
        <div className="rb-progress__bar" style={{ width: `${progressPercent}%` }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rb-text)' }}>
          {beginnerStage ? `Giai đoạn ${beginnerStage.index + 1}/${beginnerStage.count}: ${beginnerStage.title}` : 'Đang hướng dẫn giải'}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--rb-text-muted)' }}>
          Bước {guide.index + 1}/{total}
        </div>
      </div>

      <div style={{ fontSize: '13px', color: 'var(--rb-text-subtle)', marginBottom: '14px' }}>
        Cầm khối: mặt {colors.F.label} hướng về bạn · mặt {colors.U.label} ở trên
      </div>

      {beginner && !beginnerStage && <div className="rb-alert" style={{ marginBottom: '12px' }}>Hoàn tác bước xoay nhầm rồi tiếp tục.</div>}

      {/* Hero move card */}
      <div
        style={{
          display: 'flex',
          gap: '14px',
          alignItems: 'center',
          margin: '12px 0 16px',
          padding: '14px',
          background: 'var(--rb-surface-1)',
          borderRadius: 'var(--rb-r-xl)',
          border: '1px solid var(--rb-border)',
        }}
      >
        <div className="rb-move-hero">
          {move}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rb-overline">
            Bước {guide.index + 1}/{total}
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rb-text)', marginTop: '2px', lineHeight: 1.3 }}>
            {describeMove(move, colors)}
          </div>
          {beginnerStage && beginnerStage.algorithms.length > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--rb-accent-link)', marginTop: '4px' }}>
              Công thức: {[...new Set(beginnerStage.algorithms)].join(' · ')}
            </div>
          )}
        </div>
      </div>

      {guide.partial && (
        <div className="rb-alert" style={{ marginBottom: '12px' }}>
          Đã xoay {guide.partial} một lần — xoay thêm {guide.partial} lần nữa là xong bước {move}.
        </div>
      )}
      {guide.phase === 'RECOVERING' && <div className="rb-alert" style={{ marginBottom: '12px' }}>Đang tìm lời giải ngắn hơn từ trạng thái mới...</div>}

      {/* Dãy nước đi */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '4px 0 12px', WebkitOverflowScrolling: 'touch' }}>
        {guide.solution.map((m, i) =>
          beginnerStage && (i < beginnerStage.start || i >= beginnerStage.end) ? null : (
            <span key={i} className={`rb-move${i < guide.index ? ' rb-move--done' : i === guide.index ? ' rb-move--current' : ''}`}>
              {m}
            </span>
          )
        )}
      </div>

      {picking ? (
        <div className="guide-picker" style={{ margin: '12px 0' }}>
          <div className="rb-overline" style={{ marginBottom: '8px' }}>Bạn đã xoay phép nào?</div>
          <div className="guide-picker-grid">
            {FACES.flatMap((f) =>
              (['', "'", '2'] as const).map((suffix) => {
                const m = `${f}${suffix}` as Move
                return (
                  <button
                    key={m}
                    type="button"
                    className="guide-pick"
                    onClick={() => {
                      setPicking(false)
                      onWrong(m)
                    }}
                  >
                    <span className="guide-swatch small" style={{ background: colors[f].css }} />
                    {m}
                  </button>
                )
              })
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button type="button" className="rb-btn rb-btn--ghost" onClick={() => setPicking(false)}>
              Huỷ
            </button>
            <button type="button" className="rb-btn rb-btn--ghost" onClick={onRescan}>
              Không rõ — quét lại
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px' }}>
          <button
            type="button"
            className="rb-icon-btn rb-icon-btn--square"
            onClick={() => setPicking(true)}
            aria-label="Xoay sai / chọn lại"
            style={{ width: '52px', height: '52px' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
          <button
            type="button"
            className="rb-btn rb-btn--primary"
            style={{ flex: 1, height: '52px' }}
            onClick={onDone}
          >
            Đã xoay
          </button>
        </div>
      )}

      {!beginner && (
        <div className={`guide-optimal ${optimalStatus}`} style={{ marginTop: '12px' }}>
          {optimalStatus === 'proven'
            ? `Đường đi ngắn nhất (đã chứng minh): còn ${total - guide.index} bước.`
            : optimalStatus === 'searching'
              ? 'Gần tối ưu — đang tìm đường đi ngắn nhất...'
              : total - guide.index <= OPTIMAL_SEARCH_MAX_REMAINING
                ? 'Gần tối ưu — chưa chứng minh được đường ngắn nhất trong 3 giây, sẽ thử lại ở bước sau.'
                : `Gần tối ưu (two-phase). Đường ngắn nhất sẽ được tìm khi còn ≤ ${OPTIMAL_SEARCH_MAX_REMAINING} bước.`}
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--rb-text-subtle)', marginTop: '8px' }}>
        Có thể kéo xoay trực tiếp trên khối 3D. Xoay nhầm sẽ tự chèn bước hoàn tác.
      </div>
    </div>
  )

}
