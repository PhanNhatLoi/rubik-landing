import { expect, it } from 'vitest'
import { applyMoves, equals, SOLVED } from '../../smart-solver/core/cubie'
import { fromFacelets, toFacelets } from '../../smart-solver/core/facelets'
import { LAST_FACE_RIGHT, LAST_FACE_LEFT, LAST_FACE_VARIANTS, LAST_FACE_SAMPLES, buildLastFaceGuide, lastFaceChoices, lastFaceDone } from './lastFaceGuide'
import { lastCornersPositionDone } from './lastCornersGuide'
import { locateOnGuide } from './follow'
import { applyNotation, fromCubie, toCubie } from './physical'
it('replays the supplied log and twists only the chosen two corners after both halves', () => {
 const start = fromFacelets('UUUUUUUUURRRRRRFRBFFFFFFFFDDDRDDDDDRLLLLLLLLLBBBBBBDBB')
 expect(start.ok).toBe(true)
 if (!start.ok) return
 expect(toFacelets(applyMoves(start.state, LAST_FACE_RIGHT))).toBe('UUUUUUUUURRRRRRDRDFFFFFFFFRDDFDDDDDBLLLLLLLLLBBBBBBRBB')
 expect(applyMoves(SOLVED,LAST_FACE_RIGHT).co.slice(4)).toEqual([1,0,0,2])
 expect(applyMoves(SOLVED,LAST_FACE_LEFT).co.slice(4)).toEqual([0,2,1,0])
 for (const v of LAST_FACE_VARIANTS) {
  expect(v.affected).toHaveLength(2)
  expect(lastCornersPositionDone(v.effect)).toBe(true)
  expect(v.moves).toHaveLength(16)
 }
})
it('covers all 27 legal twists and solves each using the bottom-color/center clue', () => {
 expect(LAST_FACE_SAMPLES).toHaveLength(27)
 const counts: Record<number,number> = {}
 for (const sample of LAST_FACE_SAMPLES) {
  expect(equals(applyMoves(SOLVED,sample.setup),sample.state)).toBe(true)
  expect(fromFacelets(toFacelets(sample.state)).ok).toBe(true)
  counts[sample.wrong]=(counts[sample.wrong]??0)+1
  let state = sample.state
  for(let round=0;round<8 && !lastFaceDone(state);round++) {
   const choices=lastFaceChoices(state)
   expect(choices.length).toBeGreaterThan(0)
   const guide=buildLastFaceGuide(state)!
   expect(locateOnGuide(guide,state)).toEqual({kind:'step',index:0,quarterDone:false})
   state=guide.states.at(-1)!
   expect(lastCornersPositionDone(state)).toBe(true)
   expect(locateOnGuide(guide,state)).toEqual({kind:'done'})
  }
  expect(lastFaceDone(state), JSON.stringify(sample.state.co)).toBe(true)
 }
 expect(counts).toEqual({0:1,2:12,3:8,4:6})
})

it('all offered frames solve the indicated corner and trace physical turns with undo recovery', () => {
 for (const sample of LAST_FACE_SAMPLES) for (const variant of lastFaceChoices(sample.state)) {
  const guide=buildLastFaceGuide(sample.state,variant.id)!
  expect(guide.variant.id).toBe(variant.id)
  let physical=fromCubie(sample.state)
  for(let i=0;i<guide.steps.length;i++) {
   physical=applyNotation(physical,guide.steps[i]!.notation)
   expect(equals(toCubie(physical)!,guide.states[i+1]!)).toBe(true)
  }
  const end=guide.states.at(-1)!
  expect(end.co[variant.corner]).toBe(0)
  expect(lastCornersPositionDone(end)).toBe(true)
  const wrong=applyMoves(guide.states[3]!,['U'])
  expect(locateOnGuide(guide,wrong)).toEqual({kind:'off'})
  expect(locateOnGuide(guide,applyMoves(wrong,["U'"]))).toEqual({kind:'step',index:3,quarterDone:false})
 }
 expect(buildLastFaceGuide(applyMoves(SOLVED,['D']))).toBeNull()
 expect(buildLastFaceGuide(SOLVED)).toBeNull()
})
