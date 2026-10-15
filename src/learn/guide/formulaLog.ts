import type { CubieState, Face, Move } from '../../smart-solver/core/types'
import { applyMoves, equals, SOLVED } from '../../smart-solver/core/cubie'
import { toFacelets } from '../../smart-solver/core/facelets'
import { f2lDone, topCrossDone } from '../../smart-solver/nxn/beginner'
import { tokenToLayerTurn } from '../../smart-solver/adapter/nxnModel'
import { notationToTurn } from './physical'

export interface FormulaTurn {
  moves: readonly Move[]
  before: CubieState
  token?: string
}

/** Keep fixed-layer notation: a slice changes centers, so center-relative moves alone are insufficient. */
export function formulaNotation(token: string): string {
  const turn = tokenToLayerTurn(token, 3)
  if (turn.layers.length !== 1) return token
  for (const letter of 'URFDLBMES') {
    for (const suffix of ['', "'", '2']) {
      const notation = `${letter}${suffix}`
      const candidate = notationToTurn(notation)
      if (candidate.axis === turn.axis && candidate.layer === turn.layers[0] &&
          ((candidate.steps - turn.steps) % 4 + 4) % 4 === 0) return notation
    }
  }
  return token
}

/** Undo removes history before its animation ends; don't export that transient mismatch. */
export function formulaLogSettled(cube: CubieState, history: readonly FormulaTurn[], setup: readonly Move[]): boolean {
  const last = history.at(-1)
  return equals(cube, last ? applyMoves(last.before, last.moves) : applyMoves(SOLVED, setup))
}

const snapshot = (cube: CubieState) => {
  const facelets = toFacelets(cube)
  return {
    facelets,
    upEdges: ['UR', 'UF', 'UL', 'UB'].filter((_, i) => facelets[[5, 7, 3, 1][i]!] === 'U'),
    lowerTwoLayersSolved: f2lDone(cube),
    topCrossDone: topCrossDone(cube)
  }
}

export function formatFormulaLog(input: {
  setup: readonly Move[]
  priorTurns: readonly FormulaTurn[]
  start: CubieState
  turns: readonly FormulaTurn[]
  end: CubieState
  colorNames: Record<Face, string>
}): string {
  const { setup, priorTurns, start, turns, end, colorNames } = input
  const notation = (t: FormulaTurn) => t.token ? formulaNotation(t.token) : null
  return JSON.stringify({
    format: 'rubik-lesson5-formula-v1',
    frame: 'Fixed scene: U=top, D=bottom, F=front, R=right. Facelets are center-relative URFDLB, 9 per face.',
    colorNames,
    setupFromSolved: setup,
    priorFixedTokens: priorTurns.map((t) => t.token ?? null),
    algorithm: turns.every((t) => t.token) ? turns.map(notation).join(' ') : null,
    start: snapshot(start),
    steps: turns.map((t, i) => ({
      step: i + 1,
      notation: notation(t),
      fixedToken: t.token ?? null,
      movesRelativeToCenters: t.moves,
      after: snapshot(turns[i + 1]?.before ?? end)
    })),
    end: snapshot(end)
  }, null, 2)
}
