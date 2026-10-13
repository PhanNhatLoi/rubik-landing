import React, { useState } from 'react'
import StatsBlock from './StatsBlock'
import ZoomControl from './ZoomControl'
import TabBar from './TabBar'

export default function PlayShell({
  mountRef,
  timeMs,
  moves,
  running,
  statusText,
  size,
  onScramble,
  onReset,
  onZoomIn,
  onZoomOut,
  onOpenSize,
  onChangeSize,
  isDesktop,
  activeTab,
  onSelectTab,
  showSolver,
  onOpenSolver,
  onCloseSolver,
  solverElement,
}) {
  const [showHelp, setShowHelp] = useState(false)

  // ----------------------------------------------------
  // DESKTOP LAYOUT (>= 960px)
  // ----------------------------------------------------
  if (isDesktop) {
    return (
      <div className="rb-app">
        <div className="rb-shell">
          {/* Panel trái (320px) */}
          <aside className="rb-shell__left rb-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ fontSize: 'var(--rb-fs-title-lg)', fontWeight: 600, color: 'var(--rb-text)', letterSpacing: '-0.01em' }}>
                Rubik 3D Playground
              </div>
              <div style={{ fontSize: 'var(--rb-fs-caption)', color: 'var(--rb-text-subtle)', marginTop: '6px', lineHeight: 1.4 }}>
                Kéo nền để xoay góc nhìn · Kéo mặt khối để quay tầng
              </div>
            </div>

            <StatsBlock timeMs={timeMs} moves={moves} running={running} statusText={statusText} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button type="button" className="rb-btn rb-btn--primary" onClick={onScramble}>
                Xáo trộn
              </button>
              <button type="button" className="rb-btn rb-btn--secondary" onClick={onReset}>
                Reset
              </button>
            </div>

            <div>
              <div className="rb-overline" style={{ marginBottom: '8px' }}>Kích thước</div>
              <div className="rb-seg" role="tablist" aria-label="Chọn kích thước">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="tab"
                    className="rb-seg__item"
                    aria-selected={size === n}
                    onClick={() => onChangeSize(n)}
                  >
                    {n}x{n}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
              <ZoomControl onZoomIn={onZoomIn} onZoomOut={onZoomOut} layout="horizontal" />
            </div>
          </aside>

          {/* Sân khấu giữa */}
          <main className="rb-shell__stage">
            <div
              style={{
                width: '100%',
                maxWidth: '560px',
                height: '100%',
                maxHeight: '560px',
                aspectRatio: '1',
                position: 'relative',
              }}
            >
              <div className="canvas-wrap" ref={mountRef} />
            </div>
          </main>

          {/* Panel phải (360px khi đóng / 440px khi mở) */}
          {showSolver ? (
            <aside className="rb-shell__right rb-shell__right--open">
              <div className="rb-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ fontSize: 'var(--rb-fs-title)', fontWeight: 600 }}>Smart Solver</div>
                  <button
                    type="button"
                    className="rb-icon-btn"
                    onClick={onCloseSolver}
                    aria-label="Đóng Smart Solver"
                    style={{ width: '36px', height: '36px' }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  {solverElement}
                </div>
              </div>
            </aside>
          ) : (
            <aside className="rb-shell__right">
              <div className="rb-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
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
                        color: 'var(--rb-accent-2)',
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--rb-fs-title)', fontWeight: 600 }}>Smart Solver</div>
                      <div style={{ fontSize: 'var(--rb-fs-caption)', color: 'var(--rb-text-muted)' }}>Giải khối Rubik</div>
                    </div>
                  </div>
                  <div className="rb-chip">
                    <span className="rb-chip__dot" />
                    <span>Đang tắt</span>
                  </div>
                </div>

                <p style={{ fontSize: 'var(--rb-fs-body)', color: 'var(--rb-text-muted)', lineHeight: 1.5, margin: '0 0 24px' }}>
                  Tự động nhận diện trạng thái Rubik qua webcam hoặc ảnh chụp, tính lời giải tối ưu và hướng dẫn từng bước trực quan.
                </p>

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    className="rb-btn rb-btn--primary rb-btn--block"
                    onClick={onOpenSolver}
                  >
                    Bật Smart Solver
                  </button>
                  <button
                    type="button"
                    className="rb-btn rb-btn--ghost rb-btn--block"
                    onClick={onOpenSolver}
                  >
                    Giải khối 3D đang hiển thị
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    )
  }

  // ----------------------------------------------------
  // MOBILE LAYOUT (< 960px)
  // ----------------------------------------------------
  return (
    <div className="rb-app">
      <div className="rb-screen">
        {/* Help Popover */}
        {showHelp && (
          <div className="rb-scrim" onClick={() => setShowHelp(false)} style={{ zIndex: 100 }}>
            <div
              className="rb-panel"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '64px',
                left: '16px',
                right: '16px',
                maxWidth: '400px',
                margin: '0 auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: 'var(--rb-fs-title)', fontWeight: 600 }}>Hướng dẫn thao tác</div>
                <button
                  type="button"
                  className="rb-icon-btn"
                  onClick={() => setShowHelp(false)}
                  aria-label="Đóng hướng dẫn"
                  style={{ width: '32px', height: '32px' }}
                >
                  ×
                </button>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--rb-text-soft)', fontSize: 'var(--rb-fs-body)', lineHeight: 1.6 }}>
                <li>Kéo nền xung quanh để xoay góc nhìn toàn cảnh.</li>
                <li>Kéo trực tiếp lên mặt Rubik để quay tầng tương ứng.</li>
                <li>Sử dụng nút + / − ở mép phải để thu phóng.</li>
                <li>Bấm <strong>Xáo trộn</strong> để bắt đầu tính giờ và đếm số nước đi.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab "Giải khối" trên mobile */}
        {activeTab === 'solver' ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {solverElement}
            </div>
            <TabBar activeTab={activeTab} onSelectTab={onSelectTab} />
          </div>
        ) : (
          /* Tab "Chơi" trên mobile */
          <>
            {/* Header */}
            <header className="rb-header">
              <div>
                <div className="rb-header__title">Rubik 3D</div>
                <div className="rb-header__subtitle">Playground</div>
              </div>
              <button
                type="button"
                className="rb-icon-btn"
                onClick={() => setShowHelp(true)}
                aria-label="Hướng dẫn thao tác"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </button>
            </header>

            {/* Khối thời gian */}
            <div style={{ padding: '4px 0 8px' }}>
              <StatsBlock timeMs={timeMs} moves={moves} running={running} statusText={statusText} />
            </div>

            {/* Sân khấu 3D với nút zoom bên phải */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
              }}
            >
              <div className="canvas-wrap" ref={mountRef} />
              <ZoomControl onZoomIn={onZoomIn} onZoomOut={onZoomOut} layout="vertical" />
            </div>

            {/* Dòng hint */}
            <div
              style={{
                textAlign: 'center',
                fontSize: 'var(--rb-fs-caption)',
                color: 'var(--rb-text-subtle)',
                padding: '6px 0',
                userSelect: 'none',
              }}
            >
              Kéo nền để xoay góc nhìn · Kéo mặt khối để quay tầng
            </div>

            {/* Hàng hành động */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                padding: '4px 0 10px',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                className="rb-btn rb-btn--secondary"
                style={{ padding: '0 14px' }}
                onClick={onOpenSize}
                aria-label={`Kích thước ${size}x${size}, nhấn để đổi`}
              >
                {size}x{size} <span style={{ fontSize: '10px', marginLeft: '4px' }}>▾</span>
              </button>

              <button
                type="button"
                className="rb-icon-btn rb-icon-btn--square"
                onClick={onReset}
                aria-label="Đặt lại khối"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>

              <button
                type="button"
                className="rb-btn rb-btn--primary"
                style={{ flex: 1 }}
                onClick={onScramble}
              >
                Xáo trộn
              </button>
            </div>

            {/* Thanh Tab bar */}
            <TabBar activeTab={activeTab} onSelectTab={onSelectTab} />
          </>
        )}
      </div>
    </div>
  )
}
