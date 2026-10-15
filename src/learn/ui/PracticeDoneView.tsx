import type { StageDef } from '../stages'
import { format, getStage } from '../copy/copy'

export interface PracticeDoneViewProps {
  stage: StageDef
  stats: { moves: number; seconds: number; hints: number }
  nextStage?: StageDef | null
  onNextStage?: () => void
  onPracticeAgain: () => void
  onBackToRoadmap: () => void
}

export default function PracticeDoneView({
  stage,
  stats,
  nextStage,
  onNextStage,
  onPracticeAgain,
  onBackToRoadmap
}: PracticeDoneViewProps) {
  const stageCopy = getStage(stage.id)

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="rb-learn-practice-done" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0 16px' }}>
      {/* Header Badge */}
      <div style={{ textAlign: 'center', padding: '6px 0' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--rb-success-bg)',
            border: '2px solid var(--rb-success-border)',
            color: 'var(--rb-success-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 10px',
            fontSize: '26px'
          }}
        >
          ✓
        </div>
        <h2 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--rb-text)', margin: '0 0 4px', lineHeight: 1.25 }}>
          {format('practiceDoneTitle')}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--rb-text-muted)', margin: 0 }}>
          {format('practiceDoneSummary')}
        </p>
      </div>

      {/* Stats Block (Nước đi, Thời gian, Gợi ý) */}
      <div role="region" aria-label="Thành tích phiên luyện tập" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        <div className="rb-card" aria-label={`Số nước đi: ${stats.moves}`} style={{ padding: '10px 8px', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div className="rb-overline" style={{ fontSize: '10px' }}>{format('statsMoves')}</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--rb-text)' }}>{stats.moves}</div>
        </div>

        <div className="rb-card" aria-label={`Thời gian hoàn thành: ${formatTimer(stats.seconds)}`} style={{ padding: '10px 8px', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div className="rb-overline" style={{ fontSize: '10px' }}>{format('statsTime')}</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--rb-text)', fontVariantNumeric: 'tabular-nums' }}>
            {formatTimer(stats.seconds)}
          </div>
        </div>

        <div className="rb-card" aria-label={`Số gợi ý đã dùng: ${stats.hints}`} style={{ padding: '10px 8px', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div className="rb-overline" style={{ fontSize: '10px' }}>{format('statsHints')}</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--rb-text)' }}>{stats.hints}</div>
        </div>
      </div>

      {/* Bạn vừa đạt được */}
      <div className="rb-card" style={{ padding: '14px', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', background: 'var(--rb-surface-2)' }}>
        <div className="rb-overline" style={{ fontSize: '11px', color: 'var(--rb-accent-2)' }}>
          {format('whatYouAchieved')}
        </div>
        <div style={{ fontSize: '13.5px', color: 'var(--rb-text)', lineHeight: 1.4, fontWeight: 500 }}>
          {stageCopy.goal}
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--rb-text-muted)', lineHeight: 1.4 }}>
          {stageCopy.why}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
        {nextStage && onNextStage ? (
          <button
            type="button"
            className="rb-btn rb-btn--primary rb-btn--block"
            onClick={onNextStage}
            style={{ height: '48px', fontSize: '14.5px' }}
          >
            <span style={{ marginRight: '4px' }}>{format('nextStageAction')}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ) : null}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="rb-btn rb-btn--secondary"
            onClick={onPracticeAgain}
            style={{ flex: 1, height: '44px', fontSize: '13.5px' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '4px' }}>
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            {format('practiceAgain')}
          </button>

          <button
            type="button"
            className="rb-btn rb-btn--ghost"
            onClick={onBackToRoadmap}
            style={{ flex: 1, height: '44px', fontSize: '13.5px' }}
          >
            {format('backToRoadmap')}
          </button>
        </div>
      </div>
    </div>
  )
}
