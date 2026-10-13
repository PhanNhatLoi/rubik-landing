import { useSyncExternalStore } from 'react'

export const DESKTOP_QUERY = '(min-width: 960px)'

/**
 * Responsive media query hook.
 * Safe for SSR and React 18 concurrent features (uses useSyncExternalStore).
 */
export function useMediaQuery(query: string = DESKTOP_QUERY): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) {
        return () => {}
      }
      const media = window.matchMedia(query)
      media.addEventListener('change', onStoreChange)
      return () => {
        media.removeEventListener('change', onStoreChange)
      }
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false
  )
}
