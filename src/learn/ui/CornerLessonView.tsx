import { useEffect, useMemo, useRef, useState } from 'react'
import type { Face, CubieState, Move } from '../../smart-solver/core/types'
import { applyMoves, equals, SOLVED } from '../../smart-solver/core/cubie'
import { toFacelets } from '../../smart-solver/core/facelets'
import { D_CORNERS, cornerDone, crossDone } from '../../smart-solver/nxn/beginner'
import type { SpotlightTarget } from '../../smart-solver/adapter/types'
import { bottomCornerCells, cornerCell } from '../cells'
import { CORNER_LEVELS, CORNER_PICTURE_SCRAMBLE, LESSON3_PAGES, generateCornerScramble, type CornerLevelId } from '../copy/lesson3'
import { buildCornerGuide, type CornerGuide } from '../guide/cornerGuide'
import { notationToTurn } from '../guide/physical'
import { layerTurnToToken } from '../../smart-solver/adapter/nxnModel'
import { locateOnGuide } from '../guide/follow'
import LessonPlayer from './LessonPlayer'
import MiniCube from './MiniCube'

export interface CornerLessonViewProps {
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
  guide: CornerGuide
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

export default function CornerLessonView({
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
}: CornerLessonViewProps) {
  // The picture: the cross is done and the corners are scattered, then the same cube once its corners are in place.
  const picture = useMemo(() => {
    const before = applyMoves(SOLVED, CORNER_PICTURE_SCRAMBLE)
    let after = before
    for (let i = 0; i < 4; i += 1) {
      const guide = buildCornerGuide(after, DEFAULT_NAMES)
      if (!guide) break
      after = guide.states[guide.states.length - 1]!
    }
    const spot = (state: CubieState) => [{ kind: 'centers' as const }, { kind: 'cells' as const, cells: bottomCornerCells(state) }]
    return {
      before: toFacelets(before),
      after: toFacelets(after),
      beforeSpot: spot(before),
      afterSpot: spot(after)
    }
  }, [])

  const [level, setLevel] = useState<CornerLevelId | null>(null)
  const lastSetup = useRef<Move[] | undefined>(undefined)
  const [plan, setPlan] = useState<HintPlan | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [hints, setHints] = useState(0)

  const done = cube ? D_CORNERS.filter((c) => cornerDone(cube, c)).length : 0
  const solved = cube ? crossDone(cube) && done === 4 : false

  const loadLevel = (id: CornerLevelId) => {
    // Every pick is a fresh random scramble of that level.
    const setup = generateCornerScramble(id, Math.random, lastSetup.current)
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
    if (!crossDone(cube)) {
      setMessage('Dấu cộng ở mặt đáy đang bị lệch. Hoàn tác nước vừa xoay nhầm, hoặc trả các cạnh ở đáy về chỗ cũ, rồi bấm Gợi ý lại.')
      return
    }
    const guide = buildCornerGuide(cube, colorNames)
    if (!guide) {
      setMessage('Cả 4 góc đã đúng chỗ.')
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
      setMessage(`Xong ${guide.corner}! Bấm Gợi ý để làm tiếp góc khác, hoặc tự làm.`)
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
      onMark([plan.guide.centerCells[plan.index]!, plan.guide.pieceCells[plan.index]!])
      return
    }
    const pieces = D_CORNERS.filter((c) => !cornerDone(cube, c))
    onMark(pieces.map((c) => cornerCell(cube.cp.indexOf(c))))
  }, [practice, cube, level, plan, onMark])

  const banner = (
    <div
      role="note"
      style={{ ...card, borderColor: 'var(--rb-accent-tint-border)', background: 'var(--rb-accent-tint)' }}
    >
      <div className="rb-overline" style={{ fontSize: '11px', color: 'var(--rb-accent-link)' }}>Đang lắp</div>
      <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--rb-text)', marginTop: '2px' }}>
        Mặt đáy (D) — màu {colorNames.D}
      </div>
      <div style={{ fontSize: '12.5px', color: 'var(--rb-text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
        Dấu cộng ở mặt đáy đã xong; giờ gắn 4 góc vào mặt này (mặt đối diện mặt {colorNames.U}, không phải mặt trên).
        {practice && ' Các góc đang phát sáng là những góc cần đưa về mặt đáy; kéo nền để xoay khối và nhìn thấy mặt đáy.'}
      </div>
    </div>
  )

  const step = plan ? plan.guide.steps[plan.index]! : null

  return (
    <LessonPlayer
      label="Bài 3"
      pages={LESSON3_PAGES}
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
              {CORNER_LEVELS.map((l) => (
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
                {CORNER_LEVELS.find((l) => l.id === level)!.desc} · chạm lại mức này để xáo ngẫu nhiên lại
              </div>
            )}

            {level && cube && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div style={{ ...card, textAlign: 'center' }}>
                    <div className="rb-overline" style={{ fontSize: '10px' }}>Góc đúng</div>
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
                    Hoàn thành tầng đầu! Chạm lại mức độ để xáo lại ngẫu nhiên, hoặc chọn mức khó hơn.
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
                        Góc {plan.guide.corner} · {plan.guide.title}
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
        ) : (
          <>
            {banner}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <div style={{ flex: 1, minWidth: 0, maxWidth: '190px', textAlign: 'center' }}>
                <MiniCube facelets={picture.before} faceColors={faceColors} label="Khối trước khi lắp góc" spotlight={picture.beforeSpot} />
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
                <MiniCube facelets={picture.after} faceColors={faceColors} label="Khối sau khi lắp góc" spotlight={picture.afterSpot} view="below" />
                <div style={{ fontSize: '12px', color: 'var(--rb-text-muted)' }}>Tầng đầu hoàn chỉnh (nhìn từ đáy)</div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--rb-text-subtle)', textAlign: 'center' }}>
              Phần phát sáng: 6 tâm (mốc cố định) và 4 khối góc. Các phần còn lại chưa cần đúng.
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
