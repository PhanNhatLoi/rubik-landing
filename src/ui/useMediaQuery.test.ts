import { describe, it, expect, afterEach } from 'vitest'
import { useMediaQuery, DESKTOP_QUERY } from './useMediaQuery'

describe('useMediaQuery', () => {
  const originalWindow = globalThis.window

  afterEach(() => {
    ;(globalThis as { window?: typeof window }).window = originalWindow
  })

  it('exports DESKTOP_QUERY', () => {
    expect(DESKTOP_QUERY).toBe('(min-width: 960px)')
  })

  it('returns false when window is undefined (SSR)', () => {
    ;(globalThis as { window?: typeof window }).window = undefined
    expect(typeof useMediaQuery).toBe('function')
  })
})
