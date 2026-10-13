import { useState, useLayoutEffect, useEffect, useCallback } from 'react'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Creates a persistent DOM host element that survives React re-renders and layout shifts.
 * Returns the stable host element and a slotRef callback to attach it to the current slot element.
 */
export function usePersistentHost(className?: string): {
  host: HTMLDivElement
  slotRef: (slot: HTMLElement | null) => void
} {
  const [host] = useState<HTMLDivElement>(() => {
    if (typeof document === 'undefined') {
      return null as unknown as HTMLDivElement
    }
    const el = document.createElement('div')
    if (className) el.className = className
    el.style.width = '100%'
    el.style.height = '100%'
    return el
  })

  const [currentSlot, setCurrentSlot] = useState<HTMLElement | null>(null)

  const slotRef = useCallback((slot: HTMLElement | null) => {
    setCurrentSlot(slot)
  }, [])

  useIsomorphicLayoutEffect(() => {
    if (currentSlot && host) {
      if (host.parentElement !== currentSlot) {
        currentSlot.appendChild(host)
      }
    }
  }, [currentSlot, host])

  return { host, slotRef }
}
