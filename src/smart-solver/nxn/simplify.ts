/** Splits a move token into its turn (face, wide or slice name) and quarter turns: R' → ['R', 3]. */
function parts(move: string): [string, number] {
  if (move.endsWith("'")) return [move.slice(0, -1), 3]
  if (move.endsWith('2')) return [move.slice(0, -1), 2]
  return [move, 1]
}

const token = (base: string, quarters: number): string => (quarters === 1 ? base : quarters === 2 ? `${base}2` : `${base}'`)

/**
 * Merges consecutive turns of the same layer: `U U'` vanishes, `U U` becomes `U2`, `U2 U'` becomes `U`.
 * The cube ends in exactly the same state; only turns that undo or repeat each other are touched.
 */
export function simplifyMoves<T extends string>(moves: readonly T[]): T[] {
  const out: [string, number][] = []
  for (const move of moves) {
    const [base, quarters] = parts(move)
    const top = out[out.length - 1]
    if (top && top[0] === base) {
      top[1] = (top[1] + quarters) % 4
      if (top[1] === 0) out.pop()
    } else {
      out.push([base, quarters])
    }
  }
  return out.map(([base, quarters]) => token(base, quarters) as T)
}
