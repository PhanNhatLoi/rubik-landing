import { expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CornerLessonView from './CornerLessonView'
import MiddleLessonView from './MiddleLessonView'
import TopCrossLessonView from './TopCrossLessonView'
import LastEdgesLessonView from './LastEdgesLessonView'
import LastCornersLessonView from './LastCornersLessonView'
import LastFaceLessonView from './LastFaceLessonView'

vi.mock('./LessonPlayer',()=>({default:({pages,renderPage}:{pages:{id:string}[];renderPage:(p:{id:string})=>ReactNode})=><>{pages.map((p)=><section key={p.id}>{renderPage(p)}</section>)}</>}))
const noop=()=>{}
const props={
 faceColors:{U:0xffffff,R:0xff0000,F:0x00ff00,D:0xffff00,L:0xff8800,B:0x0000ff},
 colorNames:{U:'trắng',D:'vàng',F:'xanh lá',B:'xanh dương',R:'đỏ',L:'cam'},
 cube:null,moveCount:0,practice:false,onUndo:noop,onLoadSetup:noop,onHighlightMove:noop,onHighlightTurn:noop,onSpotlight:noop,onMark:noop,onPracticeChange:noop,onExit:noop
}
for(const [lesson,View] of [[3,CornerLessonView],[4,MiddleLessonView],[5,TopCrossLessonView],[6,LastEdgesLessonView],[7,LastCornersLessonView],[8,LastFaceLessonView]] as const) {
 it(`lesson ${lesson} offers a manual slow preview before practicing`,()=>{
  const html=renderToStaticMarkup(<View {...props} />)
  expect(html).toContain('Xem trước công thức trên khối 3D')
  expect(html).toContain('▶ Chạy thử')
  expect(html).toContain('Về đầu')
  expect(html).toContain('Khối sẽ dừng ở kết quả cuối')
  expect(html).not.toContain('Đang xoay')
  const minimum=lesson===5?1:2
  expect([...html.matchAll(/aria-label="Chạy thử:/g)].length).toBeGreaterThanOrEqual(minimum)
 })
}
