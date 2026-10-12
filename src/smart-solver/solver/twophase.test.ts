import { beforeAll, describe, expect, it } from 'vitest'
import { MOVES, SOLVED, applyMoves, isSolved, parseAlgorithm, type Move } from '../core'
import {
  N_CPERM,
  N_FLIP,
  N_SLICE,
  N_SPERM,
  N_TWIST,
  N_UDPERM,
  buildTables,
  coordBuilders,
  getCornerPerm,
  getFlip,
  getSlice,
  getSlicePerm,
  getTwist,
  getUDEdgePerm,
  rankPerm,
  unrankPerm,
  type Tables
} from './coords'
import { solve } from './twophase'

function randomMoves(n: number, seed: number): Move[] {
  let s = seed
  return Array.from({ length: n }, () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return MOVES[Math.floor((s / 2147483648) * MOVES.length)] as Move
  })
}

describe('coordinates', () => {
  it('round-trip through their builders', () => {
    const cases: [number, (c: number) => Parameters<typeof getTwist>[0], (s: Parameters<typeof getTwist>[0]) => number][] = [
      [N_TWIST, coordBuilders.withTwist, getTwist],
      [N_FLIP, coordBuilders.withFlip, getFlip],
      [N_SLICE, coordBuilders.withSlice, getSlice],
      [N_SPERM, coordBuilders.withSlicePerm, getSlicePerm]
    ]
    for (const [n, build, read] of cases) for (let c = 0; c < n; c += 1) expect(read(build(c))).toBe(c)
    for (let c = 0; c < N_CPERM; c += 997) expect(getCornerPerm(coordBuilders.withCornerPerm(c))).toBe(c)
    for (let c = 0; c < N_UDPERM; c += 997) expect(getUDEdgePerm(coordBuilders.withUDEdgePerm(c))).toBe(c)
  })

  it('are zero for the solved cube', () => {
    expect([getTwist(SOLVED), getFlip(SOLVED), getSlice(SOLVED), getCornerPerm(SOLVED)]).toEqual([0, 0, 0, 0])
    expect(rankPerm(unrankPerm(12345, 8))).toBe(12345)
  })
})

describe('two-phase solver', () => {
  let tables: Tables
  let buildMs = 0

  beforeAll(() => {
    const t0 = performance.now()
    tables = buildTables()
    buildMs = performance.now() - t0
  })

  it('builds complete pruning tables', () => {
    for (const t of [tables.twistSlicePrune, tables.flipSlicePrune, tables.cpermSpermPrune, tables.udpermSpermPrune]) {
      expect(t.indexOf(-1)).toBe(-1)
    }
    console.log(`[bench] table build ${buildMs.toFixed(0)} ms`)
  })

  it('returns an empty solution for a solved cube', () => {
    expect(solve(SOLVED, tables).moves).toEqual([])
  })

  it('finds the short solution of a short scramble', () => {
    for (const alg of ["R U F'", "U2 R' D B2", "F R2 L' U D2 B'"]) {
      const scramble = parseAlgorithm(alg)
      const r = solve(applyMoves(SOLVED, scramble), tables)
      expect(isSolved(applyMoves(applyMoves(SOLVED, scramble), r.moves))).toBe(true)
      expect(r.moves.length, alg).toBeLessThanOrEqual(scramble.length)
      expect(r.timedOut).toBe(false)
    }
  })

  it('solves the superflip', () => {
    const superflip = parseAlgorithm("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2")
    const start = applyMoves(SOLVED, superflip)
    const r = solve(start, tables, { timeoutMs: 3000 })
    expect(isSolved(applyMoves(start, r.moves))).toBe(true)
    console.log(`[bench] superflip: ${r.moves.length} moves, ${r.ms.toFixed(0)} ms`)
  }, 10000)

  it('solves random states with short solutions', () => {
    const lengths: number[] = []
    const times: number[] = []
    for (let seed = 1; seed <= 40; seed += 1) {
      const start = applyMoves(SOLVED, randomMoves(30, seed))
      const r = solve(start, tables, { targetLength: 20, timeoutMs: 500 })
      expect(isSolved(applyMoves(start, r.moves)), `seed ${seed}`).toBe(true)
      expect(r.moves.length).toBeLessThanOrEqual(22)
      lengths.push(r.moves.length)
      times.push(r.ms)
    }
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
    const sorted = [...times].sort((a, b) => a - b)
    console.log(
      `[bench] 40 random states (stop at ≤20): avg ${avg(lengths).toFixed(1)} moves (max ${Math.max(...lengths)}), ` +
        `median ${sorted[20]?.toFixed(0)} ms, max ${sorted[39]?.toFixed(0)} ms`
    )
  }, 60000)

  it('shortens solutions when given the full time budget', () => {
    const lengths: number[] = []
    for (let seed = 101; seed <= 110; seed += 1) {
      const start = applyMoves(SOLVED, randomMoves(30, seed))
      const r = solve(start, tables, { timeoutMs: 1000 })
      expect(isSolved(applyMoves(start, r.moves))).toBe(true)
      lengths.push(r.moves.length)
    }
    console.log(`[bench] 10 random states (1 s budget): avg ${(lengths.reduce((a, b) => a + b, 0) / 10).toFixed(1)} moves, max ${Math.max(...lengths)}`)
  }, 60000)
})
