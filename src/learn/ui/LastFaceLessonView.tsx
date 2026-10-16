import { useEffect, useRef, useState } from 'react'
import { applyMoves } from '../../smart-solver/core/cubie'
import { CORNER_FACELETS, toFacelets } from '../../smart-solver/core/facelets'
import type { Face } from '../../smart-solver/core/types'
import type { CubieState } from '../../smart-solver/core/types'
import { layerTurnToToken } from '../../smart-solver/adapter/nxnModel'
import { LAST_FACE_DEFAULT, LAST_FACE_CASES, LESSON8_PAGES } from '../copy/lesson8'
import { buildLastFaceGuide, LAST_FACE_LEFT, LAST_FACE_RIGHT, LAST_FACE_SAMPLES, LAST_FACE_VARIANTS, lastFaceChoices, lastFaceDone, type LastFaceVariant } from '../guide/lastFaceGuide'
import { LAST_CORNER_LABEL, lastCornersPositionDone } from '../guide/lastCornersGuide'
import { locateOnGuide } from '../guide/follow'
import { notationToTurn } from '../guide/physical'
import { cornerCell } from '../cells'
import type { TopCrossLessonViewProps } from './TopCrossLessonView'
import LessonPlayer from './LessonPlayer'
import LastFaceDiagram from './LastFaceDiagram'
const card={padding:'12px',border:'1px solid var(--rb-border)',borderRadius:'var(--rb-r-md)',background:'var(--rb-surface-1)'} as const
const text={fontSize:'13px',lineHeight:1.5,color:'var(--rb-text-muted)'} as const
const notation=(m: readonly string[])=>m.join(' ').replaceAll("'",'′')
const label=(v: LastFaceVariant)=>`Mặt ${v.front} làm F mốc · góc ${LAST_CORNER_LABEL[v.corner]} · bản ${v.side==='right'?'R′':'L'}`
type Guide=NonNullable<ReturnType<typeof buildLastFaceGuide>>
interface Plan {guide: Guide; index: number; off?: boolean}
export default function LastFaceLessonView({faceColors,colorNames,cube,moveCount,onUndo,onLoadSetup,onHighlightTurn,onSpotlight,onMark,practice,onPracticeChange,onExit}: TopCrossLessonViewProps) {
 const [sample,setSample]=useState(LAST_FACE_DEFAULT)
 const [preferred,setPreferred]=useState<string | undefined>()
 const [plan,setPlan]=useState<Plan | null>(null)
 const [message,setMessage]=useState<string | null>(null)
 const [hints,setHints]=useState(0)
 const example=LAST_FACE_SAMPLES[sample]!
 const shown=practice && cube ? cube : example.state
 const choices=lastFaceChoices(shown)
 const chosen=choices.find((v)=>v.id===preferred)??choices[0]
 const solved=lastFaceDone(shown)
 const load=()=>{setPlan(null);setMessage(null);setHints(0);onHighlightTurn(null);onMark(null);onLoadSetup(example.setup.slice())}
 const seen=useRef(cube)
 useEffect(()=>{
  if(seen.current===cube)return
  seen.current=cube
  if(!cube || !plan)return
  const at=locateOnGuide(plan.guide,cube)
  if(at.kind==='done'){setPlan(null);setPreferred(undefined);setMessage('Đã đủ hai nửa: cạnh và vị trí góc trở lại đúng. Quan sát màu dưới góc, xin Gợi ý cho lượt tiếp theo nếu cần.')}
  else if(at.kind==='step'){setPlan({guide:plan.guide,index:at.index});setMessage(null)}
  else {setPlan({...plan,off:true});setMessage('Nước xoay khác hướng dẫn. Bấm Hoàn tác để trở lại rồi tiếp tục công thức.')}
 },[cube,plan])
 useEffect(()=>{
  const step=practice && plan && !plan.off ? plan.guide.steps[plan.index] : null
  onHighlightTurn(step?layerTurnToToken(notationToTurn(step.notation),3):null)
  onMark(practice && cube && !plan?.off ? (plan?plan.guide.variant.affected:chosen?.affected??[]).map((i)=>cornerCell(cube.cp.indexOf(i))):null)
 },[practice,cube,plan,chosen,onHighlightTurn,onMark])
 const chooseSample=(i: number)=>{setSample(i);setPreferred(undefined)}
 const diagram=(state: CubieState,v?: LastFaceVariant,description='Các góc và tâm quanh mặt D')=><LastFaceDiagram state={state} faceColors={faceColors} colorNames={colorNames} variant={v} label={description} />
 const recommendation=(state: CubieState)=>{
  const choices=lastFaceChoices(state)
  const chosen=choices.find((v)=>v.id===preferred)??choices[0]
  return <>
  {chosen && <>
   <strong style={{color:'var(--rb-accent-link)'}}>Đề xuất: {label(chosen)}</strong>
   <div>Ô dưới góc {LAST_CORNER_LABEL[chosen.corner]} có màu <strong>{colorNames[chosen.front]}</strong>, trùng tâm {chosen.front}. Lấy mặt đó làm F mốc, bắt đầu từ {chosen.side==='right'?'R′':'L'}.</div>
   {choices.length>1 && <details><summary style={{minHeight:'44px',cursor:'pointer'}}>Xem cách chọn mốc khác</summary><select aria-label="Chọn mặt mốc lật góc" value={chosen.id} onChange={(e)=>setPreferred(e.target.value)} style={{width:'100%',minHeight:'44px',background:'var(--rb-surface-2)',color:'var(--rb-text)',border:'1px solid var(--rb-border)',borderRadius:'var(--rb-r-sm)'}}>{choices.map((v)=><option key={v.id} value={v.id}>{label(v)}</option>)}</select></details>}
   <div>Công thức theo F mốc:</div>
   <strong style={{color:'var(--rb-accent-link)'}}>{notation((chosen.side==='right'?LAST_FACE_RIGHT:LAST_FACE_LEFT).slice(0,8))} · {notation((chosen.side==='right'?LAST_FACE_RIGHT:LAST_FACE_LEFT).slice(8))}</strong>
   <div>Theo vị trí cố định của khối ảo: <strong>{notation(chosen.moves)}</strong></div>
  </>}
 </>
 }
 const teaching=LAST_FACE_SAMPLES[LAST_FACE_DEFAULT]!.state
 const teachingVariant=lastFaceChoices(teaching)[0]!
 const step=plan?.guide.steps[plan.index]
 return <LessonPlayer label="Bài 8" pages={LESSON8_PAGES} onExit={onExit}
  onEnter={(page)=>{onSpotlight(null);if(page.id!=='practice')onPracticeChange(false)}}
  onLeave={()=>{onSpotlight(null);onHighlightTurn(null);onMark(null);onPracticeChange(false)}}
  practiceFor={(page)=>page.id==='practice'?{active:practice,onToggle:()=>{if(!practice)load();onPracticeChange(!practice)}}:undefined}
  renderPage={(page)=><>
   <div role="note" style={{...card,...text,borderColor:'var(--rb-accent-tint-border)'}}><strong style={{color:'var(--rb-text)'}}>Giữ trắng trên U, vàng dưới D. Làm đủ cả hai nửa rồi mới chọn lượt tiếp theo.</strong></div>
   {practice && page.id==='practice'?<>
    <div style={{...card,...text}}>Đang luyện đúng mẫu đã chọn · {example.wrong} góc cần lật lúc bắt đầu.</div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}><button className="rb-btn rb-btn--secondary" onClick={load}>Tải lại mẫu này</button><button className="rb-btn rb-btn--secondary" onClick={()=>onPracticeChange(false)}>Đổi mẫu</button></div>
    <div style={{...text,...card}}>Nước đi: <strong>{moveCount}</strong> · Gợi ý: <strong>{hints}</strong>{cube && lastCornersPositionDone(cube) && <> · Góc đúng mặt: <strong>{4-cube.co.slice(4).filter(Boolean).length}/4</strong></>}</div>
    {!plan && <div style={{...card,...text,display:'grid',gap:'10px'}}>{diagram(shown,chosen)}{recommendation(shown)}</div>}
    {plan && step && !plan.off && <div role="status" aria-live="polite" style={{...card,...text,display:'grid',gap:'10px',borderColor:'var(--rb-accent-link)'}}>
     <strong>{label(plan.guide.variant)}</strong><div>{plan.index<8?'Nửa 1/2':'Nửa 2/2'} · Bước {plan.index+1}/16</div>
     <strong style={{color:'var(--rb-accent-link)'}}>{plan.guide.formula}</strong>
     <div style={{display:'flex',gap:'12px',alignItems:'center'}}><div className="rb-move-hero" style={{width:'56px',height:'56px',fontSize:'24px',flex:'none'}}>{step.notation}</div><div>{step.why}</div></div>
    </div>}
    {(solved || message) && <div role="status" className="rb-alert" style={text}>{solved?'Đã hoàn thành Rubik! Bốn góc đúng mặt, các cạnh và hai tầng trên đều đúng.':message}</div>}
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
     <button className="rb-btn rb-btn--secondary" disabled={!!plan || solved || !cube} onClick={()=>{
      if(!cube)return
      if(!lastCornersPositionDone(cube)){setMessage('Cần hoàn thành Bài 7 trước. Hoàn tác nước sai hoặc tải lại mẫu này.');return}
      const guide=buildLastFaceGuide(cube,chosen?.id)
      if(guide){setPlan({guide,index:0});setMessage(null);setHints((n)=>n+1)}
     }}>Gợi ý</button>
     <button className="rb-btn rb-btn--secondary" disabled={moveCount===0} onClick={onUndo}>Hoàn tác</button>
    </div>
   </>:<>
    {page.body.map((p)=><p key={p} style={{...text,margin:0,fontSize:'14px',color:'var(--rb-text)'}}>{p}</p>)}
    {(page.id==='goal' || page.id==='recognize') && <div style={{...card,...text,display:'grid',gap:'10px'}}>{diagram(teaching,teachingVariant)}{page.id==='recognize' && recommendation(teaching)}{page.id==='goal' && <details><summary style={{minHeight:'44px',cursor:'pointer'}}>Xem sau một lượt đủ hai nửa</summary>{diagram(applyMoves(teaching,teachingVariant.moves))}</details>}</div>}
    {page.id==='formula' && (['right','left'] as const).map((side)=>{
     const v=LAST_FACE_VARIANTS.find((v)=>v.front==='F' && v.side===side)!
     const before=LAST_FACE_SAMPLES.find((s)=>lastFaceChoices(s.state).some((c)=>c.id===v.id))!.state
     return <div key={side} style={{...card,...text,display:'grid',gap:'10px'}}><strong>Bắt đầu {side==='right'?'R′ · hai góc FR–BR':'L · hai góc FL–BL'}</strong><strong style={{color:'var(--rb-accent-link)'}}>{notation(v.moves.slice(0,8))} · {notation(v.moves.slice(8))}</strong>{diagram(before,v)}<details><summary style={{minHeight:'44px',cursor:'pointer'}}>Xem kết quả sau đủ hai nửa</summary>{diagram(applyMoves(before,v.moves))}</details></div>
    })}
    {page.id==='practice' && <div style={{...text,display:'grid',gap:'12px'}}>
     <div role="group" aria-label="Số góc cần lật" style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'8px'}}>{LAST_FACE_CASES.map((c)=><button key={c.wrong} className="rb-btn rb-btn--secondary" aria-pressed={example.wrong===c.wrong} style={{height:'auto',minHeight:'44px',whiteSpace:'normal',background:example.wrong===c.wrong?'var(--rb-accent-tint)':undefined,borderColor:example.wrong===c.wrong?'var(--rb-accent-link)':undefined,color:example.wrong===c.wrong?'var(--rb-accent-link)':undefined,fontWeight:example.wrong===c.wrong?700:undefined}} onClick={()=>chooseSample(LAST_FACE_SAMPLES.findIndex((s)=>s.wrong===c.wrong))}>{example.wrong===c.wrong?'✓ ':''}{c.label}</button>)}</div>
     <strong>{solved?'Bốn góc đã đúng mặt. Không cần công thức.':'So màu dưới góc với tâm, chọn phía bắt đầu'}</strong>
     {example.wrong>0 && <details key={sample} style={card}><summary style={{minHeight:'44px',cursor:'pointer',color:'var(--rb-accent-link)'}}>Xem thêm mẫu khác ({LAST_FACE_SAMPLES.filter((s)=>s.wrong===example.wrong).length-1})</summary><div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'8px'}}>{LAST_FACE_SAMPLES.map((s,i)=>s.wrong===example.wrong && i!==sample?<button key={i} className="rb-btn rb-btn--secondary" onClick={()=>chooseSample(i)} style={{height:'auto',minHeight:'64px',display:'grid',gap:'6px',padding:'8px'}}><span>Mẫu {i+1}</span><span style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'3px'}}>{[5,4,6,7].map((slot)=>{
      const f=toFacelets(s.state)[CORNER_FACELETS[slot]![0]] as Face
      return <span key={slot} title={`Ô dưới góc ${LAST_CORNER_LABEL[slot]}: ${colorNames[f]}`} style={{width:'18px',height:'18px',borderRadius:'3px',background:`#${faceColors[f].toString(16).padStart(6,'0')}`}} />
     })}</span></button>:null)}</div></details>}
     <div style={{...card,display:'grid',gap:'10px'}}>{diagram(shown,chosen)}{recommendation(shown)}{chosen && <details><summary style={{minHeight:'44px',cursor:'pointer'}}>Xem sau lượt đề xuất</summary>{diagram(applyMoves(shown,chosen.moves))}</details>}</div>
    </div>}
    <div style={{...card,...text}}><strong>Vì sao?</strong><br />{page.reason}</div>
   </>}
  </>} />
}
