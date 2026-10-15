import { equals } from '../../smart-solver/core/cubie'
import type { CubieState } from '../../smart-solver/core/types'

export type GuidePosition = { kind: 'done' } | { kind: 'step'; index: number; quarterDone: boolean } | { kind: 'off' }

/**
 * Where the cube is on a guide's path. Any state of the path counts — a later step, or an earlier one
 * after an undo — so a wrong turn only pauses the guide until it is undone.
 */
export function locateOnGuide(
  guide: { steps: readonly unknown[]; states: readonly CubieState[]; halves: readonly (readonly CubieState[])[] },
  cube: CubieState
): GuidePosition {
  const at = guide.states.findIndex((s) => equals(s, cube))
  if (at === guide.steps.length) return { kind: 'done' }
  if (at >= 0) return { kind: 'step', index: at, quarterDone: false }
  // Only a quarter of a half-turn step so far: progress, not a mistake.
  const half = guide.halves.findIndex((h) => h.some((x) => equals(x, cube)))
  if (half >= 0) return { kind: 'step', index: half, quarterDone: true }
  return { kind: 'off' }
}
