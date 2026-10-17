import { useEffect, useRef, useState } from 'react'
import { applyMoves } from '../../smart-solver/core/cubie'
import { CORNER_FACELETS, toFacelets } from '../../smart-solver/core/facelets'
import type { CubieState, Face } from '../../smart-solver/core/types'
import { layerTurnToToken } from '../../smart-solver/adapter/nxnModel'
import { LAST_FACE_DEFAULT, LAST_FACE_CASES, LESSON8_PAGES, LAST_FACE_FORMULA_PICTURES, LAST_FACE_GOAL_PICTURE } from '../copy/lesson8'
import { buildLastFaceGuide, compactHalfTurns, formulaTokens, LAST_FACE_SAMPLES, lastFaceChoices, lastFaceDone, type LastFaceVariant } from '../guide/lastFaceGuide'
import { cornerPlace, lastCornersPositionDone } from '../guide/lastCornersGuide'
import { locateOnGuide } from '../guide/follow'
import { notationToTurn } from '../guide/physical'
import { cornerCell } from '../cells'
import type { TopCrossLessonViewProps } from './TopCrossLessonView'
import LessonPlayer from './LessonPlayer'
import LastFaceDiagram from './LastFaceDiagram'
import LastFaceFormulaCard from './LastFaceFormulaCard'
import MiniCube from './MiniCube'

const card = { padding: '12px', border: '1px solid var(--rb-border)', borderRadius: 'var(--rb-r-md)', background: 'var(--rb-surface-1)' } as const
const text = { fontSize: '13px', lineHeight: 1.5, color: 'var(--rb-text-muted)' } as const
const notation = (moves: readonly string[]) => compactHalfTurns(moves).replaceAll("'", '′')
const firstMove = (variant: LastFaceVariant) => String(variant.moves[0]).replace("'", '′')
const label = (variant: LastFaceVariant, names: Record<Face, string>) => `Mặt ${names[variant.front]} làm F mốc · ${cornerPlace(variant.corner, names)} · bắt đầu bằng ${firstMove(variant)}`

type Guide = NonNullable<ReturnType<typeof buildLastFaceGuide>>
interface Plan { guide: Guide; index: number; off?: boolean }

export default function LastFaceLessonView({ faceColors, colorNames, cube, moveCount, onUndo, onLoadSetup, onHighlightTurn, onSpotlight, onMark, practice, onPracticeChange, onExit }: TopCrossLessonViewProps) {
  const [sample, setSample] = useState(LAST_FACE_DEFAULT)
  const [started, setStarted] = useState<number | null>(null)
  const [preferred, setPreferred] = useState<string | undefined>()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [hints, setHints] = useState(0)
  const example = LAST_FACE_SAMPLES[sample]!
  const shown = practice && cube ? cube : example.state
  const choices = lastFaceChoices(shown)
  const chosen = choices.find((v) => v.id === preferred) ?? choices[0]
  const solved = lastFaceDone(shown)

  const load = () => {
    setStarted(sample); setPlan(null); setMessage(null); setHints(0)
    onHighlightTurn(null); onMark(null); onLoadSetup(example.setup.slice())
  }
  const chooseSample = (index: number) => { setSample(index); setStarted(null); setPreferred(undefined) }
  const askHint = () => {
    if (!cube) return
    if (!lastCornersPositionDone(cube)) { setMessage('Cần hoàn thành Bài 7 trước. Hoàn tác nước sai hoặc tải lại mẫu này.'); return }
    const guide = buildLastFaceGuide(cube, chosen?.id)
    if (guide) { setPlan({ guide, index: 0 }); setMessage(null); setHints((n) => n + 1) }
  }

  const seen = useRef(cube)
  useEffect(() => {
    if (seen.current === cube) return
    seen.current = cube
    // A status message belongs to the cube it was shown for: any later move or undo clears it.
    if (!plan) setMessage(null)
    if (!cube || !plan) return
    const at = locateOnGuide(plan.guide, cube)
    if (at.kind === 'done') {
      setPlan(null); setPreferred(undefined)
      setMessage('Đã đủ hai nửa: cạnh và vị trí góc trở lại đúng. Quan sát màu dưới góc, xin Gợi ý cho lượt tiếp theo nếu cần.')
    } else if (at.kind === 'step') {
      setPlan({ guide: plan.guide, index: at.index }); setMessage(null)
    } else {
      setPlan({ ...plan, off: true }); setMessage('Nước xoay khác hướng dẫn. Bấm Hoàn tác để trở lại rồi tiếp tục công thức.')
    }
  }, [cube, plan])
  useEffect(() => {
    const step = practice && plan && !plan.off ? plan.guide.steps[plan.index] : null
    onHighlightTurn(step ? layerTurnToToken(notationToTurn(step.notation), 3) : null)
    onMark(practice && cube && !plan?.off ? (plan ? plan.guide.variant.affected : chosen?.affected ?? []).map((i) => cornerCell(cube.cp.indexOf(i))) : null)
  }, [practice, cube, plan, chosen, onHighlightTurn, onMark])

  const diagram = (state: CubieState, variant?: LastFaceVariant, description = 'Các góc và tâm quanh mặt D') =>
    <LastFaceDiagram state={state} faceColors={faceColors} colorNames={colorNames} variant={variant} label={description} />

  /** The suggested reference face and its two halves; the formula is left out on the recognition page. */
  const recommendation = (state: CubieState, includeFormula = true) => {
    const options = lastFaceChoices(state)
    const selected = options.find((v) => v.id === preferred) ?? options[0]
    if (!selected) return <div role="status" style={{ ...text, color: 'var(--rb-success-text)' }}>Bốn góc đã đúng mặt. Rubik đã hoàn thành, không cần công thức.</div>
    return <div style={{ display: 'grid', gap: '10px' }}>
      <strong style={{ color: 'var(--rb-accent-link)' }}>Đề xuất: mặt {colorNames[selected.front]} làm F mốc · bắt đầu {firstMove(selected)}</strong>
      <div>Ô dưới của {cornerPlace(selected.corner, colorNames)} có màu <strong>{colorNames[selected.front]}</strong>, trùng tâm mặt mốc. Chọn bản bắt đầu bên <strong>{selected.side === 'right' ? 'phải' : 'trái'}</strong> khi nhìn từ mặt mốc đó.</div>
      {options.length > 1 && <details>
        <summary style={{ minHeight: '44px', cursor: 'pointer', color: 'var(--rb-accent-link)' }}>Xem cách chọn mốc khác</summary>
        <label style={{ display: 'grid', gap: '6px' }}>Chọn mặt mốc và phía bắt đầu
          <select aria-label="Chọn mặt mốc lật góc" value={selected.id} onChange={(e) => setPreferred(e.target.value)} style={{ width: '100%', minHeight: '44px', padding: '8px', background: 'var(--rb-surface-2)', color: 'var(--rb-text)', border: '1px solid var(--rb-border)', borderRadius: 'var(--rb-r-sm)' }}>
            {options.map((v) => <option key={v.id} value={v.id}>{label(v, colorNames)}</option>)}
          </select>
        </label>
      </details>}
      {includeFormula && <div style={{ padding: '10px', display: 'grid', gap: '6px', border: '1px solid var(--rb-accent-tint-border)', borderRadius: 'var(--rb-r-sm)', background: 'var(--rb-accent-tint)' }}>
        <span>Các nước cần làm trên khối của bạn · đủ hai nửa:</span>
        <strong style={{ color: 'var(--rb-accent-link)', fontSize: '16px', lineHeight: 1.6 }}>{notation(selected.moves.slice(0, 8))} · {notation(selected.moves.slice(8))}</strong>
        <span>Xoay đúng các mặt đã ghi, không cần đổi cách cầm. Làm đủ cả lượt rồi mới quan sát và chọn mốc tiếp theo.</span>
      </div>}
    </div>
  }

  const teaching = LAST_FACE_GOAL_PICTURE.before
  const teachingVariant = LAST_FACE_GOAL_PICTURE.variant
  const teachingChoice = lastFaceChoices(teaching).find((v) => v.id === preferred) ?? teachingVariant
  const step = plan?.guide.steps[plan.index]
  // The formula is read with D2 as one turn, while the guide tracks each quarter turn.
  const tokens = plan ? formulaTokens(plan.guide.steps.map((s) => s.notation)) : []
  const token = plan ? tokens.find((t) => plan.index >= t.from && plan.index <= t.to) : undefined

  return <LessonPlayer label="Bài 8" pages={LESSON8_PAGES} onExit={onExit}
    onEnter={(page) => { onSpotlight(null); if (page.id !== 'practice') onPracticeChange(false) }}
    onLeave={() => { onSpotlight(null); onHighlightTurn(null); onMark(null); onPracticeChange(false) }}
    practiceFor={(page) => page.id === 'practice' ? { active: practice, onToggle: () => { if (!practice && (started !== sample || !cube)) load(); onPracticeChange(!practice) } } : undefined}
    renderPage={(page) => <>
      <div data-no-typing role="note" style={{ ...card, ...text, borderColor: 'var(--rb-accent-tint-border)' }}>
        <strong style={{ color: 'var(--rb-text)' }}>Chỉ lật hướng góc, giữ nguyên vị trí các khối</strong><br />
        Giữ trắng trên U, vàng dưới D. Làm đủ cả hai nửa rồi mới chọn lượt tiếp theo.
      </div>
      {practice && page.id === 'practice' ? <>
        <div data-no-typing style={{ ...card, ...text }}>
          <strong>Đang luyện mẫu {example.wrong ? `${example.wrong} góc cần lật` : 'đã hoàn thành'}</strong><br />
          Khối được tải đúng mẫu đã chọn; Gợi ý theo mốc bạn chọn.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button type="button" className="rb-btn rb-btn--secondary" style={{ minHeight: '44px', height: 'auto', whiteSpace: 'normal' }} onClick={load}>Tải lại mẫu này</button>
          <button type="button" className="rb-btn rb-btn--secondary" style={{ minHeight: '44px' }} onClick={() => onPracticeChange(false)}>Đổi mẫu</button>
        </div>
        {cube && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          {[['Góc đúng mặt', `${4 - cube.co.slice(4).filter(Boolean).length}/4`], ['Nước đi', moveCount], ['Gợi ý', hints]].map(([name, value]) =>
            <div data-no-typing key={name} style={{ ...card, ...text, textAlign: 'center' }}><div>{name}</div><strong style={{ fontSize: '18px', color: 'var(--rb-text)' }}>{value}</strong></div>)}
        </div>}
        {!plan && <div data-no-typing style={{ ...card, ...text, display: 'grid', gap: '12px' }}>{diagram(shown, chosen)}{recommendation(shown)}</div>}
        {plan && step && token && !plan.off && <div data-no-typing role="status" aria-live="polite" style={{ ...card, ...text, display: 'grid', gap: '10px', borderColor: 'var(--rb-accent-link)' }}>
          <strong style={{ color: 'var(--rb-text)' }}>{label(plan.guide.variant, colorNames)}</strong>
          <strong style={{ color: 'var(--rb-accent-link)', fontSize: '16px' }}>{plan.guide.formula}</strong>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="rb-move-hero" style={{ width: '56px', height: '56px', flex: 'none', fontSize: '24px' }}>{token.token.replace("'", '′')}</div>
            <div>
              <strong>Nửa {plan.index < 8 ? 1 : 2}/2 · Nước {tokens.indexOf(token) + 1}/{tokens.length}</strong><br />
              {step.why}
              {token.to > token.from && <div style={{ color: 'var(--rb-accent-link)' }}>Nửa vòng: xoay hai lần cùng chiều ({plan.index - token.from + 1}/2).</div>}
            </div>
          </div>
        </div>}
        {(solved || message) && <div role="status" className="rb-alert" style={text}>{solved ? 'Đã hoàn thành Rubik! Bốn góc đúng mặt, các cạnh và hai tầng trên đều đúng.' : message}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button type="button" className="rb-btn rb-btn--secondary" style={{ minHeight: '44px' }} disabled={!!plan || solved || !cube} onClick={askHint}>Gợi ý</button>
          <button type="button" className="rb-btn rb-btn--secondary" style={{ minHeight: '44px' }} disabled={moveCount === 0} onClick={onUndo}>Hoàn tác</button>
        </div>
      </> : <>
        {page.body.map((paragraph) => <p key={paragraph} style={{ ...text, margin: 0, fontSize: '14px', color: 'var(--rb-text)' }}>{paragraph}</p>)}
        {page.id === 'goal' && <div data-no-typing style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '6px' }}>
          {([['Góc chưa đúng mặt', LAST_FACE_GOAL_PICTURE.before], ['Rubik đã hoàn thành', LAST_FACE_GOAL_PICTURE.after]] as const).map(([description, state], i) =>
            <div key={description} style={{ display: 'contents' }}>
              {i === 1 && <span aria-hidden="true" style={{ color: 'var(--rb-accent-link)', fontSize: '22px' }}>→</span>}
              <figure style={{ margin: 0, minWidth: 0, textAlign: 'center' }}>
                <MiniCube facelets={toFacelets(state)} faceColors={faceColors} label={description} view="below" grayRest
                  spotlight={{ kind: 'cells', cells: teachingVariant.affected.map(cornerCell) }}
                  keep={[{ kind: 'centers' }, { kind: 'cells', cells: [4, 5, 6, 7].map(cornerCell) }]} />
                <figcaption style={{ fontSize: '12px', color: 'var(--rb-text-muted)', lineHeight: 1.5 }}>{description}</figcaption>
              </figure>
            </div>)}
        </div>}
        {page.id === 'recognize' && <div data-no-typing style={{ ...card, ...text, display: 'grid', gap: '12px' }}>
          <strong style={{ color: 'var(--rb-text)' }}>Ô dưới góc và tâm mốc phải cùng màu</strong>
          {diagram(teaching, teachingChoice, 'So màu dưới góc với tâm mặt mốc')}
          {recommendation(teaching, false)}
        </div>}
        {page.id === 'formula' && LAST_FACE_FORMULA_PICTURES.map((item) => <LastFaceFormulaCard key={item.variant.id} example={item} faceColors={faceColors} />)}
        {page.id === 'practice' && <div style={{ ...text, display: 'grid', gap: '12px' }}>
          <div role="group" aria-label="Số góc cần lật" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {LAST_FACE_CASES.map((c) => {
              const active = example.wrong === c.wrong
              return <button key={c.wrong} type="button" className="rb-btn rb-btn--secondary" aria-pressed={active}
                style={{ height: 'auto', minHeight: '44px', whiteSpace: 'normal', background: active ? 'var(--rb-accent-tint)' : undefined, borderColor: active ? 'var(--rb-accent-link)' : undefined, color: active ? 'var(--rb-accent-link)' : undefined, fontWeight: active ? 700 : undefined }}
                onClick={() => chooseSample(LAST_FACE_SAMPLES.findIndex((s) => s.wrong === c.wrong))}>{active ? '✓ ' : ''}{c.label}</button>
            })}
          </div>
          <strong style={{ color: 'var(--rb-text)' }}>{solved ? 'Bốn góc đã đúng mặt. Không cần công thức.' : 'So màu dưới góc với tâm, chọn phía bắt đầu'}</strong>
          {example.wrong > 0 && <details key={sample} style={card}>
            <summary style={{ minHeight: '44px', cursor: 'pointer', color: 'var(--rb-accent-link)' }}>Xem thêm mẫu khác ({LAST_FACE_SAMPLES.filter((s) => s.wrong === example.wrong).length - 1})</summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {LAST_FACE_SAMPLES.map((s, i) => s.wrong === example.wrong && i !== sample ? <button key={i} type="button" className="rb-btn rb-btn--secondary" onClick={() => chooseSample(i)} style={{ height: 'auto', minHeight: '64px', display: 'grid', gap: '6px', padding: '8px' }}>
                <span>Mẫu {i + 1}</span>
                <span style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px' }}>
                  {[5, 4, 6, 7].map((slot) => {
                    const f = toFacelets(s.state)[CORNER_FACELETS[slot]![0]] as Face
                    return <span key={slot} title={`Ô dưới của ${cornerPlace(slot, colorNames)}: ${colorNames[f]}`} style={{ width: '18px', height: '18px', borderRadius: '3px', background: `#${faceColors[f].toString(16).padStart(6, '0')}` }} />
                  })}
                </span>
              </button> : null)}
            </div>
          </details>}
          <div data-no-typing style={{ ...card, display: 'grid', gap: '12px' }}>
            {diagram(shown, chosen)}{recommendation(shown)}
            {chosen && <details><summary style={{ minHeight: '44px', cursor: 'pointer' }}>Xem sau lượt đề xuất</summary>{diagram(applyMoves(shown, chosen.moves))}</details>}
          </div>
        </div>}
        <div data-no-typing style={{ ...card, ...text, borderColor: 'var(--rb-accent-tint-border)' }}><strong>Vì sao?</strong><br />{page.reason}</div>
      </>}
    </>} />
}
