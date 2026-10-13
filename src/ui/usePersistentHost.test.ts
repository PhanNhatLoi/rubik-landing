import { describe, it, expect } from 'vitest'
import { usePersistentHost } from './usePersistentHost'

describe('usePersistentHost', () => {
  it('is a function', () => {
    expect(typeof usePersistentHost).toBe('function')
  })
})
