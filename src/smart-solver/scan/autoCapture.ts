export type AutoCapturePhase = 'idle' | 'counting' | 'busy' | 'cooldown'

export interface AutoCaptureOptions {
  countdownMs: number
  /** A lost frame or two during the countdown is tolerated for this long. */
  graceMs: number
  /** Pause after a capture attempt before counting again. */
  cooldownMs: number
}

const DEFAULTS: AutoCaptureOptions = { countdownMs: 3000, graceMs: 700, cooldownMs: 1500 }

/**
 * Webcam shutter: counts down while a cube face is in view, then asks for a still photo.
 * Pure timing logic, fed once per video frame.
 */
export class AutoCapture {
  phase: AutoCapturePhase = 'idle'
  private readonly opts: AutoCaptureOptions
  private start = 0
  private lastReady = 0
  private until = 0

  constructor(options: Partial<AutoCaptureOptions> = {}) {
    this.opts = { ...DEFAULTS, ...options }
  }

  /** Returns true exactly once per countdown, when the still should be taken. */
  update(now: number, ready: boolean): boolean {
    if (this.phase === 'busy') return false
    if (this.phase === 'cooldown') {
      if (now < this.until) return false
      this.phase = 'idle'
    }
    if (ready) this.lastReady = now
    if (this.phase === 'idle') {
      if (ready) {
        this.phase = 'counting'
        this.start = now
      }
      return false
    }
    if (!ready && now - this.lastReady > this.opts.graceMs) {
      this.phase = 'idle'
      return false
    }
    if (now - this.start >= this.opts.countdownMs) {
      this.phase = 'busy'
      return true
    }
    return false
  }

  /** Whole seconds left to show (3, 2, 1), or null when not counting. */
  secondsLeft(now: number): number | null {
    if (this.phase !== 'counting') return null
    return Math.max(1, Math.ceil((this.opts.countdownMs - (now - this.start)) / 1000))
  }

  /** Call when the still has been analysed (captured or not). */
  finish(now: number) {
    this.phase = 'cooldown'
    this.until = now + this.opts.cooldownMs
  }

  reset() {
    this.phase = 'idle'
  }
}
