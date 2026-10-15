import { useState } from 'react'
import type { StageDef } from '../stages'
import { format, getStage } from '../copy/copy'
import { PRACTICE_SAMPLES, type PracticeSample } from '../engine/practice'

export interface PracticeSourceViewProps {
  stage: StageDef
  onSelectSample: (sample: PracticeSample) => void
  onStartScan: () => void
  onBack: () => void
  onOpenNotation?: () => void
}

export default function PracticeSourceView({
  stage,
  onSelectSample,
  onStartScan,
  onBack,
  onOpenNotation
}: PracticeSourceViewProps) {
  const [activeTab, setActiveTab] = useState<'preset' | 'scan'>('preset')
  const stageCopy = getStage(stage.id)
  const samples = PRACTICE_SAMPLES[stage.id] ?? []

  return (
    <div className="rb-learn-practice-source" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0 16px' }}>
      {/* Header điều hướng */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <button
          type="button"
          className="rb-btn rb-btn--ghost"
          onClick={onBack}
          aria-label={format('backToRoadmapAria')}
          style={{ minHeight: '40px', height: '40px', padding: '0 12px', fontSize: '12.5px', borderRadius: 'var(--rb-r-pill)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '4px' }}>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Lộ trình
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

      {/* Stage Title */}
      <div>
        <div style={{ display: 'inline-flex', marginBottom: '6px' }}>
          <span className="rb-chip" style={{ fontSize: '12px', height: '24px', padding: '0 8px' }}>
            {format('stageCounter', { index: stage.index + 1, title: stageCopy.title })}
          </span>
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--rb-text)', margin: '0 0 4px', lineHeight: 1.3 }}>
          {format('practiceSourceTitle')}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--rb-text-muted)', margin: 0 }}>
          {format('practiceSourceSubtitle', { title: stageCopy.title })}
        </p>
      </div>

      {/* Segmented control: Mẫu có sẵn vs Quét khối của mình */}
      <div className="rb-seg" role="tablist" aria-label="Nguồn khối luyện tập">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'preset'}
          className="rb-seg__item"
          style={{ minHeight: '40px', height: '40px' }}
          onClick={() => setActiveTab('preset')}
        >
          {format('tabPresetSamples')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'scan'}
          className="rb-seg__item"
          style={{ minHeight: '40px', height: '40px' }}
          onClick={() => setActiveTab('scan')}
        >
          {format('tabScanOwnCube')}
        </button>
      </div>

      {/* Tab: Mẫu có sẵn */}
      {activeTab === 'preset' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="rb-overline" style={{ fontSize: '11px' }}>
            {format('chooseSampleHint')}
          </div>

          {samples.map((sample, idx) => (
            <div
              key={sample.id}
              role="button"
              tabIndex={0}
              aria-label={`${sample.label}: ${sample.desc}`}
              onClick={() => onSelectSample(sample)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  onSelectSample(sample)
                }
              }}
              className="rb-card"
              style={{
                padding: '14px 16px',
                minHeight: '52px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'background var(--rb-t-fast) var(--rb-ease), border-color var(--rb-t-fast) var(--rb-ease)'
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--rb-r-md)',
                  background: idx === 0 ? 'var(--rb-accent-tint)' : 'var(--rb-surface-2)',
                  border: idx === 0 ? '1px solid var(--rb-accent-tint-border)' : '1px solid var(--rb-border)',
                  color: idx === 0 ? 'var(--rb-accent-2)' : 'var(--rb-text)',
                  fontWeight: 700,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {sample.id.toUpperCase()}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--rb-text)', lineHeight: 1.3 }}>
                  {sample.label}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--rb-text-muted)', lineHeight: 1.35, marginTop: '2px' }}>
                  {sample.desc}
                </div>
              </div>

              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--rb-text-subtle)', flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Quét khối của mình */}
      {activeTab === 'scan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '8px 0' }}>
          <div className="rb-card" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '16px', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--rb-r-md)',
                  background: 'var(--rb-accent-tint)',
                  border: '1px solid var(--rb-accent-tint-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--rb-accent-2)'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--rb-text)' }}>
                {format('tabScanOwnCube')}
              </div>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--rb-text-muted)', margin: 0, lineHeight: 1.45 }}>
              {format('scanOwnCubeDesc')}
            </p>
          </div>

          <button
            type="button"
            className="rb-btn rb-btn--primary rb-btn--block"
            onClick={onStartScan}
            style={{ height: '48px', fontSize: '15px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '6px' }}>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            {format('scanToPracticeBtn')}
          </button>
        </div>
      )}
    </div>
  )
}
