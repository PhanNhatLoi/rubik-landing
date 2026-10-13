import React from 'react'

export function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const centis = Math.floor((ms % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`
}

export default function StatsBlock({ timeMs, moves, running, statusText }) {
  return (
    <div className="rb-stats-block">
      <div className="rb-overline">Thời gian</div>
      <div
        className="rb-num"
        style={{
          fontSize: 'var(--rb-fs-display)',
          fontWeight: 'var(--rb-fw-display)',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          margin: '2px 0 8px',
        }}
      >
        {formatTime(timeMs)}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="rb-chip">
          <span>{moves} nước đi</span>
        </div>
        <div className={`rb-chip${running ? ' rb-chip--run' : ''}`}>
          <span className="rb-chip__dot" />
          <span>{statusText}</span>
        </div>
      </div>
    </div>
  )
}
