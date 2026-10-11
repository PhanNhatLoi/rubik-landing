import type { Facelets, Move, ValidationError } from '../core/types'
import type { TurnEvent } from './stickerModel'

export type SetFaceletsResult =
  | { ok: true }
  | { ok: false; reason: 'busy' }
  | { ok: false; reason: 'invalid'; errors: ValidationError[] }

/** Control surface of the 3D cube in App.jsx. Only available for the 3x3 size. */
export interface CubeController {
  getFacelets(): Facelets
  /** Replaces the whole cube state without animation. Refused while a turn is animating. */
  setFacelets(facelets: Facelets): SetFaceletsResult
  /** Animates one face turn (relative to the centers); rejects if the scene is torn down before it finishes. */
  playMove(move: Move): Promise<void>
  /** Lights up the layer that `move` turns (null clears it); follows the layer as the cube changes. */
  highlight(move: Move | null): void
  /**
   * Fires after each turn made by dragging, with moves relative to the centers
   * (a slice like E is reported as notation 'E', moves ['U', "D'"]). Returns an unsubscribe function.
   */
  onUserMove(listener: (event: TurnEvent) => void): () => void
}
