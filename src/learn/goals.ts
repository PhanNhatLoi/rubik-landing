import type { CubieState } from '../smart-solver/core/types'
export { edgeDone, cornerDone } from '../smart-solver/nxn/beginner'
import { edgeDone, cornerDone, allDone } from '../smart-solver/nxn/beginner'
export { allDone }

/** Physical slots: first layer U (white), last layer D (yellow). */
export const CROSS = [1, 0, 3, 2] // UF UR UB UL
export const FIRST_CORNERS = [0, 1, 2, 3]
export const MIDDLE = [8, 9, 10, 11]
export const LAST_EDGES = [4, 5, 6, 7]
export const LAST_CORNERS = [4, 5, 6, 7]
export const crossDone = (s: CubieState): boolean => CROSS.every((i) => edgeDone(s, i))
export const firstLayerDone = (s: CubieState): boolean => crossDone(s) && FIRST_CORNERS.every((i) => cornerDone(s, i))
export const f2lDone = (s: CubieState): boolean => firstLayerDone(s) && MIDDLE.every((i) => edgeDone(s, i))
// Stage IDs retain their old names for compatibility; these last-layer goals now refer to D.
export const topCrossDone = (s: CubieState): boolean => f2lDone(s) && LAST_EDGES.every((i) => s.eo[i] === 0)
export const topFaceDone = (s: CubieState): boolean => topCrossDone(s) && LAST_CORNERS.every((i) => s.co[i] === 0)
export const cornersDone = (s: CubieState): boolean => topFaceDone(s) && LAST_CORNERS.every((i) => cornerDone(s, i))
