/**
 * Minimum-cost perfect assignment for a square cost matrix (Hungarian algorithm, O(n³)).
 * Returns assignment[row] = column.
 */
export function hungarian(cost: readonly (readonly number[])[]): number[] {
  const n = cost.length
  const INF = Number.POSITIVE_INFINITY
  // 1-indexed potentials, as in the classic shortest-augmenting-path formulation.
  const u = new Array<number>(n + 1).fill(0)
  const v = new Array<number>(n + 1).fill(0)
  const p = new Array<number>(n + 1).fill(0)
  const way = new Array<number>(n + 1).fill(0)
  const c = (i: number, j: number) => (cost[i - 1] as readonly number[])[j - 1] as number

  for (let i = 1; i <= n; i += 1) {
    p[0] = i
    let j0 = 0
    const minv = new Array<number>(n + 1).fill(INF)
    const used = new Array<boolean>(n + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0] as number
      let delta = INF
      let j1 = 0
      for (let j = 1; j <= n; j += 1) {
        if (used[j]) continue
        const cur = c(i0, j) - (u[i0] as number) - (v[j] as number)
        if (cur < (minv[j] as number)) {
          minv[j] = cur
          way[j] = j0
        }
        if ((minv[j] as number) < delta) {
          delta = minv[j] as number
          j1 = j
        }
      }
      for (let j = 0; j <= n; j += 1) {
        if (used[j]) {
          u[p[j] as number] = (u[p[j] as number] as number) + delta
          v[j] = (v[j] as number) - delta
        } else {
          minv[j] = (minv[j] as number) - delta
        }
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0] as number
      p[j0] = p[j1] as number
      j0 = j1
    } while (j0 !== 0)
  }

  const assignment = new Array<number>(n).fill(-1)
  for (let j = 1; j <= n; j += 1) {
    if ((p[j] as number) > 0) assignment[(p[j] as number) - 1] = j - 1
  }
  return assignment
}
