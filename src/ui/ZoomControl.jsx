import React from 'react'

export default function ZoomControl({ onZoomIn, onZoomOut, layout = 'vertical' }) {
  if (layout === 'horizontal') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span style={{ fontSize: 'var(--rb-fs-caption)', color: 'var(--rb-text-subtle)' }}>Thu phóng</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="rb-icon-btn rb-icon-btn--square"
            onClick={onZoomIn}
            aria-label="Phóng to"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            type="button"
            className="rb-icon-btn rb-icon-btn--square"
            onClick={onZoomOut}
            aria-label="Thu nhỏ"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: '16px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 10,
      }}
    >
      <button
        type="button"
        className="rb-icon-btn rb-icon-btn--square"
        onClick={onZoomIn}
        aria-label="Phóng to"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button
        type="button"
        className="rb-icon-btn rb-icon-btn--square"
        onClick={onZoomOut}
        aria-label="Thu nhỏ"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  )
}
