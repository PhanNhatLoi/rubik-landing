import { describe, expect, it } from 'vitest'
import { AutoCapture } from './autoCapture'

describe('AutoCapture', () => {
  it('counts 3, 2, 1 while the face stays in view, then fires once', () => {
    const a = new AutoCapture()
    expect(a.update(0, true)).toBe(false)
    expect(a.secondsLeft(0)).toBe(3)
    expect(a.update(1500, true)).toBe(false)
    expect(a.secondsLeft(1500)).toBe(2)
    expect(a.secondsLeft(2500)).toBe(1)
    expect(a.update(3000, true)).toBe(true)
    expect(a.update(3100, true)).toBe(false)
    expect(a.phase).toBe('busy')
  })

  it('tolerates brief losses but restarts after a real one', () => {
    const a = new AutoCapture()
    a.update(0, true)
    a.update(500, false)
    expect(a.phase).toBe('counting')
    a.update(1500, false)
    expect(a.phase).toBe('idle')
    a.update(1600, true)
    expect(a.update(4500, true)).toBe(false)
    expect(a.update(4600, true)).toBe(true)
  })

  it('waits for the cooldown after a capture', () => {
    const a = new AutoCapture()
    a.update(0, true)
    a.update(3000, true)
    a.finish(3200)
    expect(a.update(4000, true)).toBe(false)
    expect(a.phase).toBe('cooldown')
    a.update(4800, true)
    expect(a.phase).toBe('counting')
  })
})
