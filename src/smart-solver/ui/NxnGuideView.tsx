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

  return (
    <div className="guide">
      <div className="scan-step-text">Cầm khối giống khối 3D: mặt trước hướng về bạn, mặt trên ở trên.</div>
      {stage && (
        <div className="scan-step-title">
          Giai đoạn {stageIndex + 1}/{guide.stages.length}: {stage.title}
        </div>
      )}
      {stage && stage.algorithms.length > 0 && <div className="scan-legend">Công thức: {[...new Set(stage.algorithms)].join(' · ')}</div>}

      <div className="guide-move">
        <span className="guide-notation">{move}</span>
        <span className="guide-count">
          Bước {guide.index + 1}/{guide.solution.length}
        </span>
      </div>
      <div className="scan-step-text">{describeTurn(move, guide.size)}</div>
      {nextPart && nextPart !== move && (
        <div className="scan-status">
          Đã xoay {guide.partial.join(', ')} — tiếp theo xoay {nextPart} để hoàn thành bước này.
        </div>
      )}

      <div className="guide-sequence">
        {stageMoves.map((m, i) => (
          <span key={i} className={`guide-token${offset + i < guide.index ? ' done' : offset + i === guide.index ? ' current' : ''}`}>
            {m}
          </span>
        ))}
      </div>

      <div className="scan-actions">
        <button className="reset" onClick={onRescan}>
          Làm lại từ đầu
        </button>
        <button className="scramble" onClick={onDone}>
          Đã xoay
        </button>
      </div>
      <div className="scan-legend">
        Có thể kéo xoay trực tiếp trên khối 3D (từng tầng một). Xoay nhầm thì bước hoàn tác sẽ được chèn vào trước.
      </div>
    </div>
  )
}
