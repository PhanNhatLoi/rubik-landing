import { describe, expect, it } from 'vitest'
import { applyMoves, SOLVED } from '../../smart-solver/core/cubie'
import { toFacelets } from '../../smart-solver/core/facelets'
import { layerTurnToToken } from '../../smart-solver/adapter/nxnModel'
import { layerTurnToEvent, readOrientation } from '../../smart-solver/adapter/stickerModel'
import { generateTopCrossScramble } from '../copy/lesson5'
import { buildTopCrossGuide, TOP_CROSS_L_ALG } from './topCrossGuide'
import { applyNotation, fromCubie, notationToTurn, toCubie } from './physical'
import { formatFormulaLog, formulaLogSettled, formulaNotation, type FormulaTurn } from './formulaLog'

const NAMES = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }

function record(setup: Parameters<typeof applyMoves>[1], notation: readonly string[]) {
  let physical = fromCubie(applyMoves(SOLVED, setup))
  const history: FormulaTurn[] = []
  for (const n of notation) {
    const turn = notationToTurn(n)
    history.push({
      before: toCubie(physical)!,
      moves: layerTurnToEvent(turn, readOrientation(physical, (s) => s)!)!.moves,
      token: layerTurnToToken(turn, 3)!
    })
    physical = applyNotation(physical, n)
  }
  return { history, end: toCubie(physical)! }
}

describe('formula recording', () => {
  it('names all face and middle-slice turns in the fixed frame, including inverse and half turns', () => {
    for (const letter of 'URFDLBMES') {
      for (const suffix of ['', "'", '2']) {
        const notation = `${letter}${suffix}`
        expect(formulaNotation(layerTurnToToken(notationToTurn(notation), 3)!)).toBe(notation)
      }
    }
  })

  it('exports the actual L formula separately from earlier alignment moves, with reproducible start/end states', () => {
    const setup = generateTopCrossScramble('medium', () => 0)
    const before = applyMoves(SOLVED, setup)
    const guide = buildTopCrossGuide(before, NAMES, 'dual')!
    const notation = guide.steps.map((s) => s.notation)
    const prefixLength = notation.length - TOP_CROSS_L_ALG.length
    const { history, end } = record(setup, notation)
    const data = JSON.parse(formatFormulaLog({
      setup, priorTurns: history.slice(0, prefixLength), start: guide.states[prefixLength]!,
      turns: history.slice(prefixLength), end, colorNames: NAMES
    }))
    expect(data.algorithm).toBe("L' F' D F L B D' B'")
    expect(data.setupFromSolved).toEqual(setup)
    expect(data.priorFixedTokens).toEqual(history.slice(0, prefixLength).map((t) => t.token))
    expect(data.start.facelets).toBe(toFacelets(guide.states[prefixLength]!))
    expect(data.start.downEdges).toEqual(['DR', 'DF'])
    expect(data.start.upperTwoLayersSolved).toBe(true)
    expect(data.steps).toHaveLength(8)
    expect(data.steps.map((s: { fixedToken: string }) => s.fixedToken)).toEqual(notation.slice(prefixLength))
    expect(data.end.facelets).toBe(toFacelets(end))
    expect(data.end.bottomCrossDone).toBe(true)
    expect(data.end.upperTwoLayersSolved).toBe(true)
    expect(data.steps.at(-1).after).toEqual(data.end)
  })

  it('waits for undo animation to settle before allowing a new recording or export', () => {
    const { history, end } = record([], ['M', 'U'])
    expect(formulaLogSettled(SOLVED, [], [])).toBe(true)
    expect(formulaLogSettled(end, history, [])).toBe(true)
    expect(formulaLogSettled(end, history.slice(0, -1), [])).toBe(false)
    expect(formulaLogSettled(history.at(-1)!.before, history.slice(0, -1), [])).toBe(true)
  })

  it('preserves slice moves and records the remaining path after an undo', () => {
    const notation = ['M', 'U', "M'", 'S2', 'E', "E'"]
    const { history, end } = record([], notation)
    const data = JSON.parse(formatFormulaLog({ setup: [], priorTurns: [], start: SOLVED, turns: history, end, colorNames: NAMES }))
    expect(data.algorithm).toBe(notation.join(' '))
    expect(data.steps[0].fixedToken).not.toBe('M')
    expect(data.steps[3].notation).toBe('S2')
    expect(data.steps[3].after.facelets).toBe(toFacelets(history[4]!.before))
    const undone = JSON.parse(formatFormulaLog({ setup: [], priorTurns: [], start: SOLVED, turns: history.slice(0, -1), end: history.at(-1)!.before, colorNames: NAMES }))
    expect(undone.algorithm).toBe(notation.slice(0, -1).join(' '))
    expect(undone.end.facelets).toBe(toFacelets(history.at(-1)!.before))
  })
})
