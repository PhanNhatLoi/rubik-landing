import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { NxnController } from '../adapter/types'
import { expectedTurn, initialNxnGuide, nxnGuideReducer, remainingParts } from '../guidance/nxnGuide'
import type { CubeSize } from '../nxn/engine'
import { NxnSolveError, type NxnSolverClient } from '../nxn/NxnSolverClient'
import { toCubeState } from '../nxn/state'

/** Retries `apply` while the 3D cube is busy turning (it returns false). */
function retryWhileBusy(apply: () => boolean): () => void {
  let tries = 0
  let timer = 0
  const run = () => {
    if (!apply() && tries++ < 10) timer = window.setTimeout(run, 300)
  }
  run()
  return () => window.clearTimeout(timer)
}

/**
 * Guidance for the sizes solved through the n×n library (2x2, 4x4, 5x5): solver worker,
 * 3D cube kept in sync with the state, highlighted next turn, dragged turns as input.
 */
export function useNxnGuide(
  size: number,
  enabled: boolean,
  getController: () => NxnController | null,
  sceneVersion: number,
  solver: NxnSolverClient | null
) {
  const [guide, dispatch] = useReducer(nxnGuideReducer, size, initialNxnGuide)
  const guideRef = useRef(guide)
  guideRef.current = guide

  useEffect(() => {
    if (guideRef.current.size !== size) dispatch({ type: 'RESET', size })
  }, [size])

  const reviewing = guide.phase === 'REVIEWING'
  // A rebuilt scene starts solved: put the cube we are tracking back on it.
  useEffect(() => {
    const { stickers, phase, size: n } = guideRef.current
    if (!enabled || !stickers || phase === 'SCANNING' || n !== getController()?.size) return
    return retryWhileBusy(() => getController()?.setStickers(stickers) ?? true)
  }, [enabled, sceneVersion, getController, reviewing])

  useEffect(() => {
    if (!enabled || guide.phase !== 'SOLVING' || !guide.stickers || !solver) return
    const { epoch, stickers, size: n } = guide
    solver
      .solve(n as CubeSize, toCubeState(stickers, n as CubeSize), { mode: 'beginner', timeoutMs: 60000 })
      .then((result) => dispatch({ type: 'SOLVED', epoch, result }))
      .catch((e: unknown) => {
        if (e instanceof Error && e.message === 'solver disposed') return
        const kind = e instanceof NxnSolveError ? e.kind : 'failed'
        dispatch({ type: 'SOLVE_FAILED', epoch, kind, message: e instanceof Error ? e.message : String(e) })
      })
  }, [enabled, guide.phase, guide.epoch, solver])

  const expected = expectedTurn(guide)
  const nextPart = expected ? (remainingParts(expected, guide.partial, guide.size)[0] ?? null) : null
  useEffect(() => {
    if (!enabled) return
    // Once a step is started layer by layer (or one quarter of a half turn), show what is left.
    getController()?.highlightTurn(guide.partial.length ? nextPart : expected)
    return () => getController()?.highlightTurn(null)
  }, [enabled, expected, nextPart, guide.partial.length, getController, sceneVersion])

  useEffect(() => {
    const controller = getController()
    if (!enabled || !controller) return
    return controller.onUserTurn((token) => dispatch({ type: 'TURNED', token }))
  }, [enabled, getController, sceneVersion])

  /** Reads the 3D cube as the cube to solve (instead of scanning). */
  const takeScene = useCallback(() => {
    const controller = getController()
    const stickers = controller?.getStickers()
    // Writing it back is refused while a turn (or a scramble) is still animating.
    if (!controller || !stickers || stickers.includes(255) || !controller.setStickers(stickers)) return false
    dispatch({ type: 'SCANNED', stickers })
    return true
  }, [getController])

  const confirmReview = useCallback(() => {
    // Drags while reviewing may have turned layers on the 3D cube: restore the state.
    const { stickers } = guideRef.current
    if (stickers) getController()?.setStickers(stickers)
    dispatch({ type: 'CONFIRM_REVIEW' })
  }, [getController])

  /** "Done": the rest of the current step, turned on the 3D cube too. */
  const done = useCallback(() => {
    const g = guideRef.current
    const step = expectedTurn(g)
    if (!step) return
    for (const token of remainingParts(step, g.partial, g.size)) {
      dispatch({ type: 'TURNED', token })
      getController()?.playTurn(token).catch(() => {})
    }
  }, [getController])

  return { guide, dispatch, expected, nextPart, takeScene, confirmReview, done }
}
