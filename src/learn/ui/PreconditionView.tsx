import type { StageDef, StageId } from '../stages'
import { format, getStage } from '../copy/copy'

export interface PreconditionViewProps {
  stage: StageDef
  missingStages: StageId[]
  onLearnMissingStage: (stageId: StageId) => void
  onUsePresetSample: () => void
  onRescan: () => void
  onBack: () => void
}

export default function PreconditionView({
  stage,
  missingStages,
  onLearnMissingStage,
  onUsePresetSample,
  onRescan,
  onBack
}: PreconditionViewProps) {
  const stageCopy = getStage(stage.id)
  const firstMissing = missingStages[0]
  const firstMissingCopy = firstMissing ? getStage(firstMissing) : null

  return (
    <div className="rb-learn-precondition" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0 16px' }}>
      {/* Header điều hướng */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <button
          type="button"
          className="rb-btn rb-btn--ghost"
          onClick={onBack}
          aria-label={format('backToSourceAria')}
          style={{ minHeight: '40px', height: '40px', padding: '0 12px', fontSize: '12.5px', borderRadius: 'var(--rb-r-pill)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '4px' }}>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Quay lại
        </button>
      </div>

      {/* Warning Title */}
      <div>
        <div style={{ display: 'inline-flex', marginBottom: '6px' }}>
          <span className="rb-chip" style={{ fontSize: '12px', height: '24px', padding: '0 8px', color: 'var(--rb-warn)' }}>
            Chưa đủ điều kiện
          </span>
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--rb-text)', margin: '0 0 4px', lineHeight: 1.3 }}>
          {format('preconditionTitle')}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--rb-text-muted)', margin: 0, lineHeight: 1.4 }}>
          {format('preconditionDesc')}
        </p>
      </div>

      {/* Missing Stages List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {missingStages.map((missingId) => {
          const missingCopy = getStage(missingId)
          return (
            <div
              key={missingId}
              className="rb-card"
              style={{
                padding: '12px 14px',
                borderColor: 'var(--rb-warn-border)',
                background: 'var(--rb-surface-1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--rb-text)', lineHeight: 1.3 }}>
                  {missingCopy.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--rb-text-muted)', lineHeight: 1.35, marginTop: '2px' }}>
                  {missingCopy.goal}
                </div>
              </div>

              <button
                type="button"
                className="rb-btn rb-btn--secondary"
                style={{ height: '40px', minHeight: '40px', padding: '0 12px', fontSize: '13px', flexShrink: 0 }}
                onClick={() => onLearnMissingStage(missingId)}
                aria-label={format('learnStageBefore', { stage: missingCopy.title })}
              >
                Học trước
              </button>
            </div>
          )
        })}
      </div>

      {/* 3 Exit paths */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
        {firstMissing && firstMissingCopy && (
          <button
            type="button"
            className="rb-btn rb-btn--primary rb-btn--block"
            onClick={() => onLearnMissingStage(firstMissing)}
            style={{ height: '48px', fontSize: '14px' }}
          >
            {format('doMissingStageFirst', { stage: firstMissingCopy.title })}
          </button>
        )}

        <button
          type="button"
          className="rb-btn rb-btn--secondary rb-btn--block"
          onClick={onUsePresetSample}
          style={{ height: '44px', fontSize: '13.5px' }}
        >
          {format('usePracticeSample')}
        </button>

        <button
          type="button"
          className="rb-btn rb-btn--ghost rb-btn--block"
          onClick={onRescan}
          style={{ height: '44px', fontSize: '13.5px' }}
        >
          {format('rescanCube')}
        </button>
      </div>
    </div>
  )
}
