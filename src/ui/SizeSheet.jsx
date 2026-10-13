import React, { useEffect, useRef, useState } from 'react'

const SIZE_CONFIGS = [
  { size: 2, label: '2x2', caption: 'Mini · làm quen' },
  { size: 3, label: '3x3', caption: 'Tiêu chuẩn' },
  { size: 4, label: '4x4', caption: 'Nâng cao' },
  { size: 5, label: '5x5', caption: 'Chuyên gia' },
]

function MiniCubeGrid({ size }) {
  const cellSize = size === 2 ? 14 : size === 3 ? 10 : size === 4 ? 7.5 : 6
  const gap = size === 2 ? 2.5 : size === 3 ? 2 : size === 4 ? 1.5 : 1

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${size}, ${cellSize}px)`,
        gap: `${gap}px`,
        width: 'fit-content',
      }}
      aria-hidden="true"
    >
      {Array.from({ length: size * size }).map((_, i) => (
        <div
          key={i}
          className="rb-mini-cube-cell"
          style={{
            width: `${cellSize}px`,
            height: `${cellSize}px`,
          }}
        />
      ))}
    </div>
  )
}

export default function SizeSheet({ isOpen, currentSize, onSelect, onClose, triggerRef }) {
  const [pickedSize, setPickedSize] = useState(currentSize)
  const sheetRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Sync pickedSize whenever currentSize or isOpen changes
  useEffect(() => {
    if (isOpen) {
      setPickedSize(currentSize)
    }
  }, [isOpen, currentSize])

  // Trap Escape key & manage focus with basic trap
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current?.()
        return
      }

      if (e.key === 'Tab' && sheetRef.current) {
        const focusable = sheetRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first || document.activeElement === sheetRef.current) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    // Focus close button or first interactive element inside sheet
    const timer = setTimeout(() => {
      sheetRef.current?.focus()
    }, 50)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(timer)
      // Return focus to trigger button
      triggerRef?.current?.focus()
    }
  }, [isOpen, triggerRef])

  if (!isOpen) return null

  const handleConfirm = () => {
    onSelect(pickedSize)
    onClose()
  }

  return (
    <div className="rb-sheet-container" role="presentation">
      {/* Scrim backdrop */}
      <div className="rb-scrim" onClick={onClose} aria-hidden="true" />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-label="Chọn kích thước khối"
        aria-modal="true"
        tabIndex={-1}
        className="rb-sheet"
        style={{ position: 'relative', zIndex: 1, outline: 'none' }}
      >
        <div className="rb-sheet__grab" />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: 'var(--rb-fs-title-lg)', fontWeight: 600, color: 'var(--rb-text)' }}>
              Chọn kích thước
            </div>
            <div style={{ fontSize: 'var(--rb-fs-caption)', color: 'var(--rb-text-muted)', marginTop: '4px' }}>
              Đổi kích thước sẽ reset khối và đồng hồ
            </div>
          </div>
          <button
            type="button"
            className="rb-icon-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 2x2 grid of cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          {SIZE_CONFIGS.map(({ size, label, caption }) => {
            const isSelected = pickedSize === size
            return (
              <button
                key={size}
                type="button"
                className="rb-size-card"
                aria-pressed={isSelected}
                onClick={() => setPickedSize(size)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <MiniCubeGrid size={size} />
                  <span style={{ fontSize: '18px', fontWeight: 700 }}>{label}</span>
                </div>
                <div
                  style={{
                    fontSize: 'var(--rb-fs-caption)',
                    fontWeight: 500,
                    opacity: isSelected ? 0.95 : 0.75,
                  }}
                >
                  {caption}
                </div>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="rb-btn rb-btn--primary rb-btn--block"
          onClick={handleConfirm}
        >
          Chọn {pickedSize}×{pickedSize}
        </button>
      </div>
    </div>
  )
}
