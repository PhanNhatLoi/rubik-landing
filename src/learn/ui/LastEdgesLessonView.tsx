import { useEffect, useRef, useState } from 'react'
import { applyMoves, SOLVED } from '../../smart-solver/core/cubie'
import { EDGE_COLORS, toFacelets } from '../../smart-solver/core/facelets'
import type { Face } from '../../smart-solver/core/types'
import { topCrossDone } from '../goals'
import { lastEdgesDone, type LastEdgesGuide } from '../guide/lastEdgesGuide'
import { generateLastEdgesCaseScramble, LAST_EDGES_FINAL_ALIGNMENT_NOTE, LAST_EDGES_EXCHANGE_PICTURE, LAST_EDGES_FORMULA_PICTURES, LAST_EDGES_ORDER_CASES, LESSON6_PAGES } from '../copy/lesson6'
import { locateOnGuide } from '../guide/follow'
import { notationToTurn } from '../guide/physical'
import { layerTurnToToken } from '../../smart-solver/adapter/nxnModel'
import type { TopCrossLessonViewProps } from './TopCrossLessonView'
import LessonPlayer from './LessonPlayer'
import LastEdgesDiagram from './LastEdgesDiagram'
import MiniCube from './MiniCube'
import LastEdgesFormulaExample from './LastEdgesFormulaExample'
import LastEdgesOrderCases, { type LastEdgesSelectedFrames } from './LastEdgesOrderCases'
import { buildLastEdgesOrderGuide as buildLastEdgesGuide, lastEdgesOrderChoices, lastEdgesOrderDone } from '../guide/lastEdgesOrder'
import { edgeCell } from '../cells'

const card = { padding: '12px', border: '1px solid var(--rb-border)', borderRadius: 'var(--rb-r-md)', background: 'var(--rb-surface-1)' } as const
const text = { fontSize: '13px', lineHeight: 1.5, color: 'var(--rb-text-muted)' } as const
const tokenOf = (move: string) => layerTurnToToken(notationToTurn(move), 3)
interface Plan { guide: LastEdgesGuide; index: number; quarterDone?: boolean; off?: boolean }

export default function LastEdgesLessonView({ faceColors, colorNames, cube, moveCount, onUndo, onLoadSetup, onHighlightTurn, onSpotlight, onMark, practice, onPracticeChange, onExit }: TopCrossLessonViewProps) {
  const [selectedCase, setSelectedCase] = useState(1)
  const [practiceCase, setPracticeCase] = useState<number | null>(null)
  const [selectedFrames, setSelectedFrames] = useState<LastEdgesSelectedFrames>({})
  const [formulaRounds, setFormulaRounds] = useState(0)
  const practiceFrames = useRef<LastEdgesSelectedFrames>({})
  const [plan, setPlan] = useState<Plan | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [hints, setHints] = useState(0)
  const [preferredFront, setPreferredFront] = useState<Face | null>(null)
  const lastSetup = useRef<ReturnType<typeof generateLastEdgesCaseScramble>>()
  const solved = !!cube && lastEdgesDone(cube)
  const liveChoices = cube ? lastEdgesOrderChoices(cube) : []
  const requestedFront = preferredFront ?? practiceFrames.current[formulaRounds + 1]
  const liveChoice = liveChoices.find((v) => v.front === requestedFront) ?? liveChoices[0]
  const load = () => {
    const setup = generateLastEdgesCaseScramble(selectedCase, Math.random, lastSetup.current)
    lastSetup.current = setup
    setPracticeCase(selectedCase); setPlan(null); setMessage(null); setHints(0); setPreferredFront(null); setFormulaRounds(0)
    practiceFrames.current = { ...selectedFrames }
    onHighlightTurn(null); onMark(null); onLoadSetup(setup)
  }
  const askHint = () => {
    if (!cube || plan || solved) return
    if (!topCrossDone(cube)) {
      setMessage('Cần giữ hai tầng trên và dấu cộng vàng như cuối Bài 5. Hoàn tác nước xoay nhầm hoặc bấm Xáo lại tổ hợp này để bắt đầu lại.')
      return
    }
    const guide = buildLastEdgesGuide(cube, colorNames, liveChoice?.front)
    if (!guide) { setMessage('Không nhận diện được trạng thái. Bấm Xáo lại tổ hợp này để bắt đầu lại.'); return }
    setPlan({ guide, index: 0 }); setMessage(null); setHints((n) => n + 1)
  }
  const seenCube = useRef(cube)
  useEffect(() => {
    if (seenCube.current === cube) return
    seenCube.current = cube
    if (!cube || !plan) return
    const at = locateOnGuide(plan.guide, cube)
    if (at.kind === 'done') {
      setPlan(null)
      setPreferredFront(null)
      if (plan.guide.kind !== 'align') setFormulaRounds((n) => n + 1)
      setMessage(plan.guide.kind === 'prepare' ? 'Đã xong lượt chuẩn bị. Nhìn thứ tự mới và chọn mốc cho lượt cuối; bấm Gợi ý để tiếp tục.' : 'Thứ tự bốn cạnh đã đúng. Nếu cả vòng còn lệch, bấm Gợi ý để căn D lần cuối.')
    } else if (at.kind === 'step') {
      setPlan({ guide: plan.guide, index: at.index, quarterDone: at.quarterDone }); setMessage(null)
    } else {
      setPlan({ ...plan, off: true })
      setMessage('Bạn đã xoay khác hướng dẫn. Bấm Hoàn tác để quay lại; gợi ý sẽ tiếp tục từ chỗ cũ.')
    }
  }, [cube, plan])
  useEffect(() => {
    onHighlightTurn(practice && plan && !plan.off ? tokenOf(plan.guide.steps[plan.index]!.notation) : null)
    onMark(practice && cube && practiceCase !== null && !solved && !plan?.off ? (plan ? [edgeCell(cube.ep.indexOf(plan.guide.piece))] : [4, 5, 6, 7].map(edgeCell)) : null)
  }, [practice, cube, practiceCase, plan, solved, onHighlightTurn, onMark])

  const banner = <div data-no-typing role="note" style={{ ...card, borderColor: 'var(--rb-accent-tint-border)', ...text }}>
    <strong style={{ color: 'var(--rb-text)' }}>Tầng cuối: thứ tự bốn cạnh</strong><br />
    Giữ trắng ở U, vàng ở D. Lấy tâm D vàng làm mốc đáy, xét thứ tự bốn cạnh; bỏ qua các ô xám. Các góc học ở bài sau.
  </div>
  const step = plan?.guide.steps[plan.index]
  return <LessonPlayer label="Bài 6" pages={LESSON6_PAGES}
    onEnter={(page) => { onSpotlight(null); if (page.id !== 'practice') onPracticeChange(false) }}
    onLeave={() => { onSpotlight(null); onMark(null); onHighlightTurn(null); onPracticeChange(false) }}
    onExit={onExit}
    practiceFor={(page) => page.id === 'practice' ? { active: practice, onToggle: () => { if (!practice && (practiceCase !== selectedCase || !cube)) load(); onPracticeChange(!practice) } } : undefined}
    renderPage={(page) => <>
      {banner}
      {practice && page.id === 'practice' ? <>
        <div data-no-typing style={{ ...card, ...text }}>
          <strong style={{ color: 'var(--rb-text)' }}>Đang luyện tổ hợp {practiceCase ?? selectedCase}</strong>
          <div>Khối 3D có đúng bốn màu cạnh ở các vị trí như tổ hợp đã chọn. Gợi ý đi theo mặt mốc bạn chọn ở phần minh hoạ.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button type="button" className="rb-btn rb-btn--secondary" style={{ minHeight: '44px', height: 'auto', whiteSpace: 'normal' }} onClick={load}>Xáo lại tổ hợp này</button>
          <button type="button" className="rb-btn rb-btn--secondary" style={{ minHeight: '44px' }} onClick={() => onPracticeChange(false)}>Đổi tổ hợp</button>
        </div>
        {practiceCase !== null && cube && <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            {[['Thứ tự vòng', lastEdgesOrderDone(cube) ? 'Đã đúng' : 'Chưa đúng'], ['Nước đi', moveCount], ['Gợi ý', hints]].map(([label, value]) => <div data-no-typing key={label} style={{ ...card, textAlign: 'center', ...text }}><div data-no-typing>{label}</div><strong style={{ fontSize: '18px', color: 'var(--rb-text)' }}>{value}</strong></div>)}
          </div>
          {!plan && topCrossDone(cube) && <>
            <LastEdgesDiagram state={cube} faceColors={faceColors} colorNames={colorNames} anchor={liveChoice?.front} direction={liveChoice?.direction} label="Thứ tự bốn cạnh và chiều di chuyển theo mốc đã chọn" />
            <div style={text}>Giữ màu bốn cạnh và tâm D vàng làm mốc đáy. Đọc theo vòng F → R → B → L; các ô còn lại đều xám.</div>
            {!!liveChoices.length && <div role="group" aria-label="Chọn cạnh giữ lại làm mốc khi thực hành" style={{ display: 'grid', gap: '6px' }}>
              {liveChoices.map((v) => <button key={v.front} type="button" className="rb-btn rb-btn--secondary" aria-pressed={liveChoice?.front === v.front} style={{ minHeight: '44px', height: 'auto', whiteSpace: 'normal', padding: '8px' }} onClick={() => setPreferredFront(v.front)}>
                Giữ cạnh {colorNames[EDGE_COLORS[cube.ep[v.anchor]!]![1]]} ở {v.front} · bắt đầu bằng {String(v.moves[0]).replace("'", '′')}
              </button>)}
            </div>}
            {liveChoice && <div style={text}>Các nước cần làm trên khối của bạn, với mốc đã chọn: <strong>{liveChoice.moves.join(' ').replaceAll("'", '′')}</strong>. Bấm Gợi ý để đi từng nước theo lựa chọn này.</div>}
          </>}
          {plan && !plan.off && step && <div data-no-typing role="status" aria-live="polite" style={{ ...card, display: 'grid', gap: '8px', borderColor: 'var(--rb-accent-link)' }}>
            <strong style={{ color: 'var(--rb-text)', fontSize: '14px' }}>{plan.guide.title}</strong>
            {plan.guide.front && <div style={{ ...text, color: 'var(--rb-accent-link)' }}>F mốc: vị trí {plan.guide.front} · {plan.guide.direction === 'right' ? 'chiều bắt đầu R′' : 'chiều bắt đầu L'} theo mốc</div>}
            <div style={text}>{plan.guide.intro}</div>
            {plan.index === 0 && plan.guide.front && <>
              <LastEdgesDiagram state={plan.guide.states[plan.guide.alignmentSteps]!} faceColors={faceColors} colorNames={colorNames} anchor={plan.guide.front} direction={plan.guide.direction ?? undefined} label="Cạnh giữ lại và chiều đổi vòng theo lựa chọn" />
              <div style={text}>Khung nét đứt là vị trí có cạnh giữ lại sau trọn lượt. Chọn theo thứ tự bốn cạnh, không theo màu tâm.</div>
            </>}
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--rb-accent-link)' }}>{plan.guide.formula}</div>
            <div style={text}>Xoay đúng các mặt như chuỗi trên, không cần đổi cách cầm; chuỗi đã ghi sẵn theo F mốc vừa chọn.</div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className="rb-move-hero" style={{ width: '56px', height: '56px', fontSize: '24px', flex: 'none' }}>{step.notation}</div>
              <div style={text}><strong>Bước {plan.index + 1}/{plan.guide.steps.length}</strong><br />{step.why}
                {step.notation.endsWith('2') && <div style={{ color: 'var(--rb-accent-link)' }}>{plan.quarterDone ? 'Đã xoay một lần; xoay thêm một lần cùng chiều.' : 'Nửa vòng: xoay hai lần cùng chiều.'}</div>}
              </div>
            </div>
          </div>}
          {(message || solved) && <div role="status" className="rb-alert" style={text}>{solved ? 'Đã xong Bài 6: bốn cạnh khớp tâm, dấu cộng vàng và hai tầng trên được giữ. Các góc sẽ học ở Bài 7–8.' : message}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button type="button" className="rb-btn rb-btn--secondary" style={{ minHeight: '44px' }} disabled={solved || !!plan} onClick={askHint}>Gợi ý</button>
            <button type="button" className="rb-btn rb-btn--secondary" style={{ minHeight: '44px' }} disabled={moveCount === 0} onClick={onUndo}>Hoàn tác</button>
          </div>
        </>}
      </> : <>
        {page.id === 'goal' && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '4px' }}>
            {([['Cạnh đang sai vị trí', LAST_EDGES_EXCHANGE_PICTURE.before], ['Cạnh đã đúng vị trí', LAST_EDGES_EXCHANGE_PICTURE.after]] as const).map(([label, state], i) => <div key={label} style={{ display: 'contents' }}>
              {i === 1 && <span aria-hidden="true" style={{ color: 'var(--rb-accent-link)', fontSize: '20px' }}>→</span>}
              <div style={{ minWidth: 0, textAlign: 'center', ...text }}>
                <MiniCube view="below" facelets={toFacelets(state)} faceColors={faceColors} label={label} spotlight={{ kind: 'cells', cells: [4, 5, 6, 7].map(edgeCell) }} />
                <div data-no-typing>{label}</div>
              </div>
            </div>)}
          </div>
          <div data-no-typing style={text}>Theo dõi bốn cạnh đang sáng: ở ảnh sau, màu bên hông của chúng đã khớp tâm. Các góc chưa cần đúng ở bài này.</div>
        </>}
        {page.body.map((paragraph) => <p key={paragraph} data-no-typing={paragraph === LAST_EDGES_FINAL_ALIGNMENT_NOTE} style={{ ...text, fontSize: '14px', margin: 0, color: paragraph === LAST_EDGES_FINAL_ALIGNMENT_NOTE ? 'var(--rb-accent-link)' : 'var(--rb-text)', ...(paragraph === LAST_EDGES_FINAL_ALIGNMENT_NOTE ? { padding: '12px', borderLeft: '3px solid var(--rb-accent-link)', background: 'var(--rb-accent-tint)', borderRadius: 'var(--rb-r-sm)' } : {}) }}>{paragraph === LAST_EDGES_FINAL_ALIGNMENT_NOTE ? <strong>{paragraph}</strong> : paragraph}</p>)}
        {page.id === 'movement' && LAST_EDGES_FORMULA_PICTURES.map((example) => <div data-no-typing key={example.direction} style={{ ...card, ...text }}>
          <strong style={{ color: 'var(--rb-text)' }}>Giữ cạnh F · vòng {example.route}</strong>
          <LastEdgesDiagram state={example.before} faceColors={faceColors} colorNames={colorNames} label={`Giữ cạnh F, ba cạnh di chuyển ${example.route}`} anchor="F" direction={example.direction} />
          <div>F trong khung nét đứt giữ nguyên. Cả bốn cạnh giữa hàng dưới giữ màu; cạnh F đứng yên, ba cạnh R, L và B đổi chỗ theo mũi tên. Mọi ô khác đều xám.</div>
        </div>)}
        {page.id === 'formulas' && LAST_EDGES_FORMULA_PICTURES.map((example) => <LastEdgesFormulaExample key={example.direction} example={example} faceColors={faceColors} colorNames={colorNames} />)}
        {page.id === 'practice' && <LastEdgesOrderCases faceColors={faceColors} colorNames={colorNames} selectedCaseIndex={selectedCase} onCaseChange={(index) => { setSelectedCase(index); setSelectedFrames({}) }} selectedFrames={selectedFrames} onFrameChange={(round, front) => setSelectedFrames((prev) => round === 1 ? { 1: front } : { ...prev, [round]: front })} />}
        <div data-no-typing style={{ ...card, ...text, borderColor: 'var(--rb-accent-tint-border)' }}><strong>Vì sao?</strong><br />{page.reason}</div>
      </>}
    </>}
  />
}
