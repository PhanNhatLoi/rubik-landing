import { describe, expect, it } from 'vitest'
import { faceletsToStickerMap, gridKey } from '../adapter/stickerModel'
import { MOVES, SOLVED, applyMoves, toFacelets, type Face, type Move } from '../core'
import { FACES } from '../core/types'
import type { StickerKey } from '../../rubikLogic'
import { SCAN_STEPS, displayRotation, opposite, rotateCells, slotsFor, toStandard, viewRotation, type Hold } from './scanGuide'

type Vec = [number, number, number]
const N: Record<Face, Vec> = { U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] }
const KEY: Record<Face, StickerKey> = { U: 'py', D: 'ny', R: 'px', L: 'nx', F: 'pz', B: 'nz' }
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** What a camera sees of `front` with `up` at the top, rendered from the 3D sticker positions. */
function renderView(facelets: string, front: Face, up: Face): string[] {
  const map = faceletsToStickerMap(facelets)
  const right = cross(N[up], N[front])
  const out: string[] = []
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const p = [0, 1, 2].map((i) => 1 + N[front][i]! + right[i]! * (c - 1) + N[up][i]! * (1 - r))
      out.push(map.get(gridKey({ x: p[0]!, y: p[1]!, z: p[2]! }))?.[KEY[front]] ?? '?')
    }
  }
  return out
}

function scramble(seed: number): string {
  let s = seed
  const moves = Array.from({ length: 25 }, () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return MOVES[Math.floor((s / 2147483648) * MOVES.length)] as Move
  })
  return toFacelets(applyMoves(SOLVED, moves))
}

const standardFace = (facelets: string, f: Face) => [...facelets.slice(FACES.indexOf(f) * 9, FACES.indexOf(f) * 9 + 9)]

describe('scan geometry', () => {
  it('lays out the net as described: green front, yellow up', () => {
    expect(slotsFor({ front: 'F', top: 'D' })).toEqual({ F: 'center', B: 'back', D: 'top', U: 'bottom', R: 'left', L: 'right' })
    // Next ring step: red comes forward, green moves to the right.
    expect(slotsFor({ front: 'R', top: 'D' })).toMatchObject({ R: 'center', F: 'right', B: 'left', L: 'back' })
    // Orange front: green left, blue right.
    expect(slotsFor({ front: 'L', top: 'D' })).toMatchObject({ L: 'center', F: 'left', B: 'right' })
  })

  it('viewRotation matches 3D rendering for every face and up direction', () => {
    const f = scramble(3)
    for (const front of FACES) {
      for (const up of FACES) {
        if (up === front || up === opposite(front)) continue
        expect(renderView(f, front, up), `${front} up ${up}`).toEqual(rotateCells(standardFace(f, front), viewRotation(front, up)))
      }
    }
  })

  it('each step shows what the user sees, and toStandard undoes it', () => {
    const f = scramble(7)
    // Physical view per step: sides with yellow up; yellow tilted forward (orange below); white flipped (orange above).
    const views: Record<Face, [Face, Face]> = { F: ['F', 'D'], R: ['R', 'D'], B: ['B', 'D'], L: ['L', 'D'], D: ['D', 'R'], U: ['U', 'L'] }
    for (const step of SCAN_STEPS) {
      const [front, up] = views[step.face]
      const seen = renderView(f, front, up)
      expect(rotateCells(standardFace(f, step.face), displayRotation(step.face, step.hold)), step.face).toEqual(seen)
      expect(toStandard(step.face, seen)).toEqual(standardFace(f, step.face))
    }
  })

  it('yellow view: orange below, green left, blue right; white view: orange above', () => {
    const solved = toFacelets(SOLVED)
    const yellowView = renderView(solved, 'D', 'R')
    expect(yellowView.every((c) => c === 'D')).toBe(true)
    // Neighbours as seen around the tilted yellow face.
    expect(slotsFor({ front: 'D', top: 'R' })).toMatchObject({ L: 'bottom', F: 'left', B: 'right' })
    expect(slotsFor({ front: 'U', top: 'L' })).toMatchObject({ L: 'top', F: 'left', B: 'right' })
  })
})
