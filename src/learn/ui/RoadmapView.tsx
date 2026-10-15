import { useState } from 'react'
import type { CubieState } from '../../smart-solver/core/types'
import { STAGES, type StageDef, type StageId } from '../stages'
import { format, getStage } from '../copy/copy'

export interface RoadmapViewProps {
  currentStageId?: StageId | null
  cubeState?: CubieState | null
  completedStages?: StageId[]
  practicedStages?: StageId[]
  onSelectStage: (stage: StageDef) => void
  onOpenPractice?: (stage: StageDef) => void
  onOpenNotation: () => void
  /** Stages that have their own lesson: tapping them opens it instead of expanding. */
  lessonStageIds?: StageId[]
  onOpenLesson?: (stage: StageDef) => void
  onClose?: () => void
}

export default function RoadmapView({
  currentStageId,
  cubeState,
  completedStages,
  practicedStages,
  onSelectStage,
  onOpenPractice,
  onOpenNotation,
  lessonStageIds,
  onOpenLesson,
  onClose
}: RoadmapViewProps) {
  const [expandedId, setExpandedId] = useState<StageId | null>(currentStageId ?? 'cross')

  const toggleExpand = (id: StageId) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="rb-learn-roadmap" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="rb-chip" style={{ fontSize: '12px', height: '24px', padding: '0 8px' }}>
              8 bài
            </span>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--rb-text)', margin: '6px 0 2px', lineHeight: 1.25 }}>
            {format('roadmapTitle')}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--rb-text-muted)', margin: 0 }}>
            {format('roadmapSubtitle')}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            className="rb-icon-btn"
            onClick={onClose}
            aria-label={format('close')}
            style={{ width: '44px', height: '44px', flexShrink: 0 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Bước học 1: cấu trúc khối và ký hiệu */}
      <button
        type="button"
        className="rb-card"
        onClick={onOpenNotation}
        style={{ alignItems: 'center', gap: '12px', padding: '12px 14px', textAlign: 'left', cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}
      >
        <div
          style={{
            width: '32px', height: '32px', borderRadius: 'var(--rb-r-pill)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--rb-accent-gradient)', color: 'var(--rb-text-on-accent)', fontWeight: 700, fontSize: '14px'
          }}
        >
          1
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--rb-text)' }}>Bài 1: Làm quen khối và ký hiệu</div>
          <div style={{ fontSize: '12px', color: 'var(--rb-text-subtle)', marginTop: '2px' }}>
            Tâm, cạnh, góc và cách đọc ký hiệu — học từng bước, có thể bỏ qua
          </div>
        </div>
        <span aria-hidden="true" style={{ color: 'var(--rb-text-muted)', fontSize: '20px' }}>›</span>
      </button>

      {/* Danh sách 7 giai đoạn */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {STAGES.map((stage, idx) => {
          const hasLesson = lessonStageIds?.includes(stage.id) ?? false
          const isExpanded = !hasLesson && expandedId === stage.id
          const isCurrent = currentStageId === stage.id
          const isCompleted = (completedStages?.includes(stage.id) ?? false) || (cubeState ? stage.isDone(cubeState) : false)
          const isPracticed = practicedStages?.includes(stage.id) ?? false
          const isDone = isCompleted
          const copy = getStage(stage.id)

          return (
            <div
              key={stage.id}
              className="rb-card"
              style={{
                flexDirection: 'column',
                alignItems: 'stretch',
                padding: '12px 14px',
                gap: '10px',
                borderColor: isCurrent ? 'var(--rb-accent-tint-border)' : isExpanded ? 'var(--rb-border-strong)' : 'var(--rb-border)',
                background: isCurrent ? 'rgba(0, 229, 255, 0.04)' : 'var(--rb-surface-1)',
                transition: 'border-color var(--rb-t-fast) var(--rb-ease), background var(--rb-t-fast) var(--rb-ease)'
              }}
            >
              {/* Tiêu đề & Thu phóng */}
              <button
                type="button"
                onClick={() => (hasLesson ? onOpenLesson?.(stage) : toggleExpand(stage.id))}
                aria-expanded={hasLesson ? undefined : isExpanded}
                aria-label={hasLesson ? `Bài ${stage.index + 2}. ${copy.title} - Mở bài học` : `Bài ${stage.index + 2}. ${copy.title} - ${isExpanded ? 'Thu gọn' : 'Mở rộng'}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  minHeight: '44px',
                  background: 'none',
                  border: 0,
                  padding: '4px 0',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                {/* Số thứ tự hoặc Checkmark */}
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--rb-r-pill)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                    flexShrink: 0,
                    background: isDone
                      ? 'var(--rb-success-bg)'
                      : isCurrent
                        ? 'var(--rb-accent-gradient)'
                        : 'var(--rb-surface-2)',
                    color: isDone
                      ? 'var(--rb-success-text)'
                      : isCurrent
                        ? 'var(--rb-text-on-accent)'
                        : 'var(--rb-text-muted)',
                    border: isDone ? '1px solid var(--rb-success-border)' : '1px solid var(--rb-border)'
                  }}
                >
                  {isDone ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    idx + 2
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--rb-text)' }}>
                      Bài {stage.index + 2}: {copy.title}
                    </span>
                    {isCurrent && (
                      <span className="rb-chip rb-chip--run" style={{ fontSize: '11px', height: '20px', padding: '0 6px' }}>
                        Đang học
                      </span>
                    )}
                    {isPracticed && !isCurrent && (
                      <span className="rb-chip" style={{ fontSize: '11px', height: '20px', padding: '0 6px', color: 'var(--rb-accent-2)' }}>
                        Đã luyện
                      </span>
                    )}
                  </div>
                  {!isExpanded && (
                    <div style={{ fontSize: '12px', color: 'var(--rb-text-subtle)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {copy.goal}
                    </div>
                  )}
                </div>

                {/* Chevron */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{
                    color: 'var(--rb-text-muted)',
                    transform: hasLesson ? 'rotate(-90deg)' : isExpanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform var(--rb-t-fast) var(--rb-ease)'
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Chi tiết khi mở rộng */}
              {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
                  {/* Mục tiêu */}
                  <div style={{ padding: '8px 10px', borderRadius: 'var(--rb-r-sm)', background: 'var(--rb-surface-2)' }}>
                    <div className="rb-overline" style={{ fontSize: '10.5px', marginBottom: '2px' }}>
                      {format('goalLabel')}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--rb-text)', lineHeight: 1.4 }}>
                      {copy.goal}
                    </div>
                  </div>

                  {/* Vì sao */}
                  <div style={{ padding: '8px 10px', borderRadius: 'var(--rb-r-sm)', background: 'var(--rb-surface-2)' }}>
                    <div className="rb-overline" style={{ fontSize: '10.5px', marginBottom: '2px' }}>
                      {format('whyLabel')}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--rb-text-soft)', lineHeight: 1.4 }}>
                      {copy.why}
                    </div>
                  </div>

                  {/* Tiêu chí kiểm tra */}
                  {copy.check.length > 0 && (
                    <div style={{ padding: '8px 10px', borderRadius: 'var(--rb-r-sm)', background: 'var(--rb-surface-2)' }}>
                      <div className="rb-overline" style={{ fontSize: '10.5px', marginBottom: '4px' }}>
                        {format('criteriaLabel')}
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: 'var(--rb-text-muted)', lineHeight: 1.45 }}>
                        {copy.check.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Nút hành động */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="rb-btn rb-btn--primary"
                      style={{ flex: 1, minWidth: '130px', height: '44px', fontSize: '14px' }}
                      onClick={() => onSelectStage(stage)}
                    >
                      {format('learnFromHere')}
                    </button>
                    {onOpenPractice && (
                      <button
                        type="button"
                        className="rb-btn rb-btn--secondary"
                        style={{ height: '44px', minWidth: '90px', padding: '0 14px', fontSize: '14px' }}
                        onClick={() => onOpenPractice(stage)}
                      >
                        {format('practice')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
