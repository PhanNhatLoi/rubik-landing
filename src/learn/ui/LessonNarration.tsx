import { Children, cloneElement, createContext, Fragment, isValidElement, useContext, useEffect, useState, type ReactElement, type ReactNode } from 'react'

export const TYPE_MS = 9
const NarrationTime = createContext(Infinity)
const SkipNarration = createContext<() => void>(() => {})
export const useNarrationTime = () => useContext(NarrationTime)
export const typingDuration = (text: string) => Array.from(text).length * TYPE_MS

/** Reserve the finished text's layout and expose one complete phrase to assistive technology. */
export function TypedText({ text, start = 0 }: { text: string; start?: number }) {
  const time = useNarrationTime()
  if (time === Infinity || typeof window === 'undefined') return <>{text}</>
  const chars = Array.from(text)
  const count = Math.max(0, Math.min(chars.length, Math.floor((time - start) / TYPE_MS)))
  return <span aria-label={text}><span aria-hidden="true">{chars.slice(0, count).join('')}<span style={{ visibility: 'hidden' }}>{chars.slice(count).join('')}</span></span></span>
}

/** A scene reserves time in the surrounding text sequence and receives its local clock. */
export function NarrationScene({ children, start = 0 }: { children: ReactNode; duration: number; start?: number }) {
  const time = useNarrationTime()
  return <NarrationTime.Provider value={time === Infinity ? Infinity : time - start}>{children}</NarrationTime.Provider>
}

export function narrateContent(content: ReactNode, cursor = { time: 0 }, typing = false): ReactNode {
  return Children.map(content, (child) => {
    if (typeof child === 'string' && child.trim()) {
      if (!typing) return child
      const start = cursor.time
      cursor.time += typingDuration(child)
      return <TypedText text={child} start={start} />
    }
    if (!isValidElement(child)) return child
    const element = child as ReactElement<{ children?: ReactNode; duration?: number; start?: number; role?: string; className?: string; 'data-no-typing'?: boolean; 'data-typing'?: boolean }>
    if (element.type === NarrationScene) {
      const start = cursor.time
      cursor.time += element.props.duration ?? 0
      return cloneElement(element, { start })
    }
    // Only teaching paragraphs (or explicitly marked prose) opt into typing.
    if (element.props['data-no-typing'] || element.props.className?.split(/\s+/).includes('rb-overline') || ['button', 'select', 'input', 'svg', 'details', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(String(element.type)) || ['note', 'status', 'tablist', 'group'].includes(element.props.role ?? '')) return child
    if (typeof element.type !== 'string' && element.type !== Fragment) return child
    return cloneElement(element, {}, narrateContent(element.props.children, cursor, typing || element.type === 'p' || !!element.props['data-typing']))
  })
}

function NarrationClock({ animate, duration, children }: { animate: boolean; duration: number; children: ReactNode }) {
  const [time, setTime] = useState(0)
  const [skip, setSkip] = useState(false)
  useEffect(() => {
    if (!animate) { setSkip(true); return }
    if (skip) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setSkip(true); return }
    const start = performance.now()
    const timer = window.setInterval(() => setTime(performance.now() - start), 32)
    return () => window.clearInterval(timer)
  }, [animate, skip])
  useEffect(() => { if (time >= duration) setSkip(true) }, [time, duration])
  return <SkipNarration.Provider value={() => setSkip(true)}><NarrationTime.Provider value={!animate || skip ? Infinity : time}>
    {children}
  </NarrationTime.Provider></SkipNarration.Provider>
}

const visited = new Set<string>()
export default function LessonNarration({ visitKey, enabled, children }: { visitKey: string; enabled: boolean; children: ReactNode }) {
  const [firstVisit] = useState(() => !visited.has(visitKey))
  useEffect(() => { visited.add(visitKey) }, [visitKey])
  const cursor = { time: 0 }
  const content = narrateContent(children, cursor)
  return <NarrationClock animate={enabled && firstVisit} duration={cursor.time}>{content}</NarrationClock>
}

export function NarrationSkip() {
  const time = useNarrationTime()
  const skip = useContext(SkipNarration)
  return <button type="button" className="rb-btn rb-btn--link" style={{ minHeight: '28px', fontSize: '12px', visibility: time === Infinity ? 'hidden' : 'visible' }} disabled={time === Infinity} onClick={skip}>Hiện ngay</button>
}
