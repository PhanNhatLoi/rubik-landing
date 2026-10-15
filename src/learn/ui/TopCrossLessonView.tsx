import { useEffect, useMemo, useRef, useState } from 'react'
import type { Face, CubieState, Move } from '../../smart-solver/core/types'
import { applyMoves, SOLVED } from '../../smart-solver/core/cubie'
import { toFacelets } from '../../smart-solver/core/facelets'
import { f2lDone, topCrossDone } from '../../smart-solver/nxn/beginner'
import type { SpotlightTarget } from '../../smart-solver/adapter/types'
import { edgeCell } from '../cells'
import { TOP_CROSS_LEVELS, TOP_CROSS_PICTURE_SCRAMBLE, TOP_CROSS_METHODS, getLesson5Pages, topCrossPracticeRoute, generateTopCrossScramble, type TopCrossLevelId } from '../copy/lesson5'
import { buildTopCrossGuide, topCrossPattern, PATTERN_LABEL, TOP_SLOTS, type TopCrossGuide, type TopCrossMethod } from '../guide/topCrossGuide'
import { notationToTurn } from '../guide/physical'
import { layerTurnToToken } from '../../smart-solver/adapter/nxnModel'
import { locateOnGuide } from '../guide/follow'
import LessonPlayer from './LessonPlayer'
import MiniCube from './MiniCube'

export interface TopCrossLessonViewProps {
  faceColors: Record<Face, number>
  /** The cube on the 3D scene while practicing (null until a level is loaded). */
  cube: CubieState | null
  moveCount: number
  onUndo: () => void
  /** Puts the scramble on the 3D cube. */
  onLoadSetup: (setup: Move[]) => void
  onHighlightMove: (move: Move | null) => void
  /** Lights the layer of a fixed-position turn (face or slice) with its arrows; null clears. */
  onHighlightTurn: (token: string | null) => void
  onSpotlight: (target: SpotlightTarget | null) => void
  /** Makes the pieces at these grid cells glow on the 3D cube (null clears). */
  onMark: (cells: number[][] | null) => void
  /** Color name of each face's center, by the face it belongs to. */
  colorNames: Record<Face, string>
  practice: boolean
  onPracticeChange: (practice: boolean) => void
  onExit: () => void
}

interface HintPlan {
  guide: TopCrossGuide
  /** Step the learner is on. */
  index: number
  /** A half-turn step with its first quarter done. */
  quarterDone?: boolean
  /** The cube is off the guide's path; waiting for an undo (or any move back onto it). */
  off?: boolean
}

const DEFAULT_NAMES = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }

const tokenOf = (notation: string) => layerTurnToToken(notationToTurn(notation), 3)

const card = {
  padding: '10px 12px',
  borderRadius: 'var(--rb-r-md)',
  background: 'var(--rb-surface-1)',
  border: '1px solid var(--rb-border)'
} as const

export default function TopCrossLessonView({
  faceColors,
  cube,
  moveCount,
  onUndo,
  onLoadSetup,
  onHighlightTurn,
  onSpotlight,
  onMark,
  colorNames,
  practice,
  onPracticeChange,
  onExit
}: TopCrossLessonViewProps) {
  const [method, setMethod] = useState<TopCrossMethod | null>(null)
  const pages = useMemo(() => getLesson5Pages(method), [method])

  // Show the very same cube before and after orienting its top edges; corners remain unfinished.
  const picture = useMemo(() => {
    const before = applyMoves(SOLVED, TOP_CROSS_PICTURE_SCRAMBLE)
    let after = before
    for (let i = 0; i < 4; i += 1) {
      const guide = buildTopCrossGuide(after, DEFAULT_NAMES, method ?? 'single')
      if (!guide) break
      after = guide.states[guide.states.length - 1]!
    }
    const spot = () => ({ kind: 'cells' as const, cells: [[1, 2, 1], ...TOP_SLOTS.map(edgeCell)] })
    return {
      before: toFacelets(before),
      after: toFacelets(after),
      beforeSpot: spot(),
      afterSpot: spot()
    }
  }, [method])

  const patterns = useMemo(() => TOP_CROSS_LEVELS.map((l) => {
    const state = applyMoves(SOLVED, generateTopCrossScramble(l.id, () => 0))
    return { label: PATTERN_LABEL[l.pattern], facelets: toFacelets(state) }
  }), [])

  const [level, setLevel] = useState<TopCrossLevelId | null>(null)
  const lastSetup = useRef<Move[] | undefined>(undefined)
  const [plan, setPlan] = useState<HintPlan | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [hints, setHints] = useState(0)

  const done = cube ? TOP_SLOTS.filter((e) => cube.ep[e]! < 4 && cube.eo[e] === 0).length : 0
  const solved = cube ? topCrossDone(cube) : false

  const loadLevel = (id: TopCrossLevelId) => {
    // Every pick is a fresh random scramble of that level.
    const setup = generateTopCrossScramble(id, Math.random, lastSetup.current)
    lastSetup.current = setup
    setLevel(id)
    setPlan(null)
    setMessage(null)
    setHints(0)
    onHighlightTurn(null)
    onLoadSetup(setup)
  }

  const chooseMethod = (next: TopCrossMethod) => {
    if (next === method) return
    setMethod(next)
    setPlan(null)
    setMessage(null)
    setHints(0)
    onPracticeChange(false)
    onHighlightTurn(null)
    onMark(null)
    // A formula must not change under the learner halfway through a turn sequence.
    if (lastSetup.current) onLoadSetup(lastSetup.current)
  }

  const askHint = () => {
    if (!cube || plan || !method) return
    if (!f2lDone(cube)) {
      setMessage('Hai tầng dưới đang bị lệch. Hoàn tác nước xoay nhầm hoặc chọn lại mức độ để bắt đầu từ khối mẫu, rồi bấm Gợi ý lại.')
      return
    }
    const guide = buildTopCrossGuide(cube, colorNames, method)
    if (!guide) {
      setMessage('Dấu cộng tầng trên đã xong.')
      return
    }
    setPlan({ guide, index: 0 })
    setMessage(null)
    setHints((h) => h + 1)
    onHighlightTurn(tokenOf(guide.steps[0]!.notation))
  }

  // Follow the learner through the guide. Any state on the path (a later step, or an earlier one after
  // an undo) resumes the guide from there, so a wrong turn only pauses it until it is undone.
  const seenCube = useRef(cube)
  useEffect(() => {
    if (seenCube.current === cube) return
    seenCube.current = cube
    if (!plan || !cube) return
    const { guide } = plan
    const where = locateOnGuide(guide, cube)
    if (where.kind === 'done') {
      setPlan(null)
      onHighlightTurn(null)
      setMessage(`Đã thành ${PATTERN_LABEL[guide.next].toLowerCase()}! Dừng quan sát, rồi bấm Gợi ý để làm lượt tiếp theo hoặc tự làm.`)
      return
    }
    if (where.kind === 'step') {
      setPlan({ guide, index: where.index, quarterDone: where.quarterDone })
      setMessage(null)
      onHighlightTurn(tokenOf(guide.steps[where.index]!.notation))
      return
    }
    setPlan({ guide, index: plan.index, off: true })
    onHighlightTurn(null)
    setMessage('Bạn đã xoay khác hướng dẫn. Bấm Hoàn tác để quay lại: hướng dẫn sẽ tiếp tục từ chỗ cũ.')
  }, [cube, plan, onHighlightTurn])

  useEffect(() => {
    if (solved && level) {
      setPlan(null)
      onHighlightTurn(null)
    }
  }, [solved, level, onHighlightTurn])

  // Follow just one edge during the formula; otherwise light only top edges still facing sideways.
  useEffect(() => {
    if (!practice || !cube || !level) {
      onMark(null)
      return
    }
    // Off the guide's path (the learner turned something else): nothing glows until they undo.
    if (plan?.off) {
      onMark(null)
      return
    }
    if (plan) {
      onMark([[1, 2, 1], edgeCell(cube.ep.indexOf(plan.guide.piece))])
      return
    }
    onMark(f2lDone(cube) ? TOP_SLOTS.filter((slot) => cube.eo[slot] !== 0).map(edgeCell) : null)
  }, [practice, cube, level, plan, onMark])

  useEffect(() => {
    onHighlightTurn(practice && plan && !plan.off ? tokenOf(plan.guide.steps[plan.index]!.notation) : null)
  }, [practice, plan, onHighlightTurn])

  const banner = (
    <div
      role="note"
      style={{ ...card, borderColor: 'var(--rb-accent-tint-border)', background: 'var(--rb-accent-tint)' }}
    >
      <div className="rb-overline" style={{ fontSize: '11px', color: 'var(--rb-accent-link)' }}>Đang lắp</div>
      <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--rb-text)', marginTop: '2px' }}>
        Mặt trên — dấu cộng quanh tâm {colorNames.U}
      </div>
      <div style={{ fontSize: '12.5px', color: 'var(--rb-text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
        Hai tầng dưới đã xong, mặt đáy {colorNames.D} vẫn ở dưới. Đưa 4 ô cạnh màu {colorNames.U} hướng lên; chưa cần khớp màu cạnh bên hay làm các góc.
        {practice && ' Các cạnh phát sáng cần được đổi hướng.'}
      </div>
    </div>
  )

  const step = plan ? plan.guide.steps[plan.index]! : null

  return (
    <LessonPlayer
      label="Bài 5"
      pages={pages}
      onEnter={(page) => {
        onSpotlight(null)
        if (page.id !== 'formula') onPracticeChange(false)
      }}
      onLeave={() => {
        onSpotlight(null)
        onHighlightTurn(null)
        onMark(null)
        onPracticeChange(false)
      }}
      onExit={onExit}
      practiceFor={(page) => method && page.id === 'formula' ? { active: practice, onToggle: () => onPracticeChange(!practice) } : undefined}
      renderPage={(page) =>
        practice && method && page.id === 'formula' ? (
          <>
            {banner}
            <div style={{ ...card, fontSize: '13px', color: 'var(--rb-accent-link)' }}>
              Cách học: {TOP_CROSS_METHODS.find((m) => m.id === method)!.title}. Gợi ý sẽ theo cách này.
            </div>
            <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--rb-text-muted)', lineHeight: 1.5 }}>
              Chọn một mức độ: khối 3D sẽ được xáo theo mức đó. Hãy tự thử trước, cần thì bấm Gợi ý.
            </p>
            <div className="rb-seg" role="tablist" aria-label="Mức độ">
              {TOP_CROSS_LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={level === l.id}
                  className="rb-seg__item"
                  style={{ minHeight: '44px', height: '44px', fontSize: '13px' }}
                  onClick={() => loadLevel(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
            {level && (
              <div style={{ fontSize: '12px', color: 'var(--rb-text-subtle)' }}>
                {topCrossPracticeRoute(level, method)} · chạm lại mức này để xáo ngẫu nhiên lại
              </div>
            )}

            {level && cube && (
              <>
                <div role="status" style={{ fontSize: '13px', color: 'var(--rb-text-muted)' }}>
                  {plan ? `Đang làm lượt: ${plan.guide.title}` : f2lDone(cube) ? `Hình hiện tại: ${PATTERN_LABEL[topCrossPattern(cube)]}` : 'Hãy khôi phục hai tầng dưới trước khi xin gợi ý.'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div style={{ ...card, textAlign: 'center' }}>
                    <div className="rb-overline" style={{ fontSize: '10px' }}>Cạnh hướng lên</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--rb-text)' }}>{done}/4</div>
                  </div>
                  <div style={{ ...card, textAlign: 'center' }}>
                    <div className="rb-overline" style={{ fontSize: '10px' }}>Nước đi</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--rb-text)' }}>{moveCount}</div>
                  </div>
                  <div style={{ ...card, textAlign: 'center' }}>
                    <div className="rb-overline" style={{ fontSize: '10px' }}>Gợi ý</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--rb-text)' }}>{hints}</div>
                  </div>
                </div>

                {solved && (
                  <div role="status" className="rb-alert" style={{ fontSize: '13px' }}>
                    Đã tạo dấu cộng tầng trên! Màu cạnh bên và các góc sẽ học ở bài sau. Chạm lại mức độ để xáo lại ngẫu nhiên, hoặc chọn mức khó hơn.
                  </div>
                )}

                {!solved && step && plan && !plan.off && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="rb-card"
                    style={{ padding: '12px 14px', gap: '10px', flexDirection: 'column', alignItems: 'stretch', background: 'var(--rb-surface-2)', border: '1px solid var(--rb-accent-2)' }}
                  >
                    <div>
                      <div className="rb-overline" style={{ fontSize: '10px', color: 'var(--rb-accent-2)' }}>
                        {plan.guide.title} · theo dõi cạnh {plan.guide.edge}
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--rb-text)' }}>{plan.guide.formula}</div>
                      {plan.index === 0 && (
                        <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--rb-text-muted)', lineHeight: 1.5 }}>{plan.guide.intro}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div className="rb-move-hero" style={{ width: '56px', height: '56px', fontSize: '24px', flex: 'none' }}>{step.notation}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="rb-overline" style={{ fontSize: '10px', color: 'var(--rb-accent-2)' }}>
                          Bước {plan.index + 1}/{plan.guide.steps.length}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--rb-text)', lineHeight: 1.5 }}>{step.why}</div>
                        {step.notation.endsWith('2') && (
                          <div style={{ fontSize: '12.5px', color: 'var(--rb-accent-link)', marginTop: '4px', fontWeight: 600 }}>
                            {plan.quarterDone
                              ? 'Đã xoay 1/2 lần. Xoay thêm một lần nữa theo cùng chiều để đủ nửa vòng.'
                              : `${step.notation} là nửa vòng: xoay 2 lần liên tiếp theo cùng một chiều.`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {message && !solved && (
                  <div role="status" className="rb-alert" style={{ fontSize: '12.5px', padding: '8px 12px' }}>
                    {message}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button type="button" className="rb-btn rb-btn--secondary" style={{ height: '44px' }} disabled={solved || !!plan} onClick={askHint}>
                    Gợi ý
                  </button>
                  <button type="button" className="rb-btn rb-btn--secondary" style={{ height: '44px' }} disabled={moveCount === 0} onClick={onUndo}>
                    Hoàn tác
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {banner}
            {page.id === 'top-cross' && <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <div style={{ flex: 1, minWidth: 0, maxWidth: '190px', textAlign: 'center' }}>
                <MiniCube facelets={picture.before} faceColors={faceColors} label="Khối trước khi tạo dấu cộng tầng trên" spotlight={picture.beforeSpot} />
                <div style={{ fontSize: '12px', color: 'var(--rb-text-muted)' }}>Trước khi tạo dấu cộng</div>
              </div>
              <div style={{ flex: 'none', textAlign: 'center', color: 'var(--rb-accent-link)' }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <polyline points="14 6 20 12 14 18" />
                </svg>
                <div style={{ fontSize: '11px', color: 'var(--rb-text-muted)' }}>sau khi xoay</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, maxWidth: '190px', textAlign: 'center' }}>
                <MiniCube facelets={picture.after} faceColors={faceColors} label="Khối sau khi tạo dấu cộng tầng trên" spotlight={picture.afterSpot} />
                <div style={{ fontSize: '12px', color: 'var(--rb-text-muted)' }}>Dấu cộng đã xong</div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--rb-text-subtle)', textAlign: 'center' }}>
              Phần phát sáng: tâm U và 4 cạnh tầng trên. Chỉ màu hướng lên cần khớp tâm; bỏ qua các góc và màu cạnh bên.
            </div>

            </>}

            {page.id === 'patterns' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }}>
                {patterns.map((p) => (
                  <div key={p.label} style={{ minWidth: 0, textAlign: 'center' }}>
                    <MiniCube facelets={p.facelets} faceColors={faceColors} label={`Mẫu ${p.label.toLowerCase()} ở mặt trên`} spotlight={{ kind: 'cells', cells: [[1, 2, 1], ...TOP_SLOTS.map(edgeCell)] }} />
                    <div style={{ fontSize: '12px', color: 'var(--rb-text-muted)' }}>{p.label}</div>
                  </div>
                ))}
              </div>
            )}

            {page.body.map((text, i) => (
              <p key={i} style={{ margin: 0, fontSize: '14px', color: 'var(--rb-text)', lineHeight: 1.5 }}>
                {text}
              </p>
            ))}
            {page.id === 'method' && (
              <>
                <div role="radiogroup" aria-label="Cách học dấu cộng tầng trên" style={{ display: 'grid', gap: '10px' }}>
                  {TOP_CROSS_METHODS.map((option) => (
                    <label key={option.id} style={{ ...card, display: 'flex', gap: '10px', alignItems: 'flex-start', minHeight: '44px', cursor: 'pointer', borderColor: method === option.id ? 'var(--rb-accent-link)' : 'var(--rb-border)' }}>
                      <input type="radio" name="top-cross-method" value={option.id} checked={method === option.id} onChange={() => chooseMethod(option.id)} style={{ marginTop: '4px', accentColor: 'var(--rb-accent-link)' }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--rb-text)' }}>{option.title}</span>
                        <span style={{ display: 'block', fontSize: '13px', lineHeight: 1.5, color: 'var(--rb-text-muted)', marginTop: '4px' }}>{option.desc}</span>
                        <span style={{ display: 'block', fontSize: '12px', lineHeight: 1.5, color: 'var(--rb-text-subtle)', marginTop: '4px' }}>{option.route}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div role="status" aria-live="polite" style={{ fontSize: '13px', color: 'var(--rb-accent-link)' }}>
                  {method ? `Đã chọn: ${TOP_CROSS_METHODS.find((m) => m.id === method)!.title}. Bấm Tiếp theo để tìm hiểu công thức và thực hành.` : 'Chọn một cách học để mở phần công thức và thực hành.'}
                </div>
              </>
            )}

            {page.formulas?.map((formula) => (
              <div key={formula.title} style={{ ...card, display: 'grid', gap: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--rb-text)' }}>{formula.title}</div>
                <div style={{ fontSize: '13px', color: 'var(--rb-text-muted)', lineHeight: 1.5 }}>{formula.alignment}</div>
                <div aria-label={`Công thức: ${formula.formula}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'stretch' }}>
                  {formula.phases.map(([label, notation]) => (
                    <div key={label} style={{ padding: '8px', borderRadius: 'var(--rb-r-sm)', background: 'var(--rb-surface-2)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--rb-text-muted)' }}>{label}</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--rb-accent-link)', marginTop: '3px' }}>{notation}</div>
                    </div>
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: 'var(--rb-text-muted)' }}>{formula.explanation}</p>
                {formula.source && <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.5, color: 'var(--rb-text-muted)' }}>{formula.source}</p>}
                <div style={{ fontSize: '13px', color: 'var(--rb-accent-link)' }}>{formula.result}</div>
              </div>
            ))}

            <div style={{ ...card, borderColor: 'var(--rb-accent-tint-border)' }}>
              <div className="rb-overline" style={{ fontSize: '11px', color: 'var(--rb-accent-link)', marginBottom: '4px' }}>Vì sao?</div>
              {page.reason.map((text, i) => (
                <p key={i} style={{ margin: i ? '6px 0 0' : 0, fontSize: '13px', color: 'var(--rb-text-soft)', lineHeight: 1.5 }}>
                  {text}
                </p>
              ))}
            </div>
          </>
        )
      }
    />
  )
}
