import { useState } from 'react'
import { FACES, type Face, type Move } from '../../smart-solver/core/types'
import type { GuideState } from '../../smart-solver/guidance/fsm'
import type { Scheme } from '../../smart-solver/ui/palette'
import { format, getMove, getStage } from '../copy/copy'
import type { StageDef } from '../stages'

export interface StepViewProps {
  guide: GuideState
  colors: Scheme
  currentStage: StageDef
  stageTitle?: string
  algorithms?: string[]
  stageStartIndex?: number
  stageEndIndex?: number
  onDone: () => void
  onWrong: (move: Move) => void
  onOpenRoadmap: () => void
  onOpenNotation: () => void
  onCheckStage?: () => void
  onRescan: () => void
  onAutoPlay?: () => void
}

export default function StepView({
  guide,
  colors,
  currentStage,
  stageTitle,
  algorithms,
  stageStartIndex = 0,
  stageEndIndex = guide.solution.length,
  onDone,
  onWrong,
  onOpenRoadmap,
  onOpenNotation,
  onCheckStage,
  onRescan,
  onAutoPlay
}: StepViewProps) {
  const [pickingWrong, setPickingWrong] = useState(false)

  const move = guide.solution[guide.index]
  const total = guide.solution.length
  if (!move) return null

  const stageCopy = getStage(currentStage.id)
  const moveCopy = getMove(move)

  // Progress relative to total solution or current stage
  const stageTotal = Math.max(1, stageEndIndex - stageStartIndex)
  const stageStep = Math.min(stageTotal, Math.max(1, guide.index - stageStartIndex + 1))
  const progressPercent = Math.min(100, Math.round(((guide.index) / Math.max(1, total)) * 100))

  return (
    <div className="rb-learn-step" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0 16px' }}>
      {/* Thanh tiến độ */}
      <div className="rb-progress" aria-hidden="true" style={{ margin: '2px 0 4px' }}>
        <div className="rb-progress__bar" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Header điều hướng & Giai đoạn */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
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
          {format('roadmapShort')}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onCheckStage && (
            <button
              type="button"
              className="rb-btn rb-btn--ghost"
              onClick={onCheckStage}
              aria-label={format('checkStageAria')}
              style={{ minHeight: '40px', height: '40px', padding: '0 12px', fontSize: '12.5px', borderRadius: 'var(--rb-r-pill)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '4px' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {format('checkStageButton')}
            </button>
          )}

          <button
            type="button"
            className="rb-btn rb-btn--link"
            onClick={onOpenNotation}
            style={{ padding: '0 4px', minHeight: '44px', height: 'auto', fontSize: '12.5px' }}
          >
            {format('whatIsNotation')}
          </button>
        </div>
      </div>

      {/* Tên giai đoạn */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '2px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--rb-text)', margin: 0, lineHeight: 1.3 }}>
          {format('stageCounter', { index: currentStage.index + 1, title: stageTitle ?? stageCopy.title })}
        </h3>
        <span style={{ fontSize: '12.5px', color: 'var(--rb-text-muted)', flexShrink: 0, marginLeft: '8px' }}>
          {format('stepCounter', { step: stageStep, total: stageTotal })}
        </span>
      </div>

      {/* Nhắc nhở cầm khối */}
      <div style={{ fontSize: '12px', color: 'var(--rb-text-subtle)', lineHeight: 1.35 }}>
        {format('holdConventionDesc', { front: colors.F.label, top: colors.U.label })}
      </div>

      {/* Hero Move Card */}
      <div
        className="rb-card"
        role="region"
        aria-label={format('stepCardAria', { step: guide.index + 1, total, title: moveCopy.title })}
        style={{ padding: '12px 14px', gap: '14px', margin: '4px 0' }}
      >
        <div className="rb-move-hero">
          {move}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div className="rb-overline" style={{ fontSize: '10.5px' }}>
            {format('stepCounter', { step: guide.index + 1, total })}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--rb-text)', lineHeight: 1.25 }}>
            {moveCopy.title}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--rb-text-muted)', lineHeight: 1.35 }}>
            {moveCopy.hint}
          </div>
          {algorithms && algorithms.length > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--rb-accent-link)', marginTop: '4px', fontWeight: 500 }}>
              {format('algorithmLabel')} {[...new Set(algorithms)].join(' · ')}
            </div>
          )}
        </div>
      </div>

      {/* Cảnh báo trạng thái */}
      {guide.partial && (
        <div role="status" aria-live="polite" className="rb-alert">
          {format('partialTurn', { partial: guide.partial, move })}
        </div>
      )}
      {guide.phase === 'RECOVERING' && (
        <div role="status" aria-live="polite" className="rb-alert">
          {format('recovering')}
        </div>
      )}

      {/* Dãy nước đi giai đoạn */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '2px 0 8px', WebkitOverflowScrolling: 'touch' }}>
        {guide.solution.map((m, i) => {
          if (i < stageStartIndex || i >= stageEndIndex) return null
          const isDone = i < guide.index
          const isCurrent = i === guide.index
          return (
            <span
              key={i}
              className={`rb-move${isDone ? ' rb-move--done' : isCurrent ? ' rb-move--current' : ''}`}
            >
              {m}
            </span>
          )
        })}
      </div>

      {/* Bộ chọn xoay nhầm (Picker) */}
      {pickingWrong ? (
        <div className="guide-picker" style={{ margin: '6px 0', padding: '12px', borderRadius: 'var(--rb-r-lg)', background: 'var(--rb-surface-1)', border: '1px solid var(--rb-border)' }}>
          <div className="rb-overline" style={{ marginBottom: '8px' }}>
            {format('whichMoveDidYouTurn')}
          </div>
          <div className="guide-picker-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
            {FACES.flatMap((f) =>
              (['', "'", '2'] as const).map((suffix) => {
                const m = `${f}${suffix}` as Move
                return (
                  <button
                    key={m}
                    type="button"
                    className="guide-pick rb-move"
                    onClick={() => {
                      setPickingWrong(false)
                      onWrong(m)
                    }}
                    aria-label={format('selectMoveAria', { move: m })}
                    style={{
                      height: '40px',
                      minHeight: '40px',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[f].css, flexShrink: 0 }} />
                    {m}
                  </button>
                )
              })
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              type="button"
              className="rb-btn rb-btn--ghost"
              style={{ flex: 1, height: '44px', minHeight: '44px', fontSize: '13px' }}
              onClick={() => setPickingWrong(false)}
            >
              {format('cancel')}
            </button>
            <button
              type="button"
              className="rb-btn rb-btn--ghost"
              style={{ flex: 1, height: '44px', minHeight: '44px', fontSize: '13px' }}
              onClick={onRescan}
            >
              {format('rescan')}
            </button>
          </div>
        </div>
      ) : (
        /* Action buttons */
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="rb-btn rb-btn--secondary"
            onClick={() => setPickingWrong(true)}
            aria-label={format('wrongMove')}
            title={format('wrongMove')}
            style={{ height: '52px', minHeight: '52px', padding: '0 14px', flexShrink: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>{format('wrongMove')}</span>
          </button>

          <button
            type="button"
            className="rb-btn rb-btn--primary"
            style={{ flex: 1, minWidth: '130px', height: '52px', minHeight: '52px' }}
            onClick={onDone}
          >
            {format('doneTurn')}
          </button>
        </div>
      )}

      {/* Tự động xoay nếu có */}
      {onAutoPlay && (
        <button
          type="button"
          className="rb-btn rb-btn--link"
          onClick={onAutoPlay}
          style={{ height: '36px', fontSize: '12.5px' }}
        >
          {format('autoPlayStep')}
        </button>
      )}

      <div style={{ textAlign: 'center', fontSize: '11.5px', color: 'var(--rb-text-subtle)', marginTop: '4px' }}>
        {format('dragHint')}
      </div>
    </div>
  )
}
