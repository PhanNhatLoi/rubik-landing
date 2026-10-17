import React, { useState } from 'react'
import StatsBlock from './StatsBlock'
import ZoomControl from './ZoomControl'
import TabBar from './TabBar'
import MenuList, { SECTION_TITLES } from './MenuList'

export default function PlayShell({
  stageSlotRef,
  solverSlotRef,
  solverPhase,
  solverCollapsed,
  stageHidden,
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
  section,
  onOpenSection,
  onCloseSection,
  sizeTriggerRef,
  recorderSlot,
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

            {recorderSlot}

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
              <div className="rb-stage-slot" ref={stageSlotRef} />
            </div>
          </main>

          {/* Panel phải (360px khi đóng / 440px khi mở) */}
          {section ? (
            <aside className="rb-shell__right rb-shell__right--open">
              <div className="rb-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ fontSize: 'var(--rb-fs-title)', fontWeight: 600 }}>{SECTION_TITLES[section]}</div>
                  <button
                    type="button"
                    className="rb-btn rb-btn--ghost"
                    style={{ height: '36px', padding: '0 12px' }}
                    onClick={onCloseSection}
                  >
                    ‹ Menu
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  <div className="rb-solver-slot" ref={solverSlotRef} />
                </div>
              </div>
            </aside>
          ) : (
            <aside className="rb-shell__right">
              <div className="rb-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
                <div style={{ fontSize: 'var(--rb-fs-title)', fontWeight: 600, marginBottom: '14px' }}>Menu</div>
                <MenuList onOpenSection={onOpenSection} />
              </div>
              <div hidden style={{ display: 'none' }}>
                <div className="rb-solver-slot" ref={solverSlotRef} />
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
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
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

        {/* Tab "Menu" trên mobile */}
        {activeTab === 'menu' && !section ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <header className="rb-header" style={{ flex: 'none' }}>
              <div>
                <div className="rb-header__title">Menu</div>
                <div className="rb-header__subtitle">Học, quét và giải Rubik</div>
              </div>
            </header>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingTop: '8px' }}>
              <MenuList onOpenSection={onOpenSection} />
              <div hidden style={{ display: 'none' }}>
                <div className="rb-solver-slot" ref={solverSlotRef} />
              </div>
            </div>
            <TabBar activeTab={activeTab} onSelectTab={onSelectTab} />
          </div>
        ) : activeTab === 'menu' ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <header className="rb-header" style={{ flex: 'none' }}>
              <div>
                <div className="rb-header__title">{SECTION_TITLES[section]}</div>
                <div className="rb-header__subtitle">Menu</div>
              </div>
              <button type="button" className="rb-btn rb-btn--ghost" style={{ height: '36px', padding: '0 12px' }} onClick={onCloseSection}>
                ‹ Menu
              </button>
            </header>

            {/* Sân khấu 3D cho solver: ẩn khi quét để nhường chỗ cho camera, hiện khi review và guide.
                Khi thu gọn panel (camera đã tắt) khối 3D chiếm phần còn lại của màn hình. */}
            <div
              style={{
                display: stageHidden || (solverPhase === 'SCANNING' && !solverCollapsed) ? 'none' : 'flex',
                flex: solverCollapsed ? '1 1 0' : '0 0 38%',
                minHeight: '180px',
                maxHeight: solverCollapsed ? 'none' : '280px',
                width: '100%',
                position: 'relative',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div className="rb-stage-slot" ref={stageSlotRef} />
            </div>

            <div style={{ flex: solverCollapsed ? '0 0 auto' : 1, minHeight: 0, overflowY: 'auto' }}>
              <div className="rb-solver-slot" ref={solverSlotRef} />
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
            <div className="rb-stats-block">
              <StatsBlock timeMs={timeMs} moves={moves} running={running} statusText={statusText} />
            </div>

            {/* Sân khấu 3D với nút zoom bên phải */}
            <div className="rb-screen__stage">
              <div className="rb-stage-slot" ref={stageSlotRef} />
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
                ref={sizeTriggerRef}
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

            <div style={{ flexShrink: 0, paddingBottom: '8px', maxHeight: '30dvh', overflowY: 'auto' }}>{recorderSlot}</div>

            {/* Thanh Tab bar */}
            <TabBar activeTab={activeTab} onSelectTab={onSelectTab} />

            {/* Giữ slot solver ẩn để không mất state */}
            <div hidden style={{ display: 'none' }}>
              <div className="rb-solver-slot" ref={solverSlotRef} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
