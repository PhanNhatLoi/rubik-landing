import { currentStage, type NxnGuideState } from '../guidance/nxnGuide'
import { parseTurn } from '../nxn/engine'
import { POSITION_NAME } from './ScanView'

const DIRECTION: Record<1 | 2 | 3, string> = {
  1: 'theo chiều kim đồng hồ',
  2: 'nửa vòng (180°)',
  3: 'ngược chiều kim đồng hồ'
}

/** Vietnamese instruction for an n×n token, e.g. "Rw" → the two right layers together. */
export function describeTurn(token: string, n: number): string {
  const t = parseTurn(token, n)
  if ('rotation' in t) {
    const face = (['R', 'U', 'F'] as const)[t.rotation]
    return `Xoay cả khối ${DIRECTION[t.turns]}, như khi xoay mặt ${POSITION_NAME[face]}.`
  }
  const side = `mặt ${POSITION_NAME[t.face]}`
  const view = `nhìn thẳng vào ${side}`
  if (t.from === 1 && t.to === 1) return `Xoay ${side} ${DIRECTION[t.turns]}, khi ${view}.`
  if (t.from === t.to) return `Xoay riêng tầng thứ ${t.from} tính từ ${side} ${DIRECTION[t.turns]}, khi ${view} (các tầng khác giữ yên).`
  return `Xoay cùng lúc ${t.to} tầng ngoài cùng phía ${side} ${DIRECTION[t.turns]}, khi ${view}.`
}

export interface NxnGuideViewProps {
  guide: NxnGuideState
  /** The single layer to turn next when a wide step was started by dragging layer by layer. */
  nextPart: string | null
  onDone: () => void
  onRescan: () => void
}

export default function NxnGuideView({ guide, nextPart, onDone, onRescan }: NxnGuideViewProps) {
  const move = guide.solution[guide.index]
  if (!move) return null
  const stage = currentStage(guide)
  const stageIndex = stage ? guide.stages.indexOf(stage) : -1
  const stageMoves = stage ? guide.solution.slice(stage.start, stage.end) : guide.solution
  const offset = stage?.start ?? 0
  const total = guide.solution.length
  const progressPercent = total > 0 ? Math.round((guide.index / total) * 100) : 0

  return (
    <div className="guide">
      {/* Thanh tiến độ */}
      <div className="rb-progress" aria-hidden="true" style={{ margin: '4px 0 12px' }}>
        <div className="rb-progress__bar" style={{ width: `${progressPercent}%` }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rb-text)' }}>
          {stage ? `Giai đoạn ${stageIndex + 1}/${guide.stages.length}: ${stage.title}` : 'Đang hướng dẫn giải'}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--rb-text-muted)' }}>
          Bước {guide.index + 1}/{total}
        </div>
      </div>

      <div style={{ fontSize: '13px', color: 'var(--rb-text-subtle)', marginBottom: '14px' }}>
        Cầm khối giống khối 3D: mặt trước hướng về bạn, mặt trên ở trên.
      </div>

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
            {describeTurn(move, guide.size)}
          </div>
          {stage && stage.algorithms.length > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--rb-accent-link)', marginTop: '4px' }}>
              Công thức: {[...new Set(stage.algorithms)].join(' · ')}
            </div>
          )}
        </div>
      </div>

      {nextPart && nextPart !== move && (
        <div className="rb-alert" style={{ marginBottom: '12px' }}>
          Đã xoay {guide.partial.join(', ')} — tiếp theo xoay {nextPart} để hoàn thành bước này.
        </div>
      )}

      {/* Dãy nước đi */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '4px 0 12px', WebkitOverflowScrolling: 'touch' }}>
        {stageMoves.map((m, i) => (
          <span
            key={i}
            className={`rb-move${offset + i < guide.index ? ' rb-move--done' : offset + i === guide.index ? ' rb-move--current' : ''}`}
          >
            {m}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px' }}>
        <button
          type="button"
          className="rb-btn rb-btn--ghost"
          style={{ height: '52px', padding: '0 16px' }}
          onClick={onRescan}
        >
          Làm lại
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

      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--rb-text-subtle)', marginTop: '8px' }}>
        Có thể kéo xoay trực tiếp trên khối 3D (từng tầng một). Xoay nhầm thì bước hoàn tác sẽ được chèn vào trước.
      </div>
    </div>
  )
}
