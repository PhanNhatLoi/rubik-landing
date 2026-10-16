import { expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CORNER_FACELETS, toFacelets } from '../../smart-solver/core/facelets'
import { LAST_FACE_SAMPLES, lastFaceChoices } from '../guide/lastFaceGuide'
import LastFaceDiagram from './LastFaceDiagram'
import LastFaceLessonView from './LastFaceLessonView'
// Render every lesson page so formula/reference content is checked as well as the entry.
vi.mock('./LessonPlayer',()=>({default:({label,pages,renderPage}: {label:string;pages:{id:string;title:string}[];renderPage:(p:{id:string;title:string})=>ReactNode})=><div>{label}{pages.map((p)=><section key={p.id}><h2>{p.title}</h2>{renderPage(p)}</section>)}</div>}))
const COLORS={U:0xffffff,R:0xff0000,F:0x00ff00,D:0xffff00,L:0xff8800,B:0x0000ff}
const NAMES={U:'trắng',D:'vàng',F:'xanh lá',B:'xanh dương',R:'đỏ',L:'cam'}
it('shows one whole cube with actual bottom colors, visible centers and two highlighted corners',()=>{
 for(const {state} of LAST_FACE_SAMPLES) for(const variant of lastFaceChoices(state)) {
  const html=renderToStaticMarkup(<LastFaceDiagram state={state} variant={variant} faceColors={COLORS} colorNames={NAMES} label="Lật góc" />)
  expect([...html.matchAll(/data-sticker=/g)]).toHaveLength(8)
  expect([...html.matchAll(/data-center=/g)]).toHaveLength(3)
  const arrows=[...html.matchAll(/data-twist-corner="(\d)"/g)].map((m)=>Number(m[1]))
  expect(arrows.sort()).toEqual([...variant.affected].sort())
  const face=toFacelets(state)[CORNER_FACELETS[variant.corner]![0]] as keyof typeof COLORS
  expect(face).toBe(variant.front)
  const expectedColor=`#${COLORS[face].toString(16).padStart(6,'0')}`
  expect(html).toContain(`data-sticker="${variant.corner}-D"`)
  expect(html.match(new RegExp(`data-sticker="${variant.corner}-D"[^>]+`))![0]).toContain(`fill="${expectedColor}"`)
 }
})
it('renders lesson 8 entry with the two-half instruction and colored diagram',()=>{
 const html=renderToStaticMarkup(<LastFaceLessonView faceColors={COLORS} colorNames={NAMES} cube={null} moveCount={0} practice={false} onUndo={()=>{}} onLoadSetup={()=>{}} onHighlightMove={()=>{}} onHighlightTurn={()=>{}} onSpotlight={()=>{}} onMark={()=>{}} onPracticeChange={()=>{}} onExit={()=>{}} />)
 expect(html).toContain('Bài 8')
 expect(html).toContain('Lật góc để hoàn thành Rubik')
 expect(html).toContain('Làm đủ cả hai nửa')
 expect(html).toContain('data-center="F"')
 for(const label of ['2 góc cần lật','3 góc cần lật','4 góc cần lật','Đã hoàn thành','Xem thêm mẫu khác']) expect(html).toContain(label)
 expect([...html.matchAll(/aria-pressed="true"/g)]).toHaveLength(1)
})
