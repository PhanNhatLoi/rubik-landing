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

export interface GuideViewProps {
  guide: GuideState
  colors: Scheme
  optimalStatus: OptimalStatus
  onDone: () => void
  onWrong: (move: Move) => void
  onRescan: () => void
}

export default function GuideView({ guide, colors, optimalStatus, onDone, onWrong, onRescan }: GuideViewProps) {
  const [picking, setPicking] = useState(false)
  const move = guide.solution[guide.index]
  const total = guide.solution.length
  if (!move) return null
  const { face } = parseMove(move)

  return (
    <div className="guide">
      <div className="scan-step-text">
        Cầm khối: mặt {colors.F.label} hướng về bạn, mặt {colors.U.label} ở trên.
      </div>

      <div className="guide-move">
        <span className="guide-swatch" style={{ background: colors[face].css }} />
        <span className="guide-notation">{move}</span>
        <span className="guide-count">
          Bước {guide.index + 1}/{total}
        </span>
      </div>
      <div className="scan-step-text">{describeMove(move, colors)}</div>
      {guide.phase === 'RECOVERING' && <div className="scan-status">Đang tìm lời giải ngắn hơn từ trạng thái mới...</div>}

      <div className="guide-sequence">
        {guide.solution.map((m, i) => (
          <span key={i} className={`guide-token${i < guide.index ? ' done' : i === guide.index ? ' current' : ''}`}>
            {m}
          </span>
        ))}
      </div>

      {picking ? (
        <div className="guide-picker">
          <div className="scan-legend">Bạn đã xoay phép nào?</div>
          <div className="guide-picker-grid">
            {FACES.flatMap((f) =>
              (['', "'", '2'] as const).map((suffix) => {
                const m = `${f}${suffix}` as Move
                return (
                  <button
                    key={m}
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
          <div className="scan-actions">
            <button className="reset" onClick={() => setPicking(false)}>
              Huỷ
            </button>
            <button className="reset" onClick={onRescan}>
              Không rõ — quét lại
            </button>
          </div>
        </div>
      ) : (
        <div className="scan-actions">
          <button className="reset" onClick={() => setPicking(true)}>
            Xoay sai
          </button>
          <button className="scramble" onClick={onDone}>
            Đã xoay
          </button>
        </div>
      )}
      <div className={`guide-optimal ${optimalStatus}`}>
        {optimalStatus === 'proven'
          ? `Đường đi ngắn nhất (đã chứng minh): còn ${total - guide.index} bước.`
          : optimalStatus === 'searching'
            ? 'Gần tối ưu — đang tìm đường đi ngắn nhất...'
            : total - guide.index <= OPTIMAL_SEARCH_MAX_REMAINING
              ? 'Gần tối ưu — chưa chứng minh được đường ngắn nhất trong 3 giây, sẽ thử lại ở bước sau.'
              : `Gần tối ưu (two-phase). Đường ngắn nhất sẽ được tìm khi còn ≤ ${OPTIMAL_SEARCH_MAX_REMAINING} bước.`}
      </div>
      <div className="scan-legend">Có thể kéo xoay trực tiếp trên khối 3D thay cho nút.</div>
    </div>
  )
}
