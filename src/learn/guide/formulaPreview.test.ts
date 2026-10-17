import { expect, it } from 'vitest'
import { applyMoves, equals, SOLVED } from '../../smart-solver/core/cubie'
import { fromFacelets } from '../../smart-solver/core/facelets'
import { crossDone, firstLayerDone, f2lDone } from '../goals'
import { edgeCell, cornerCell } from '../cells'
import { CORNER_FORMULA_PREVIEWS, formulaPreviewBefore } from '../copy/formulaPreviews'
import { MIDDLE_FORMULAS } from '../copy/lesson4'
import { TOP_CROSS_LINE_CARD, TOP_CROSS_L_CARD } from '../copy/lesson5'
import { LAST_EDGES_FORMULA_PICTURES } from '../copy/lesson6'
import { LAST_CORNERS_FORMULA_PICTURES } from '../copy/lesson7'
import { LAST_FACE_SAMPLES, LAST_FACE_VARIANTS, lastFaceChoices } from './lastFaceGuide'
import { topCrossPattern } from './topCrossGuide'
import { formulaPreviewCells, formulaPreviewFrames } from './formulaPreview'

it('plays quarter turns, both half-turn directions and Unicode exactly as printed', () => {
 const preview=formulaPreviewFrames(SOLVED,"R′ D2′ R D2 · F′")
 expect(preview.steps.map((s)=>s.notation)).toEqual(["R'","D'","D'",'R','D','D',"F'"])
 expect(preview.steps.map((s)=>s.tokenIndex)).toEqual([0,1,1,2,3,3,4])
 const end=fromFacelets(preview.facelets.at(-1)!)
 expect(end.ok).toBe(true)
 if(!end.ok) throw new Error('Invalid final preview')
 expect(equals(end.state,applyMoves(SOLVED,["R'",'D2','R','D2',"F'"]))).toBe(true)
})
it('samples in lessons 3–8 replay the lesson formulas to their exact expected outcomes',()=>{
 for(const p of CORNER_FORMULA_PREVIEWS){
  expect(crossDone(p.before)).toBe(true)
  expect(firstLayerDone(applyMoves(p.before,p.moves))).toBe(true)
 }
 for(const card of [TOP_CROSS_LINE_CARD,TOP_CROSS_L_CARD]){
  const before=formulaPreviewBefore(card.formula)
  expect(f2lDone(before)).toBe(true)
  expect(topCrossPattern(before)).toBe(card===TOP_CROSS_LINE_CARD?'line':'elbow')
 }
 const samples=[...CORNER_FORMULA_PREVIEWS,...MIDDLE_FORMULAS,...LAST_EDGES_FORMULA_PICTURES,...LAST_CORNERS_FORMULA_PICTURES]
 for(const sample of samples){
  const frames=formulaPreviewFrames(sample.before,sample.moves)
  const parsed=fromFacelets(frames.facelets.at(-1)!)
  expect(parsed.ok).toBe(true)
  if(!parsed.ok)throw new Error('Invalid preview')
  expect(equals(parsed.state,applyMoves(sample.before,sample.moves))).toBe(true)
  if('after' in sample) expect(equals(parsed.state,sample.after)).toBe(true)
 }
 for(const variant of LAST_FACE_VARIANTS){
  const before=LAST_FACE_SAMPLES.find((s)=>lastFaceChoices(s.state).some((v)=>v.id===variant.id))!.state
  const frames=formulaPreviewFrames(before,variant.moves)
  expect(frames.steps).toHaveLength(16)
  const end=fromFacelets(frames.facelets.at(-1)!)
  expect(end.ok && equals(end.state,applyMoves(before,variant.moves))).toBe(true)
 }
})
it('the glow follows the same edge/corner identities as they leave and return to the bottom layer',()=>{
 for(const variant of LAST_FACE_VARIANTS){
  const preview=formulaPreviewFrames(SOLVED,variant.moves)
  const cells=[...variant.affected.map(cornerCell),edgeCell(4)]
  for(const frame of preview.physical){
   const tracked=formulaPreviewCells(preview.physical[0]!,frame,cells)
   expect(tracked).toHaveLength(3)
   const colors=(cell:number[],physical:typeof frame)=>Object.values(physical.find((c)=>[c.grid.x,c.grid.y,c.grid.z].every((v,i)=>v===cell[i]))!.stickers).filter(Boolean).sort().join('')
   expect(tracked.map((c)=>colors(c,frame)).sort()).toEqual(cells.map((c)=>colors(c,preview.physical[0]!)).sort())
  }
 }
})
