import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface LessonPage {
  id: string
  /** Name of the part this page belongs to (pages sharing a section are shown as one part). */
  section: string
  title: string
}

export interface LessonPlayerProps<P extends LessonPage> {
  /** Shown above the title, e.g. "Bước học 1". */
  label: string
  pages: readonly P[]
  /** Runs when a page opens, e.g. to point at pieces on the 3D cube. */
  onEnter?: (page: P) => void
  /** Runs on skip, finish and unmount: undo whatever onEnter put on the 3D cube. */
  onLeave?: () => void
  /** Skip or finish. */
  onExit: () => void
  /** Optional "Thực hành" toggle: the 3D cube is only shown while practicing. */
  practiceFor?: (page: P) => { active: boolean; onToggle: () => void } | undefined
  renderPage: (page: P) => ReactNode
}

/** Step-by-step lesson: one small idea per page, always skippable. */
export default function LessonPlayer<P extends LessonPage>({
  label,
  pages,
  onEnter,
  onLeave,
  onExit,
  practiceFor,
  renderPage
}: LessonPlayerProps<P>) {
  const [index, setIndex] = useState(0)
  const page = pages[index]!
  const isFirst = index === 0
  const isLast = index === pages.length - 1
  const practice = practiceFor?.(page)

  const onEnterRef = useRef(onEnter)
  onEnterRef.current = onEnter
  const onLeaveRef = useRef(onLeave)
  onLeaveRef.current = onLeave

  useEffect(() => {
    onEnterRef.current?.(page)
  }, [page])
  useEffect(() => () => onLeaveRef.current?.(), [])

  const sections = Array.from(new Set(pages.map((p) => p.section)))
  const sectionNo = sections.indexOf(page.section) + 1

  return (
    <div
      className="rb-learn-lesson"
      style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0 0', minHeight: 'calc(100dvh - 280px)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rb-overline" style={{ fontSize: '11px', color: 'var(--rb-accent-link)' }}>
            {label} · Phần {sectionNo}/{sections.length} · {page.section}
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--rb-text)', margin: '2px 0 0', lineHeight: 1.25 }}>
            {page.title}
          </h2>
        </div>
        <button type="button" className="rb-btn rb-btn--link" onClick={onExit} style={{ minHeight: '44px', flexShrink: 0 }}>
          Bỏ qua
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px' }} role="progressbar" aria-valuemin={1} aria-valuemax={pages.length} aria-valuenow={index + 1}>
        {pages.map((p, i) => (
          <div
            key={p.id}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              background: i <= index ? 'var(--rb-accent-link)' : 'var(--rb-border-strong)'
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>{renderPage(page)}</div>

      {/* Stays at the bottom of the scrolling area so the buttons don't jump between pages. */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          display: 'flex',
          gap: '10px',
          padding: '10px 0 12px',
          background: 'var(--rb-bg-1)',
          borderTop: '1px solid var(--rb-border)',
          zIndex: 1
        }}
      >
        <button
          type="button"
          className="rb-btn rb-btn--ghost"
          style={{ flex: 1, height: '48px', visibility: isFirst ? 'hidden' : 'visible' }}
          disabled={isFirst}
          onClick={() => setIndex(index - 1)}
        >
          Quay lại
        </button>
        {practice && (
          <button
            type="button"
            className="rb-btn rb-btn--secondary"
            style={{ flex: 1, height: '48px' }}
            aria-pressed={practice.active}
            onClick={practice.onToggle}
          >
            {practice.active ? 'Ẩn khối 3D' : 'Thực hành'}
          </button>
        )}
        <button
          type="button"
          className="rb-btn rb-btn--primary"
          style={{ flex: 1, height: '48px' }}
          onClick={() => (isLast ? onExit() : setIndex(index + 1))}
        >
          {isLast ? 'Hoàn tất' : 'Tiếp theo'}
        </button>
      </div>
    </div>
  )
}
