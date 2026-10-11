import type { Face, Facelets, Move, ValidationError } from '../core/types'
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
  /**
   * Repaints the cube with these center colors (0xRRGGBB per face), keeping its state.
   * Returns false while a turn is animating.
   */
  setFaceColors(colors: Record<Face, number>): boolean
  /**
   * Lights up the layer that `move` turns and shows direction arrows around it (null clears both);
   * follows the layer as the cube changes.
   */
  highlight(move: Move | null): void
  /**
   * Fires after each turn made by dragging, with moves relative to the centers
   * (a slice like E is reported as notation 'E', moves ['U', "D'"]). Returns an unsubscribe function.
   */
  onUserMove(listener: (event: TurnEvent) => void): () => void
}
