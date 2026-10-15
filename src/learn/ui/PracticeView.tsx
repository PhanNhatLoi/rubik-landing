import { useState, useEffect, useRef } from 'react'
import type { CubieState, Move } from '../../smart-solver/core/types'
import type { StageDef } from '../stages'
import { format, getMove, getStage } from '../copy/copy'
import { nextHint, resetHintPlan, stageProgress } from '../engine/practice'

export interface PracticeViewProps {
  stage: StageDef
  cubeState: CubieState
  onHighlightMove: (move: Move | null) => void
  onUndo: () => void
  canUndo?: boolean
  moveHistory?: Move[]
  onStageComplete: (stats: { moves: number; seconds: number; hints: number }) => void
  onQuit: () => void
  onOpenNotation?: () => void
}

export default function PracticeView({
  stage,
  cubeState,
  onHighlightMove,
  onUndo,
  canUndo = false,
  moveHistory = [],
  onStageComplete,
  onQuit,
  onOpenNotation
}: PracticeViewProps) {
  const [seconds, setSeconds] = useState(0)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [activeHint, setActiveHint] = useState<{ move: Move; title: string; hint: string } | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const stageCopy = getStage(stage.id)
  const isCornerStage = stage.id === 'corners' || stage.id === 'topFace' || stage.id === 'topCorners'
  const unit = isCornerStage ? format('unitCorner') : format('unitEdge')

  const progress = stageProgress(stage, cubeState)
  const progressPercent = Math.min(100, Math.round((progress.done / progress.total) * 100))
  const moveCount = moveHistory.length

  // Timer
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    resetHintPlan()
    return () => resetHintPlan()
  }, [])

  // A turn makes the shown hint stale.
  const seenCube = useRef(cubeState)
  useEffect(() => {
    if (seenCube.current === cubeState) return
    seenCube.current = cubeState
    setActiveHint(null)
    onHighlightMove(null)
  }, [cubeState, onHighlightMove])

  // Auto detect completion on state change
  const completedRef = useRef(false)
  useEffect(() => {
    if (completedRef.current) return
    if (stage.isDone(cubeState)) {
      completedRef.current = true
      onHighlightMove(null)
      onStageComplete({ moves: moveCount, seconds, hints: hintsUsed })
    }
  }, [cubeState, stage, moveCount, seconds, hintsUsed, onHighlightMove, onStageComplete])

  const handleAskHint = () => {
    if (activeHint) {
      onHighlightMove(activeHint.move)
      return
    }
    const hint = nextHint(stage, cubeState)
    if (hint) {
      const moveCopy = getMove(hint.move)
      setActiveHint({ move: hint.move, title: moveCopy.title, hint: moveCopy.hint })
      onHighlightMove(hint.move)
      setHintsUsed((h) => h + 1)
      setFeedback(null)
    } else {
      setFeedback(format('noHint'))
    }
  }

  const handleManualCheck = () => {
    if (stage.isDone(cubeState)) {
      if (!completedRef.current) {
        completedRef.current = true
        onHighlightMove(null)
        onStageComplete({ moves: moveCount, seconds, hints: hintsUsed })
      }
    } else {
      setFeedback(format('progressFeedback', { done: progress.done, total: progress.total, unit }))
    }
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="rb-learn-practice" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0 16px' }}>
      {/* Header điều hướng & Nút Ký hiệu */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <button
          type="button"
          className="rb-btn rb-btn--ghost"
          onClick={onQuit}
          aria-label={format('stopPracticeAria')}
          style={{ minHeight: '40px', height: '40px', padding: '0 12px', fontSize: '12.5px', borderRadius: 'var(--rb-r-pill)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '4px' }}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          {format('stopPractice')}
        </button>

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

      {/* Thanh tiến độ */}
      <div className="rb-progress" aria-hidden="true" style={{ margin: '2px 0 4px' }}>
        <div className="rb-progress__bar" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Stage Badge & Title */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '2px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <span className="rb-chip" style={{ fontSize: '11px', height: '22px', padding: '0 7px', color: 'var(--rb-accent-2)' }}>
              {format('practiceMode')}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--rb-text-muted)' }}>
              {format('stageOfSeven', { index: stage.index + 1 })}
            </span>
          </div>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--rb-text)', margin: 0, lineHeight: 1.3 }}>
            {stageCopy.title}
          </h2>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--rb-accent-link)' }}>
            {format('stageProgress', { done: progress.done, total: progress.total, unit })}
          </div>
        </div>
      </div>

      {/* Stats Counter Row */}
      <div role="region" aria-label={format('sessionStatsAria')} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        <div className="rb-card" aria-label={format('movesAria', { count: moveCount })} style={{ padding: '8px 10px', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <div className="rb-overline" style={{ fontSize: '10px' }}>{format('movesLabel')}</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--rb-text)' }}>{moveCount}</div>
        </div>

        <div className="rb-card" aria-label={format('timeAria', { time: formatTimer(seconds) })} style={{ padding: '8px 10px', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <div className="rb-overline" style={{ fontSize: '10px' }}>{format('timeLabel')}</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--rb-text)', fontVariantNumeric: 'tabular-nums' }}>
            {formatTimer(seconds)}
          </div>
        </div>

        <div className="rb-card" aria-label={format('hintsAria', { count: hintsUsed })} style={{ padding: '8px 10px', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <div className="rb-overline" style={{ fontSize: '10px' }}>{format('hintsLabel')}</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--rb-text)' }}>{hintsUsed}</div>
        </div>
      </div>

      {/* Active Hint Card */}
      {activeHint && (
        <div
          role="status"
          aria-live="polite"
          className="rb-card"
          style={{ padding: '12px 14px', gap: '12px', background: 'var(--rb-surface-2)', border: '1px solid var(--rb-accent-2)' }}
        >
          <div className="rb-move-hero" style={{ width: '56px', height: '56px', fontSize: '24px' }}>
            {activeHint.move}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="rb-overline" style={{ fontSize: '10px', color: 'var(--rb-accent-2)' }}>
              {format('hintActiveTitle', { move: activeHint.move })}
            </div>
            <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--rb-text)', lineHeight: 1.3 }}>
              {activeHint.title}
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--rb-text-muted)', lineHeight: 1.35, marginTop: '2px' }}>
              {activeHint.hint}
            </div>
          </div>
        </div>
      )}

      {/* Feedback alert */}
      {feedback && (
        <div role="status" aria-live="polite" className="rb-alert" style={{ fontSize: '12.5px', padding: '8px 12px' }}>
          {feedback}
        </div>
      )}

      {/* Drag hint */}
      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--rb-text-subtle)', lineHeight: 1.4 }}>
        {format('practiceDragHint')}
      </div>

      {/* Action Buttons: Gợi ý, Hoàn tác, Kiểm tra */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '4px' }}>
        <button
          type="button"
          className="rb-btn rb-btn--secondary"
          onClick={handleAskHint}
          aria-label={format('hintBtn')}
          style={{ height: '48px', minHeight: '48px', minWidth: 0, fontSize: '13.5px', padding: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '4px' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          {format('hintBtn')}
        </button>

        <button
          type="button"
          className="rb-btn rb-btn--secondary"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label={format('undoBtn')}
          style={{ height: '48px', minHeight: '48px', minWidth: 0, fontSize: '13.5px', padding: 0, opacity: canUndo ? 1 : 0.5 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '4px' }}>
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          {format('undoBtn')}
        </button>

        <button
          type="button"
          className="rb-btn rb-btn--primary"
          onClick={handleManualCheck}
          aria-label={format('checkBtn')}
          style={{ height: '48px', minHeight: '48px', minWidth: 0, fontSize: '13.5px', padding: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '4px' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {format('checkBtn')}
        </button>
      </div>
    </div>
  )
}
