import { useState, useEffect } from 'react'
import type { CubieState } from '../../smart-solver/core/types'
import type { StageDef } from '../stages'
import { format } from '../copy/copy'
import { getCurriculumStageCopy } from '../curriculum'

export interface CheckpointViewProps {
  stage: StageDef
  cubeState?: CubieState | null
  nextStage?: StageDef | null
  onMatch: () => void
  onNeedFix: () => void
  onOpenRoadmap?: () => void
  onOpenNotation?: () => void
}

export default function CheckpointView({
  stage,
  cubeState,
  nextStage,
  onMatch,
  onNeedFix,
  onOpenRoadmap,
  onOpenNotation
}: CheckpointViewProps) {
  const autoDone = cubeState ? stage.isDone(cubeState) : false
  const stageCopy = getCurriculumStageCopy(stage.id)
  const nextStageCopy = nextStage ? getCurriculumStageCopy(nextStage.id) : null

  const [checkedItems, setCheckedItems] = useState<boolean[]>(() =>
    stageCopy.check.map(() => autoDone)
  )

  useEffect(() => {
    if (autoDone) {
      setCheckedItems(stageCopy.check.map(() => true))
    } else {
      setCheckedItems((prev) =>
        prev.length === stageCopy.check.length ? prev : stageCopy.check.map(() => false)
      )
    }
  }, [autoDone, stage.id, stageCopy.check])

  const toggleItem = (index: number) => {
    setCheckedItems((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  const allChecked = checkedItems.length > 0 && checkedItems.every(Boolean)
  const canProceed = autoDone || allChecked

  return (
    <div className="rb-learn-checkpoint" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0 16px' }}>
      {/* Header điều hướng */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        {onOpenRoadmap ? (
          <button
            type="button"
            className="rb-btn rb-btn--ghost"
            onClick={onOpenRoadmap}
            aria-label={format('viewRoadmap')}
            style={{ minHeight: '40px', height: '40px', padding: '0 12px', fontSize: '12.5px', borderRadius: 'var(--rb-r-pill)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '4px' }}>
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            Lộ trình
          </button>
        ) : <div />}

        {onOpenNotation && (
          <button
            type="button"
            className="rb-btn rb-btn--link"
            onClick={onOpenNotation}
            style={{ padding: '0 4px', minHeight: '44px', height: 'auto', fontSize: '12.5px' }}
          >
            {format('whatIsNotation')}
          </button>
        )}
      </div>

      {/* Stage Badge & Title */}
      <div>
        <div style={{ display: 'inline-flex', marginBottom: '6px' }}>
          <span className="rb-chip" style={{ fontSize: '12px', height: '24px', padding: '0 8px' }}>
            {format('stageCounter', { index: stage.index + 1, title: stageCopy.title })}
          </span>
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--rb-text)', margin: '0 0 4px', lineHeight: 1.3 }}>
          {format('stageDone', { stage: stageCopy.title })}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--rb-text-muted)', margin: 0, lineHeight: 1.4 }}>
          {stageCopy.goal}
        </p>
      </div>

      {/* Auto check banner or hint */}
      {autoDone ? (
        <div
          role="status"
          aria-live="polite"
          className="rb-alert"
          style={{
            background: 'var(--rb-success-bg)',
            borderColor: 'var(--rb-success-border)',
            color: 'var(--rb-success-text)',
            fontSize: '12.5px'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>{format('autoCheckPassed')}</span>
        </div>
      ) : (
        <div style={{ fontSize: '12.5px', color: 'var(--rb-text-subtle)', lineHeight: 1.4 }}>
          {format('autoCheckManualFallback')}
        </div>
      )}

      {/* Checklist section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="rb-overline" style={{ fontSize: '11px' }}>
          {format('criteriaLabel')}
        </div>

        {stageCopy.check.map((criterion, idx) => {
          const isChecked = Boolean(checkedItems[idx])
          return (
            <div
              key={idx}
              role="checkbox"
              aria-checked={isChecked}
              tabIndex={0}
              onClick={() => toggleItem(idx)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  toggleItem(idx)
                }
              }}
              className="rb-card"
              style={{
                padding: '12px 14px',
                minHeight: '44px',
                cursor: 'pointer',
                background: isChecked ? 'var(--rb-surface-2)' : 'var(--rb-surface-1)',
                borderColor: isChecked ? 'var(--rb-border-selected)' : 'var(--rb-border)',
                transition: 'background var(--rb-t-fast) var(--rb-ease), border-color var(--rb-t-fast) var(--rb-ease)'
              }}
            >
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: 'var(--rb-r-xs)',
                  border: isChecked ? '1px solid transparent' : '1px solid var(--rb-border-strong)',
                  background: isChecked ? 'var(--rb-accent-gradient)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background var(--rb-t-fast) var(--rb-ease)'
                }}
              >
                {isChecked && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize: '13.5px', color: 'var(--rb-text)', lineHeight: 1.4, flex: 1 }}>
                {criterion}
              </span>
            </div>
          )
        })}
      </div>

      {/* Next Stage preview or all done celebration */}
      {nextStage && nextStageCopy ? (
        <div
          className="rb-card"
          style={{
            padding: '10px 14px',
            background: 'var(--rb-surface-1)',
            fontSize: '12.5px',
            color: 'var(--rb-text-muted)'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--rb-accent-2)' }}>
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span style={{ flex: 1 }}>
            {format('nextStagePreview', { index: nextStage.index + 1, title: nextStageCopy.title })}
          </span>
        </div>
      ) : (
        <div
          className="rb-card"
          style={{
            padding: '12px 14px',
            background: 'var(--rb-surface-2)',
            border: '1px solid var(--rb-accent-2)',
            fontSize: '13px',
            color: 'var(--rb-text)',
            fontWeight: 600
          }}
        >
          <span style={{ flex: 1, textAlign: 'center' }}>
            🎉 {format('allDoneCelebration')}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="rb-btn rb-btn--secondary"
          onClick={onNeedFix}
          style={{ flex: 1, minWidth: '130px', height: '48px', minHeight: '48px', fontSize: '13px', padding: '0 8px' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '4px', flexShrink: 0 }}>
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {format('needFix')}
          </span>
        </button>

        <button
          type="button"
          className="rb-btn rb-btn--primary"
          onClick={onMatch}
          disabled={!canProceed}
          style={{
            flex: 1,
            minWidth: '130px',
            height: '48px',
            minHeight: '48px',
            fontSize: '13.5px',
            padding: '0 8px',
            opacity: canProceed ? 1 : 0.45,
            cursor: canProceed ? 'pointer' : 'not-allowed'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '4px', flexShrink: 0 }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{format('checkMatch')}</span>
        </button>
      </div>
    </div>
  )
}
