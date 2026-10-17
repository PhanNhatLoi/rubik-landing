import FormulaPreview from './FormulaPreview'
import { useEffect, useRef, useState } from 'react'
import { lastEdgesDone } from '../guide/lastEdgesGuide'
import { buildLastCornersGuide, correctLastCorners, cornerName, cornerPlace, LAST_CORNERS_LEFT, LAST_CORNERS_RIGHT, LAST_CORNERS_VARIANTS, lastCornerClue, lastCornersChoices, lastCornersPositionDone, type LastCornersGuide } from '../guide/lastCornersGuide'
import { generateLastCornersScramble, LAST_CORNERS_COMBINATIONS, LAST_CORNERS_DEFAULT_COMBINATION, LAST_CORNERS_FORMULA_PICTURES, LESSON7_PAGES } from '../copy/lesson7'
import { locateOnGuide } from '../guide/follow'
import { notationToTurn } from '../guide/physical'
import { layerTurnToToken } from '../../smart-solver/adapter/nxnModel'
import { cornerCell } from '../cells'
import type { TopCrossLessonViewProps } from './TopCrossLessonView'
import LessonPlayer from './LessonPlayer'
import LastCornersDiagram from './LastCornersDiagram'
import LastCornersCases, { type LastCornersFrames } from './LastCornersCases'

const card = { padding: '12px', border: '1px solid var(--rb-border)', borderRadius: 'var(--rb-r-md)', background: 'var(--rb-surface-1)' } as const
const text = { fontSize: '13px', lineHeight: 1.5, color: 'var(--rb-text-muted)' } as const
const notation = (moves: readonly string[]) => moves.join(' ').replaceAll("'", '′')
interface Plan { guide: LastCornersGuide; index: number; off?: boolean }
export type LastCornersLessonViewProps = TopCrossLessonViewProps

export default function LastCornersLessonView({ faceColors, colorNames, cube, moveCount, onUndo, onLoadSetup, onHighlightTurn, onSpotlight, onMark, practice, onPracticeChange, onExit }: LastCornersLessonViewProps) {
  const [combination, setCombination] = useState(LAST_CORNERS_DEFAULT_COMBINATION)
  const [frames, setFrames] = useState<LastCornersFrames>({})
  const [practiceCombination, setPracticeCombination] = useState<number | null>(null)
  const [rounds, setRounds] = useState(0)
  const practiceFrames = useRef<LastCornersFrames>({})
  const [preferred, setPreferred] = useState<string | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [hints, setHints] = useState(0)
  const previousSetup = useRef<ReturnType<typeof generateLastCornersScramble>>()
  const solved = !!cube && lastCornersPositionDone(cube)
  const choices = cube ? lastCornersChoices(cube) : []
  const selected = choices.find((v) => v.id === (preferred ?? practiceFrames.current[rounds + 1])) ?? choices[0]
  const load = () => {
    const setup = generateLastCornersScramble(combination, Math.random, previousSetup.current)
    previousSetup.current = setup
    practiceFrames.current = { ...frames }
    setPracticeCombination(combination); setPlan(null); setMessage(null); setHints(0); setRounds(0); setPreferred(null)
    onHighlightTurn(null); onMark(null); onLoadSetup(setup)
  }
  const askHint = () => {
    if (!cube || plan || solved) return
    if (!lastEdgesDone(cube)) { setMessage('Cần hoàn thành Bài 6 và căn D để các cạnh đúng vị trí. Hoàn tác nước xoay nhầm hoặc xáo lại tổ hợp này.'); return }
    const guide = buildLastCornersGuide(cube, colorNames, selected?.id)
    if (!guide) { setMessage('Không nhận diện được trường hợp hợp lệ. Hoàn tác hoặc xáo lại tổ hợp này.'); return }
    setPlan({ guide, index: 0 }); setMessage(null); setHints((n) => n + 1)
  }
  const seen = useRef(cube)
  useEffect(() => {
    if (seen.current === cube) return
    seen.current = cube
    if (!cube || !plan) return
    const at = locateOnGuide(plan.guide, cube)
    if (at.kind === 'done') {
      setPlan(null); setPreferred(null); setRounds((n) => n + 1)
      setMessage(plan.guide.kind === 'prepare' ? 'Đã có một góc đúng vị trí. Tìm góc bên cạnh có 2/3 màu chung và xin Gợi ý cho lượt cuối.' : 'Bốn góc đã đúng vị trí. Dừng ở đây; việc lật góc sẽ học ở Bài 8.')
    } else if (at.kind === 'step') {
      setPlan({ guide: plan.guide, index: at.index }); setMessage(null)
    } else {
      setPlan({ ...plan, off: true }); setMessage('Bạn đã xoay khác hướng dẫn. Bấm Hoàn tác để quay lại; gợi ý sẽ tiếp tục từ chỗ cũ.')
    }
  }, [cube, plan])
  useEffect(() => {
    const move = practice && plan && !plan.off ? plan.guide.steps[plan.index]!.notation : null
    onHighlightTurn(move ? layerTurnToToken(notationToTurn(move), 3) : null)
    onMark(practice && cube && practiceCombination !== null && !plan?.off ? plan ? [cornerCell(cube.cp.indexOf(plan.guide.piece))] : [4, 5, 6, 7].filter((i) => cube.cp[i] !== i).map(cornerCell) : null)
  }, [practice, cube, practiceCombination, plan, onHighlightTurn, onMark])
  const step = plan?.guide.steps[plan.index]
  return <LessonPlayer label="Bài 7" pages={LESSON7_PAGES}
    onEnter={(page) => { onSpotlight(null); if (page.id !== 'practice') onPracticeChange(false) }}
    onLeave={() => { onSpotlight(null); onHighlightTurn(null); onMark(null); onPracticeChange(false) }} onExit={onExit}
    practiceFor={(page) => page.id === 'practice' ? { active: practice, onToggle: () => { if (!practice && (practiceCombination !== combination || !cube)) load(); onPracticeChange(!practice) } } : undefined}
    renderPage={(page) => <>
      <div data-no-typing role="note" style={{ ...card, ...text, borderColor: 'var(--rb-accent-tint-border)' }}><strong style={{ color: 'var(--rb-text)' }}>Chỉ đưa góc về đúng vị trí, chưa lật góc</strong><br />Giữ trắng trên U, vàng dưới D. Các cạnh đã đúng từ Bài 6 phải giữ nguyên sau mỗi lượt.</div>
      {practice && page.id === 'practice' ? <>
        <div data-no-typing style={{ ...card, ...text }}><strong>Đang luyện tổ hợp {(practiceCombination ?? combination) + 1}</strong><br />Bốn khối góc ở đúng vị trí như hình đã chọn; Gợi ý theo lựa chọn mốc của bạn.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button type="button" className="rb-btn rb-btn--secondary" style={{ minHeight: '44px', height: 'auto', whiteSpace: 'normal' }} onClick={load}>Xáo lại tổ hợp này</button>
          <button type="button" className="rb-btn rb-btn--secondary" style={{ minHeight: '44px' }} onClick={() => onPracticeChange(false)}>Đổi tổ hợp</button>
        </div>
        {cube && practiceCombination !== null && <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            {[['Góc đúng chỗ', `${correctLastCorners(cube).length}/4`], ['Nước đi', moveCount], ['Gợi ý', hints]].map(([label, value]) => <div data-no-typing key={label} style={{ ...card, ...text, textAlign: 'center' }}><div>{label}</div><strong style={{ fontSize: '18px', color: 'var(--rb-text)' }}>{value}</strong></div>)}
          </div>
          {!plan && lastEdgesDone(cube) && <>
            <LastCornersDiagram state={cube} faceColors={faceColors} colorNames={colorNames} variant={selected} clue={lastCornerClue(cube)} label="Bốn góc tầng đáy: đối chiếu bộ ba màu và chọn chiều" />
            {choices.length > 1 && <label style={{ ...text, display: 'grid', gap: '6px' }}>Chọn góc giữ lại và phía áp dụng
              <select aria-label="Chọn mốc khi thực hành góc" value={selected?.id} onChange={(e) => setPreferred(e.target.value)} style={{ width: '100%', minHeight: '44px', border: '1px solid var(--rb-border)', borderRadius: 'var(--rb-r-sm)', padding: '8px', background: 'var(--rb-surface-2)', color: 'var(--rb-text)' }}>
                {choices.map((v) => <option key={v.id} value={v.id}>Giữ {cornerPlace(v.anchor, colorNames)} · mặt mốc {colorNames[v.front]} · bắt đầu bằng {String(v.moves[0]).replace("'", '′')}</option>)}
              </select>
            </label>}
            {selected && <div style={text}>Giữ {cornerPlace(selected.anchor, colorNames)}, chọn mặt {colorNames[selected.front]} làm F mốc. Chuỗi theo vị trí cố định: <strong>{notation(selected.moves)}</strong>.</div>}
          </>}
          {plan && step && !plan.off && <div data-no-typing role="status" aria-live="polite" style={{ ...card, display: 'grid', gap: '10px', ...text, borderColor: 'var(--rb-accent-link)' }}>
            <strong style={{ color: 'var(--rb-text)' }}>{plan.guide.title}</strong>
            <div>{plan.guide.intro}</div>
            <div>Giữ {cornerPlace(plan.guide.variant.anchor, colorNames)} · mặt mốc {colorNames[plan.guide.variant.front]} · bắt đầu bằng {String(plan.guide.variant.moves[0]).replace("'", '′')}</div>
            <strong style={{ color: 'var(--rb-accent-link)', fontSize: '16px' }}>{plan.guide.formula}</strong>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}><div className="rb-move-hero" style={{ width: '56px', height: '56px', flex: 'none', fontSize: '24px' }}>{step.notation}</div><div><strong>Bước {plan.index + 1}/{plan.guide.steps.length}</strong><br />{step.why}</div></div>
          </div>}
          {(message || solved) && <div role="status" className="rb-alert" style={text}>{solved ? 'Đã xong Bài 7: cả bốn góc đúng vị trí. Mặt vàng chưa kín vẫn đúng — phần lật góc để Bài 8.' : message}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button type="button" className="rb-btn rb-btn--secondary" style={{ minHeight: '44px' }} disabled={!!plan || solved} onClick={askHint}>Gợi ý</button>
            <button type="button" className="rb-btn rb-btn--secondary" style={{ minHeight: '44px' }} disabled={moveCount === 0} onClick={onUndo}>Hoàn tác</button>
          </div>
        </>}
      </> : <>
        {page.body.map((paragraph) => <p key={paragraph} style={{ ...text, margin: 0, fontSize: '14px', color: 'var(--rb-text)' }}>{paragraph}</p>)}
        {page.id === 'goal' && <>
          <LastCornersDiagram state={LAST_CORNERS_FORMULA_PICTURES[0]!.before} faceColors={faceColors} colorNames={colorNames} variant={LAST_CORNERS_VARIANTS.find((v) => v.front === 'F' && v.side === 'right')} label="Trước một lượt đổi góc: một góc giữ lại (khung nét đứt), ba góc còn lại đi vòng" />
          <details style={text}><summary style={{ minHeight: '44px', cursor: 'pointer' }}>Xem sau một lượt: bốn góc đúng chỗ, chưa cần lật mặt</summary><LastCornersDiagram state={LAST_CORNERS_FORMULA_PICTURES[0]!.after} faceColors={faceColors} colorNames={colorNames} label="Bốn góc đúng vị trí nhưng có góc chưa lật đúng mặt" /></details>
        </>}
        {page.id === 'recognize' && <>
          <LastCornersDiagram state={LAST_CORNERS_FORMULA_PICTURES[0]!.before} faceColors={faceColors} colorNames={colorNames} variant={LAST_CORNERS_VARIANTS.find((v) => v.front === 'F' && v.side === 'right')} clue={lastCornerClue(LAST_CORNERS_FORMULA_PICTURES[0]!.before)} label="Giữ một góc đúng chỗ, tìm góc bên cạnh có vàng và một màu chung với vị trí" />
          <div data-no-typing style={{ ...card, ...text }}>So bộ màu của mỗi góc với ba ô “Cần”. ✓ là đúng vị trí dù ô vàng đang ở bên hông. Viền cam là góc bên cạnh có 2/3 màu chung; đưa nó đến góc đối diện mốc.</div>
        </>}
        {page.id === 'formula' && LAST_CORNERS_FORMULA_PICTURES.map((example) => {
          const v = LAST_CORNERS_VARIANTS.find((v) => v.front === 'F' && v.side === example.side)!
          return <div data-no-typing key={example.side} style={{ ...card, ...text, display: 'grid', gap: '8px' }}>
            <strong style={{ color: 'var(--rb-text)' }}>Giữ {cornerPlace(v.anchor, colorNames)} (khung nét đứt) · ba góc còn lại đi vòng theo mũi tên</strong>
            <strong style={{ color: 'var(--rb-accent-link)', fontSize: '16px' }}>{notation(example.side === 'right' ? LAST_CORNERS_RIGHT : LAST_CORNERS_LEFT)}</strong>
            <FormulaPreview state={example.before} moves={example.moves} faceColors={faceColors} label={`Giữ ${cornerPlace(v.anchor, colorNames)}`} view="below" cells={[4, 5, 6, 7].map(cornerCell)} result="Đã đổi vị trí ba góc, giữ một góc mốc. Cả bốn góc đúng chỗ; hướng của góc để Bài 8." />
            <LastCornersDiagram state={example.before} faceColors={faceColors} colorNames={colorNames} variant={v} label={`Trước công thức giữ ${cornerPlace(v.anchor, colorNames)}`} />
            <details><summary style={{ minHeight: '44px', cursor: 'pointer' }}>Xem kết quả sau đủ 10 nước</summary><LastCornersDiagram state={example.after} faceColors={faceColors} colorNames={colorNames} label="Sau công thức, góc đúng vị trí nhưng có thể còn bị xoắn" /></details>
          </div>
        })}
        {page.id === 'practice' && <LastCornersCases faceColors={faceColors} colorNames={colorNames} combination={combination} onCombinationChange={(index) => { setCombination(index); setFrames({}) }} frames={frames} onVariantChange={(round, id) => setFrames((prev) => round === 1 ? { 1: id } : { ...prev, [round]: id })} />}
        <div data-no-typing style={{ ...card, ...text, borderColor: 'var(--rb-accent-tint-border)' }}><strong>Vì sao?</strong><br />{page.reason}</div>
      </>}
    </>} />
}
