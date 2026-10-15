import { describe, expect, it } from 'vitest'
import { SOLVED } from '../smart-solver/core/cubie'
import { toFacelets } from '../smart-solver/core/facelets'
import { FACES } from '../smart-solver/core/types'
import { getEngine } from '../smart-solver/nxn/engine'
import { layerTurnToToken, sceneToStickers } from '../smart-solver/adapter/nxnModel'
import { applyNotation, fromCubie, toCubie, notationToTurn, type Physical } from '../learn/guide/physical'
import { formatSceneFormulaLog, readFormulaSnapshot, type FormulaSnapshot, type RecordedFormulaTurn } from './formulaRecording'

const snapshot = (p: Physical): FormulaSnapshot => ({
  stickers: Array.from(sceneToStickers(p, 3, (face) => FACES.indexOf(face))),
  facelets: toFacelets(toCubie(p)!)
})

describe('playground formula recorder', () => {
  it('replays fixed-layer turns from an arbitrary start, even after the centers have moved', () => {
    let physical = applyNotation(fromCubie(SOLVED), 'M')
    const start = snapshot(physical)
    const steps: RecordedFormulaTurn[] = []
    for (const notation of ['U', 'M2', "S'", 'R']) {
      physical = applyNotation(physical, notation)
      steps.push({ token: layerTurnToToken(notationToTurn(notation), 3)!, after: snapshot(physical) })
    }
    const log = JSON.parse(formatSceneFormulaLog(start, steps))
    expect(log.algorithm).toBe("U M2 S' R")
    expect(log.start.stickers).toEqual(start.stickers)
    expect(log.steps).toHaveLength(4)
    const replayed = getEngine(3).applyAll(Uint8Array.from(log.start.stickers), log.steps.map((s: { fixedToken: string }) => s.fixedToken))
    expect(Array.from(replayed)).toEqual(log.end.stickers)
    expect(log.steps.at(-1).after).toEqual(log.end)
    expect(log.end.facelets).toBe(snapshot(physical).facelets)
  })

  it('exports an empty recording and owns its snapshots independently of controller arrays', () => {
    const stickers = getEngine(3).solved()
    const captured = readFormulaSnapshot({ getStickers: () => stickers, getFacelets: () => toFacelets(SOLVED) })
    const before = captured.stickers.slice()
    stickers.fill(5)
    expect(captured.stickers).toEqual(before)
    const log = JSON.parse(formatSceneFormulaLog(captured, []))
    expect(log.algorithm).toBe('')
    expect(log.steps).toEqual([])
    expect(log.end).toEqual(log.start)
    expect(log.end.topCrossDone).toBe(true)
  })
})
