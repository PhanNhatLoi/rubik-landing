import type { Face, Facelets, Move, ValidationError } from '../core/types'
import type { TurnEvent } from './stickerModel'

export type SetFaceletsResult =
  | { ok: true }
  | { ok: false; reason: 'busy' }
  | { ok: false; reason: 'invalid'; errors: ValidationError[] }

/**
 * Control surface of the 3D cube in App.jsx for every size, in the scene frame (U = +y,
 * R = +x, F = +z). Stickers are labels 0..5 in URFDLB order of the current face colors;
 * turns are n×n engine tokens (R, 2R, Rw, 3Rw...).
 */
export interface NxnController {
  size: number
  getStickers(): Uint8Array
  /** Replaces the whole cube state without animation. Returns false while a turn is animating. */
  setStickers(stickers: Uint8Array): boolean
  playTurn(token: string): Promise<void>
  /** Lights up the layers that `token` turns, with direction arrows (null clears). */
  highlightTurn(token: string | null): void
  /** Fires after each turn made by dragging, as a single-layer token. Returns an unsubscribe function. */
  onUserTurn(listener: (token: string) => void): () => void
  /**
   * Repaints the cube with these face colors (0xRRGGBB per face), keeping its state.
   * Returns false while a turn is animating.
   */
  setFaceColors(colors: Record<Face, number>): boolean
}

/** What the tutorial points at on the 3D cube: a kind of piece, or every piece on a face (relative to the centers). */
export type SpotlightTarget = { kind: 'centers' | 'edges' | 'corners' } | { kind: 'face'; face: Face }

/** The 3x3 extras, relative to the centers (the cube may be held any way round). */
export interface CubeController extends NxnController {
  getFacelets(): Facelets
  /** Replaces the whole cube state without animation. Refused while a turn is animating. */
  setFacelets(facelets: Facelets): SetFaceletsResult
  /** Animates one face turn (relative to the centers); rejects if the scene is torn down before it finishes. */
  playMove(move: Move): Promise<void>
  /**
   * Lights up the layer that `move` turns and shows direction arrows around it (null clears both);
   * follows the layer as the cube changes.
   */
  highlight(move: Move | null): void
  /**
   * Makes the pieces of `target` glow in their own colors (null clears). Replaces any `highlight`
   * and is replaced by the next one.
   */
  spotlight(target: SpotlightTarget | null): void
  /**
   * Makes the pieces now at these grid cells ([x, y, z], each 0..2, standard orientation) glow in their
   * own colors (null clears). Unlike `spotlight` it stays while `highlight` changes, so a lesson can
   * point at the pieces to place and at the turn to make at once. Re-apply after the cube changes.
   */
  mark(cells: number[][] | null): void
  /**
   * Fires after each turn made by dragging, with moves relative to the centers
   * (a slice like E is reported as notation 'E', moves ['U', "D'"]). Returns an unsubscribe function.
   */
  onUserMove(listener: (event: TurnEvent) => void): () => void
}
