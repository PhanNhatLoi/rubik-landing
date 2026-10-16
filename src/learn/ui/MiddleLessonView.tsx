import { useEffect, useMemo, useRef, useState } from 'react'
import type { Face, CubieState, Move } from '../../smart-solver/core/types'
import { applyMoves, equals, SOLVED } from '../../smart-solver/core/cubie'
import { toFacelets } from '../../smart-solver/core/facelets'
import { MIDDLE, edgeDone, firstLayerDone } from '../goals'
import type { SpotlightTarget } from '../../smart-solver/adapter/types'
import { edgeCell, middleEdgeCells, crossEdgeCells, firstCornerCells } from '../cells'
import { MIDDLE_LEVELS, MIDDLE_PICTURE_SCRAMBLE, LESSON4_PAGES, MIDDLE_FORMULAS, generateMiddleScramble, type MiddleLevelId } from '../copy/lesson4'
import { buildMiddleGuide, type MiddleGuide } from '../guide/middleGuide'
import { notationToTurn } from '../guide/physical'
import { layerTurnToToken } from '../../smart-solver/adapter/nxnModel'
import { locateOnGuide } from '../guide/follow'
import LessonPlayer from './LessonPlayer'
import MiniCube from './MiniCube'

export interface MiddleLessonViewProps {
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
  guide: MiddleGuide
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

export default function MiddleLessonView({
  faceColors,
  cube,
  moveCount,
  onUndo,
  onLoadSetup,
  onHighlightMove,
  onHighlightTurn,
  onSpotlight,
  onMark,
  colorNames,
  practice,
  onPracticeChange,
  onExit
}: MiddleLessonViewProps) {
  // The picture: the first layer is done and the middle edges are in the top layer, then the same cube once they are in place.
  const picture = useMemo(() => {
    const before = applyMoves(SOLVED, MIDDLE_PICTURE_SCRAMBLE)
    let after = before
    for (let i = 0; i < 4; i += 1) {
      const guide = buildMiddleGuide(after, DEFAULT_NAMES)
      if (!guide) break
      after = guide.states[guide.states.length - 1]!
    }
    const spot = (state: CubieState) => [{ kind: 'centers' as const }, { kind: 'cells' as const, cells: middleEdgeCells(state) }]
    const keep = (state: CubieState) => ({ kind: 'cells' as const, cells: [...crossEdgeCells(state), ...firstCornerCells(state)] })
    return {
      before: toFacelets(before),
      after: toFacelets(after),
      beforeSpot: spot(before),
      afterSpot: spot(after),
      beforeKeep: keep(before),
      afterKeep: keep(after)
    }
  }, [])

  const [level, setLevel] = useState<MiddleLevelId | null>(null)
  const lastSetup = useRef<Move[] | undefined>(undefined)
  const [plan, setPlan] = useState<HintPlan | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [hints, setHints] = useState(0)

  const done = cube ? MIDDLE.filter((e) => edgeDone(cube, e)).length : 0
  const solved = cube ? firstLayerDone(cube) && done === 4 : false

  const loadLevel = (id: MiddleLevelId) => {
    // Every pick is a fresh random scramble of that level.
    const setup = generateMiddleScramble(id, Math.random, lastSetup.current)
    lastSetup.current = setup
    setLevel(id)
    setPlan(null)
    setMessage(null)
    setHints(0)
    onHighlightTurn(null)
    onLoadSetup(setup)
  }

  const askHint = () => {
    if (!cube) return
    if (!firstLayerDone(cube)) {
      setMessage('Tầng đầu (dấu cộng và 4 góc ở mặt trên) đang bị lệch. Hoàn tác nước vừa xoay nhầm, hoặc trả các khối ở trên về chỗ cũ, rồi bấm Gợi ý lại.')
      return
    }
    const guide = buildMiddleGuide(cube, colorNames)
    if (!guide) {
      setMessage('Cả 4 cạnh tầng giữa đã đúng chỗ.')
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
      setMessage(`Xong ${guide.edge}! Bấm Gợi ý để làm tiếp cạnh khác, hoặc tự làm.`)
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

  // Glow the edges still to place; while a guide is open, only the center of the face being built and
  // the one edge it moves.
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
      onMark(plan.guide.marks[plan.index]!)
      return
    }
    const pieces = MIDDLE.filter((e) => !edgeDone(cube, e))
    onMark(pieces.map((e) => edgeCell(cube.ep.indexOf(e))))
  }, [practice, cube, level, plan, onMark])

  const banner = (
    <div
      role="note"
      style={{ ...card, borderColor: 'var(--rb-accent-tint-border)', background: 'var(--rb-accent-tint)' }}
    >
      <div className="rb-overline" style={{ fontSize: '11px', color: 'var(--rb-accent-link)' }}>Đang lắp</div>
      <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--rb-text)', marginTop: '2px' }}>
        Tầng giữa — 4 cạnh giữa các mặt bên
      </div>
      <div style={{ fontSize: '12.5px', color: 'var(--rb-text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
        Tầng đầu (mặt trên {colorNames.U}) đã xong. Cạnh của tầng giữa là cạnh không có màu {colorNames.U} hay {colorNames.D}.
        {practice && ' Các cạnh đang phát sáng là những cạnh cần đưa vào tầng giữa.'}
      </div>
    </div>
  )

  const step = plan ? plan.guide.steps[plan.index]! : null

  return (
    <LessonPlayer
      label="Bài 4"
      pages={LESSON4_PAGES}
      onEnter={() => onSpotlight(null)}
      onLeave={() => {
        onSpotlight(null)
        onHighlightTurn(null)
        onMark(null)
        onPracticeChange(false)
      }}
      onExit={onExit}
      practiceFor={() => ({ active: practice, onToggle: () => onPracticeChange(!practice) })}
      renderPage={(page) =>
        practice ? (
          <>
            {banner}
            <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--rb-text-muted)', lineHeight: 1.5 }}>
              Chọn một mức độ: khối 3D sẽ được xáo theo mức đó. Hãy tự thử trước, cần thì bấm Gợi ý.
            </p>
            <div className="rb-seg" role="tablist" aria-label="Mức độ">
              {MIDDLE_LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={level === l.id}
                  className="rb-seg__item"
                  style={{ minHeight: '40px', height: '40px', fontSize: '13px' }}
                  onClick={() => loadLevel(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
            {level && (
              <div style={{ fontSize: '12px', color: 'var(--rb-text-subtle)' }}>
                {MIDDLE_LEVELS.find((l) => l.id === level)!.desc} · chạm lại mức này để xáo ngẫu nhiên lại
              </div>
            )}

            {level && cube && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div style={{ ...card, textAlign: 'center' }}>
                    <div className="rb-overline" style={{ fontSize: '10px' }}>Cạnh đúng</div>
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
                    Hoàn thành tầng giữa! Chạm lại mức độ để xáo lại ngẫu nhiên, hoặc chọn mức khó hơn.
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
                        Cạnh {plan.guide.edge} · {plan.guide.title}
                      </div>
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
                  <button type="button" className="rb-btn rb-btn--secondary" style={{ height: '44px' }} disabled={solved} onClick={askHint}>
                    Gợi ý
                  </button>
                  <button type="button" className="rb-btn rb-btn--secondary" style={{ height: '44px' }} disabled={moveCount === 0} onClick={onUndo}>
                    Hoàn tác
                  </button>
                </div>
              </>
            )}
          </>
        ) : page.kind === 'middleFormula' ? (
          <>
            {page.body.map((text, i) => (
              <p key={i} style={{ margin: 0, fontSize: '14px', color: 'var(--rb-text)', lineHeight: 1.5 }}>
                {text}
              </p>
            ))}
            {MIDDLE_FORMULAS.map((f) => {
              const moving = (state: CubieState) => ({ kind: 'cells' as const, cells: [[1, 1, 2], edgeCell(state.ep.indexOf(f.edgePiece))] })
              const view = f.target === 'L' ? 'frontLeft' : 'front'
              return (
                <div key={f.id} style={card}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--rb-text)' }}>{f.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--rb-text-muted)', marginTop: '6px', lineHeight: 1.6 }}>
                    <strong>Bước 1:</strong> D hoặc D′ (hoặc D2) để cạnh cùng mặt với tâm cùng màu<br />
                    <strong>Bước 2:</strong> <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--rb-accent-link)', letterSpacing: '0.5px' }}>{f.moves.join(' ').replace(/'/g, '′')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0, maxWidth: '170px', textAlign: 'center' }}>
                      <MiniCube facelets={toFacelets(f.before)} faceColors={faceColors} view={view} label={`Trước khi ${f.title.toLowerCase()}`} spotlight={moving(f.before)} grayRest />
                      <div style={{ fontSize: '12px', color: 'var(--rb-text-muted)' }}>Trước</div>
                    </div>
                    <div style={{ flex: 'none', color: 'var(--rb-accent-link)' }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="4" y1="12" x2="20" y2="12" />
                        <polyline points="14 6 20 12 14 18" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, maxWidth: '170px', textAlign: 'center' }}>
                      <MiniCube facelets={toFacelets(f.after)} faceColors={faceColors} view={view} label={`Sau khi ${f.title.toLowerCase()}`} spotlight={moving(f.after)} grayRest />
                      <div style={{ fontSize: '12px', color: 'var(--rb-text-muted)' }}>Sau</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--rb-text-subtle)', textAlign: 'center', marginTop: '6px' }}>
                    Chỉ tâm mặt F (mặt mốc) và cạnh cần lắp có màu. Các khối khác để xám.
                  </div>
                </div>
              )
            })}
            <div style={{ fontSize: '12.5px', color: 'var(--rb-text-muted)', lineHeight: 1.5 }}>
              Hai công thức viết khi mặt mốc là mặt {colorNames.F} (F). Nếu mặt mốc là mặt khác, giữ nguyên D và đổi tên các mặt còn lại theo vòng F → R → B → L → F (ví dụ mặt mốc là {colorNames.R}: F thành R, L thành F). Gợi ý trong phần Thực hành tự đổi sẵn cho bạn.
            </div>
            <div style={{ ...card, borderColor: 'var(--rb-accent-tint-border)' }}>
              <div className="rb-overline" style={{ fontSize: '11px', color: 'var(--rb-accent-link)', marginBottom: '4px' }}>Vì sao?</div>
              {page.reason.map((text, i) => (
                <p key={i} style={{ margin: i ? '6px 0 0' : 0, fontSize: '13px', color: 'var(--rb-text-soft)', lineHeight: 1.5 }}>
                  {text}
                </p>
              ))}
            </div>
          </>
        ) : (
          <>
            {banner}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <div style={{ flex: 1, minWidth: 0, maxWidth: '190px', textAlign: 'center' }}>
                <MiniCube facelets={picture.before} faceColors={faceColors} label="Khối trước khi lắp tầng giữa" spotlight={picture.beforeSpot} keep={picture.beforeKeep} grayRest />
                <div style={{ fontSize: '12px', color: 'var(--rb-text-muted)' }}>Trước khi lắp</div>
              </div>
              <div style={{ flex: 'none', textAlign: 'center', color: 'var(--rb-accent-link)' }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <polyline points="14 6 20 12 14 18" />
                </svg>
                <div style={{ fontSize: '11px', color: 'var(--rb-text-muted)' }}>sau khi lắp</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, maxWidth: '190px', textAlign: 'center' }}>
                <MiniCube facelets={picture.after} faceColors={faceColors} label="Khối sau khi lắp tầng giữa" spotlight={picture.afterSpot} keep={picture.afterKeep} grayRest />
                <div style={{ fontSize: '12px', color: 'var(--rb-text-muted)' }}>Tầng giữa đã đúng chỗ</div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--rb-text-subtle)', textAlign: 'center' }}>
              Phần phát sáng: 6 tâm (mốc cố định) và 4 cạnh tầng giữa. Tầng đầu đã làm ở Bài 2–3 giữ màu, không phát sáng. Các phần còn lại chưa cần đúng.
            </div>

            {page.body.map((text, i) => (
              <p key={i} style={{ margin: 0, fontSize: '14px', color: 'var(--rb-text)', lineHeight: 1.5 }}>
                {text}
              </p>
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
