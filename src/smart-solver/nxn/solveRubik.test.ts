import { describe, expect, it } from 'vitest'
import { FACE_ORDER, getEngine, isSolvedState, type CubeSize } from './engine'
import { InvalidCubeError, solveRubik, supportedModes } from './solveRubik'
import { toCubeState, type CubeState } from './state'

/** Run the 100-scramble 5x5 benchmark only with BENCH=1 (about 4 s per cube). */
const BENCH = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.BENCH === '1'

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

/** Random legal scramble of an n×n cube, including inner layers, as stickers. */
function scrambled(n: CubeSize, seed: number, length: number): Uint8Array {
  const tokens: string[] = []
  for (const f of FACE_ORDER) {
    for (const s of ['', "'", '2']) {
      tokens.push(`${f}${s}`)
      for (let d = 2; d < n; d += 1) tokens.push(`${d}${f}${s}`)
    }
  }
  const r = rng(seed)
  const e = getEngine(n)
  return e.applyAll(e.solved(), Array.from({ length }, () => tokens[Math.floor(r() * tokens.length)] as string))
}

const PALETTE = ['white', 'red', 'green', 'yellow', 'orange', 'blue']

async function checkSolves(n: CubeSize, count: number, mode: 'beginner' | 'fast' = 'beginner', palette = PALETTE) {
  const lengths: number[] = []
  const times: number[] = []
  for (let seed = 1; seed <= count; seed += 1) {
    const stickers = scrambled(n, seed * 31 + n, 5 + (seed % 40))
    const state = toCubeState(stickers, n, palette)
    const result = await solveRubik(n, state, { mode, timeoutMs: 60000 })
    // Independent check on the original stickers.
    expect(isSolvedState(getEngine(n).applyAll(stickers, result.moves), n), `${n}x${n} seed ${seed}`).toBe(true)
    expect(result.moveCount).toBe(result.moves.length)
    lengths.push(result.moveCount)
    times.push(result.executionTimeMs)
    // Let the test runner breathe between long synchronous solves.
    await new Promise((r) => setTimeout(r, 0))
  }
  const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)
  console.log(`[bench] ${n}x${n} ${mode} ×${count}: avg ${avg(lengths)} moves (max ${Math.max(...lengths)}), avg ${avg(times)} ms (max ${Math.max(...times).toFixed(0)} ms)`)
}

describe('solveRubik', () => {
  it('2x2 beginner and optimal on 100 scrambles each', async () => {
    await checkSolves(2, 100, 'beginner')
    await checkSolves(2, 100, 'fast')
  }, 120000)

  it('3x3 beginner on 100 scrambles, two-phase on 20', async () => {
    await checkSolves(3, 100, 'beginner')
    await checkSolves(3, 20, 'fast')
  }, 120000)

  it('4x4 reduction on 100 scrambles', async () => {
    await checkSolves(4, 100)
  }, 600000)

  it('5x5 reduction on a few scrambles', async () => {
    await checkSolves(5, 5)
  }, 300000)

  it.skipIf(!BENCH)('5x5 reduction on 100 scrambles (BENCH=1)', async () => {
    await checkSolves(5, 100)
  }, 3600000)

  it('works with any color names and schemes, including even cubes without fixed centers', async () => {
    // Japanese scheme: white opposite blue, green opposite yellow.
    const japanese = ['white', 'red', 'green', 'blue', 'orange', 'yellow']
    for (const n of [2, 3, 4] as CubeSize[]) {
      const stickers = scrambled(n, 99, 30)
      const r = await solveRubik(n, toCubeState(stickers, n, japanese))
      expect(isSolvedState(getEngine(n).applyAll(stickers, r.moves), n)).toBe(true)
    }
    // Arbitrary color names and an odd cube.
    const custom = ['ngà', 'đỏ đô', 'lục', 'chanh', 'tím', 'chàm']
    const stickers = scrambled(3, 5, 25)
    const r = await solveRubik(3, toCubeState(stickers, 3, custom))
    expect(isSolvedState(getEngine(3).applyAll(stickers, r.moves), 3)).toBe(true)
  })

  it('reports invalid input distinctly', async () => {
    const solved3 = toCubeState(getEngine(3).solved(), 3, PALETTE)
    await expect(solveRubik(4, solved3)).rejects.toMatchObject({ reason: 'sizeMismatch' })
    const short: CubeState = { ...solved3, faces: { ...solved3.faces, U: solved3.faces.U.slice(0, 8) } }
    await expect(solveRubik(3, short)).rejects.toMatchObject({ reason: 'faceLength' })
    const recolored: CubeState = { ...solved3, faces: { ...solved3.faces, U: ['red', ...solved3.faces.U.slice(1)] } }
    await expect(solveRubik(3, recolored)).rejects.toBeInstanceOf(InvalidCubeError)
    // Twist one corner in place (URF stickers U9, R1, F3): impossible on a real cube.
    const twisted = getEngine(3).solved()
    ;[twisted[8], twisted[9], twisted[20]] = [twisted[20] as number, twisted[8] as number, twisted[9] as number]
    await expect(solveRubik(3, toCubeState(twisted, 3, PALETTE))).rejects.toMatchObject({ reason: 'cornerTwist' })
    // Flip one edge (UR stickers U6, R2).
    const flipped = getEngine(3).solved()
    ;[flipped[5], flipped[10]] = [flipped[10] as number, flipped[5] as number]
    await expect(solveRubik(3, toCubeState(flipped, 3, PALETTE))).rejects.toMatchObject({ reason: 'unsolvable' })
  })

  it('solved cubes need no moves; modes per size', async () => {
    for (const n of [2, 3, 4, 5] as CubeSize[]) {
      const r = await solveRubik(n, toCubeState(getEngine(n).solved(), n, PALETTE))
      expect(r.moves).toEqual([])
    }
    expect(supportedModes(3)).toEqual(['beginner', 'fast'])
    expect(supportedModes(4)).toEqual(['beginner'])
  })
})
