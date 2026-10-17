import { expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CORNER_FACELETS, toFacelets } from '../../smart-solver/core/facelets'
import { LAST_FACE_SAMPLES, lastFaceChoices, lastFaceDone } from '../guide/lastFaceGuide'
import LastFaceDiagram from './LastFaceDiagram'
import { LAST_FACE_FORMULA_PICTURES, LAST_FACE_GOAL_PICTURE } from '../copy/lesson8'
import { applyMoves, equals, SOLVED } from '../../smart-solver/core/cubie'
import { lastCornersPositionDone } from '../guide/lastCornersGuide'
import LastFaceLessonView from './LastFaceLessonView'
// Render every lesson page so formula/reference content is checked as well as the entry.
vi.mock('./LessonPlayer',()=>({default:({label,pages,renderPage}: {label:string;pages:{id:string;title:string}[];renderPage:(p:{id:string;title:string})=>ReactNode})=><div>{label}{pages.map((p)=><section key={p.id} data-page={p.id}><h2>{p.title}</h2>{renderPage(p)}</section>)}</div>}))
const COLORS={U:0xffffff,R:0xff0000,F:0x00ff00,D:0xffff00,L:0xff8800,B:0x0000ff}
const NAMES={U:'trắng',D:'vàng',F:'xanh lá',B:'xanh dương',R:'đỏ',L:'cam'}
it('uses the physical 3D renderer and matches the actual bottom sticker to the selected center on every valid frame',()=>{
 for(const {state} of LAST_FACE_SAMPLES) for(const variant of lastFaceChoices(state)) {
  const html=renderToStaticMarkup(<LastFaceDiagram state={state} variant={variant} faceColors={COLORS} colorNames={NAMES} label="Lật góc" />)
  expect([...html.matchAll(/<canvas /g)]).toHaveLength(1)
  expect(html).not.toContain('<svg')
  expect(html).toContain(`data-front="${variant.front}"`)
  expect(html).toContain(`data-side="${variant.side}"`)
  const face=toFacelets(state)[CORNER_FACELETS[variant.corner]![0]] as keyof typeof COLORS
  expect(face).toBe(variant.front)
  expect(html).toContain(`data-bottom-color="${face}"`)
  expect(html).toContain(`data-reference-center="${variant.front}"`)
  expect(html).toContain(`background:#${COLORS[face].toString(16).padStart(6,'0')}`)
 }
})
it('the goal and both formula samples finish the cube after exactly two halves',()=>{
 expect(lastFaceDone(LAST_FACE_GOAL_PICTURE.before)).toBe(false)
 expect(equals(LAST_FACE_GOAL_PICTURE.after,SOLVED)).toBe(true)
 for(const example of LAST_FACE_FORMULA_PICTURES) {
  expect(lastCornersPositionDone(example.before)).toBe(true)
  expect(lastFaceChoices(example.before).some((v)=>v.id===example.variant.id)).toBe(true)
  expect(example.variant.moves).toHaveLength(16)
  expect(equals(applyMoves(example.before,example.variant.moves),SOLVED)).toBe(true)
  expect(lastFaceDone(example.after)).toBe(true)
 }
})
it('renders lesson 8 entry with the two-half instruction and colored diagram',()=>{
 const html=renderToStaticMarkup(<LastFaceLessonView faceColors={COLORS} colorNames={NAMES} cube={null} moveCount={0} practice={false} onUndo={()=>{}} onLoadSetup={()=>{}} onHighlightMove={()=>{}} onHighlightTurn={()=>{}} onSpotlight={()=>{}} onMark={()=>{}} onPracticeChange={()=>{}} onExit={()=>{}} />)
 expect(html).toContain('Bài 8')
 expect(html).toContain('Lật góc để hoàn thành Rubik')
 expect(html).toContain('Làm đủ cả hai nửa')
 expect(html).toContain('Góc chưa đúng mặt')
 expect(html).toContain('Rubik đã hoàn thành')
 expect(html).toContain('data-reference-center="F"')
 expect([...html.matchAll(/aria-label="Chạy thử:/g)]).toHaveLength(2)
 const recognition=html.split('data-page="recognize"')[1]!.split('</section>')[0]!
 expect(recognition).not.toContain('Chạy thử:')
 expect(recognition).not.toContain('Các nước cần làm trên khối của bạn')
 const reference=html.split('data-page="practice"')[1]!.split('</section>')[0]!
 expect(reference).not.toContain('Chạy thử:')
 for(const label of ['2 góc cần lật','3 góc cần lật','4 góc cần lật','Đã hoàn thành','Xem thêm mẫu khác']) expect(html).toContain(label)
 expect([...html.matchAll(/aria-pressed="true"/g)]).toHaveLength(1)
})
