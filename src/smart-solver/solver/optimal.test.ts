import { beforeAll, describe, expect, it } from 'vitest'
import { MOVES, SOLVED, applyMoves, isSolved, parseAlgorithm, type Move } from '../core'
import { buildTables } from './coords'
import { buildOptimalTables, solveOptimal, type OptimalTables } from './optimal'
import { solve } from './twophase'

function randomMoves(n: number, seed: number): Move[] {
  let s = seed
  return Array.from({ length: n }, () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return MOVES[Math.floor((s / 2147483648) * MOVES.length)] as Move
  })
}

/** Plain iterative deepening without heuristics: slow but obviously correct. */
function bruteForceDistance(start: ReturnType<typeof applyMoves>, maxDepth: number): number {
  const face = (m: number) => Math.floor(m / 3)
  const dfs = (s: typeof start, depth: number, last: number): boolean => {
    if (depth === 0) return isSolved(s)
    for (let m = 0; m < 18; m += 1) {
      if (last >= 0 && (face(m) === face(last) || (face(m) % 3 === face(last) % 3 && face(m) < face(last)))) continue
      if (dfs(applyMoves(s, [MOVES[m] as Move]), depth - 1, m)) return true
    }
    return false
  }
  for (let d = 0; d <= maxDepth; d += 1) if (dfs(start, d, -1)) return d
  return -1
}

describe('optimal solver', () => {
  let tables: OptimalTables
  beforeAll(() => {
    const t0 = performance.now()
    tables = buildOptimalTables()
    console.log(`[bench] optimal tables: ${(performance.now() - t0).toFixed(0)} ms, endgame states ${tables.endgame.size}`)
  })

  it('endgame table matches the BFS layer sizes up to depth 5', () => {
    // Known counts of positions at distance 0..5 (HTM): 1, 18, 243, 3240, 43239, 574908.
    expect(tables.endgame.size).toBe(1 + 18 + 243 + 3240 + 43239 + 574908)
  })

  it('returns the empty path for solved', () => {
    expect(solveOptimal(SOLVED, tables).moves).toEqual([])
  })

  it('agrees with brute force on random shallow states', () => {
    for (let seed = 1; seed <= 8; seed += 1) {
      const start = applyMoves(SOLVED, randomMoves(6, seed))
      const r = solveOptimal(start, tables)
      expect(r.moves).not.toBeNull()
      expect(isSolved(applyMoves(start, r.moves ?? []))).toBe(true)
      expect(r.moves?.length, `seed ${seed}`).toBe(bruteForceDistance(start, 6))
    }
  }, 120000)

  it('is never longer than the two-phase solution', () => {
    const tp = buildTables()
    for (let seed = 21; seed <= 26; seed += 1) {
      const start = applyMoves(SOLVED, randomMoves(10, seed))
      const r = solveOptimal(start, tables, { timeoutMs: 20000 })
      const near = solve(start, tp, { timeoutMs: 300 })
      expect(r.moves).not.toBeNull()
      expect(isSolved(applyMoves(start, r.moves ?? []))).toBe(true)
      expect((r.moves ?? []).length).toBeLessThanOrEqual(near.moves.length)
    }
  }, 180000)

  it('solves states up to ~10 moves from solved quickly', () => {
    // Full depth benchmark (8..16) is recorded in docs/smart-solver-plan.md; kept short here.
    for (let seed = 1; seed <= 5; seed += 1) {
      const start = applyMoves(SOLVED, randomMoves(10, 5000 + seed))
      const r = solveOptimal(start, tables, { timeoutMs: 3000 })
      expect(r.moves).not.toBeNull()
      expect(isSolved(applyMoves(start, r.moves ?? []))).toBe(true)
    }
  }, 30000)

  it('reports a proven lower bound when it runs out of time', () => {
    const start = applyMoves(SOLVED, randomMoves(30, 77))
    const r = solveOptimal(start, tables, { timeoutMs: 200 })
    expect(r.moves).toBeNull()
    expect(r.provenLowerBound).toBeGreaterThanOrEqual(6)
  })

  it('example', () => {
    const r = solveOptimal(applyMoves(SOLVED, parseAlgorithm("R U F'")), tables)
    expect(r.moves).toEqual(parseAlgorithm("F U' R'"))
  })
})
