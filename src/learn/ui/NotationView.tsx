import { useMemo, useState } from 'react'
import { FACES, type Face, type Move } from '../../smart-solver/core/types'
import { applyMoves, parseAlgorithm, SOLVED } from '../../smart-solver/core/cubie'
import { SOLVED_FACELETS, toFacelets } from '../../smart-solver/core/facelets'
import type { SpotlightTarget } from '../../smart-solver/adapter/types'
import { frameFor } from '../frame'
import { FACE_ROLE_NAME, LESSON1_PAGES, type Lesson1Page } from '../copy/lesson1'
import { notationToTurn } from '../guide/physical'
import { layerTurnToToken } from '../../smart-solver/adapter/nxnModel'
import LessonPlayer from './LessonPlayer'
import MiniCube from './MiniCube'

export interface NotationViewProps {
  onBack: () => void
  onHighlightMove?: (move: Move | null) => void
  /** Makes the pieces glow on the 3D cube (null clears). */
  onSpotlight?: (target: SpotlightTarget | null) => void
  /** Lights the layer of a fixed-position turn (face or slice) with its arrows; null clears. */
  onHighlightTurn?: (token: string | null) => void
  /** Color name of each face's center ("trắng", "xanh lá"...), by the face it belongs to. */
  colorNames?: Record<Face, string>
  /** Display color (0xRRGGBB) of each face, for the before/after cubes. */
  faceColors?: Record<Face, number>
  /** The 3D cube is on screen for practice. */
  practice?: boolean
  onPracticeChange?: (practice: boolean) => void
}

const DEFAULT_COLOR_NAMES: Record<Face, string> = { U: 'trắng', D: 'vàng', F: 'xanh lá', B: 'xanh dương', R: 'đỏ', L: 'cam' }
const DEFAULT_FACE_COLORS: Record<Face, number> = { U: 0xf4f4f4, D: 0xf4c430, F: 0x16c172, B: 0x2a6cff, R: 0xff4b3e, L: 0xff8c2b }
const viewOf = (face: Face): 'front' | 'back' => (face === 'U' || face === 'F' || face === 'R' ? 'front' : 'back')
const SLICE_INFO = { M: 'giữa L và R (cùng chiều L)', E: 'giữa U và D (cùng chiều D)', S: 'giữa F và B (cùng chiều F)' } as const
const SLICE_AXIS = { M: 'x', E: 'y', S: 'z' } as const
const ROLE_ORDER: readonly Face[] = ['U', 'D', 'R', 'L', 'F', 'B']
type Variant = '' | "'" | '2'
/** Each turn page unlocks one more option below the previous ones. */
const VARIANTS: readonly Variant[] = ['', "'", '2']
const VARIANT_INFO: Record<Variant, { text: string; desc: string }> = {
  '': { text: '', desc: 'xoay 1/4 vòng theo chiều kim đồng hồ' },
  "'": { text: '′', desc: 'xoay 1/4 vòng ngược chiều kim đồng hồ' },
  '2': { text: '2', desc: 'xoay nửa vòng (180°), chiều nào cũng như nhau' }
}

const card = {
  padding: '10px 12px',
  borderRadius: 'var(--rb-r-md)',
  background: 'var(--rb-surface-1)',
  border: '1px solid var(--rb-border)'
} as const

export default function NotationView({ onBack, onHighlightMove, onSpotlight, onHighlightTurn, colorNames = DEFAULT_COLOR_NAMES, faceColors = DEFAULT_FACE_COLORS, practice = false, onPracticeChange }: NotationViewProps) {
  const [front, setFront] = useState<Face>('F')
  const [turnRole, setTurnRole] = useState<Face>('U')
  const [turnVariant, setTurnVariant] = useState<Variant>('')
  const [slice, setSlice] = useState<'M' | 'E' | 'S'>('M')
  const [sliceVariant, setSliceVariant] = useState<Variant>('')
  const frame = useMemo(() => frameFor(front), [front])
  const name = (face: Face) => colorNames[face]

  const clear = () => {
    onSpotlight?.(null)
    onHighlightMove?.(null)
  }

  const figure = (children: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>{children}</div>
  )
  const mini = (
    facelets: string,
    label: string,
    caption?: string,
    extra: { spotlight?: SpotlightTarget | { kind: 'slice'; axis: 'x' | 'y' | 'z' }; view?: 'front' | 'back'; turns?: string[] } = {}
  ) => (
    <div style={{ flex: 1, minWidth: 0, maxWidth: '190px', textAlign: 'center' }}>
      <MiniCube facelets={facelets} faceColors={faceColors} label={label} spotlight={extra.spotlight ?? null} view={extra.view ?? 'front'} turns={extra.turns ?? []} />
      {caption && <div style={{ fontSize: '12px', color: 'var(--rb-text-muted)' }}>{caption}</div>}
    </div>
  )
  const arrow = (note?: string) => (
    <div style={{ flex: 'none', textAlign: 'center', color: 'var(--rb-accent-link)' }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="4" y1="12" x2="20" y2="12" />
        <polyline points="14 6 20 12 14 18" />
      </svg>
      {note && <div style={{ fontSize: '11px', color: 'var(--rb-text-muted)' }}>{note}</div>}
    </div>
  )

  const enter = (
    page: Lesson1Page,
    role: Face = turnRole,
    variant?: Variant,
    sliceLetter: 'M' | 'E' | 'S' = slice,
    sliceVariantNow: Variant = sliceVariant
  ) => {
    const frameNow = frame
    if (page.kind === 'text') {
      if (page.spotlight) onSpotlight?.(page.spotlight)
      else clear()
    } else if (page.kind === 'pickFront') onSpotlight?.({ kind: 'face', face: frameNow.F })
    else if (page.kind === 'face') onSpotlight?.({ kind: 'face', face: frameNow[page.role] })
    else if (page.kind === 'beforeAfter') clear()
    else if (page.kind === 'slice') onHighlightTurn?.(layerTurnToToken(notationToTurn(`${sliceLetter}${sliceVariantNow}`), 3))
    else onHighlightMove?.(`${frameNow[role]}${variant ?? page.variant}` as Move)
  }

  const frameSummary = (
    <div style={card}>
      <div style={{ fontSize: '12.5px', color: 'var(--rb-text-muted)', lineHeight: 1.5 }}>
        Mặt trước (F) bạn chọn là mặt <strong style={{ color: 'var(--rb-text)' }}>{name(front)}</strong>. Cầm khối sao cho mặt này hướng về bạn,
        mặt trên (U) là mặt <strong style={{ color: 'var(--rb-text)' }}>{name(frame.U)}</strong>.
        Đổi mặt trước thì F, U, R, L, D, B đều chuyển sang mặt khác.
      </div>
    </div>
  )

  return (
    <LessonPlayer
      label="Bài 1"
      pages={LESSON1_PAGES}
      onEnter={(page) => {
        if (page.kind === 'turn') setTurnVariant(page.variant)
        else if (page.kind === 'slice') setSliceVariant('')
        else onPracticeChange?.(false)
        enter(page, turnRole, undefined, slice, page.kind === 'slice' ? '' : sliceVariant)
      }}
      onLeave={() => {
        clear()
        onPracticeChange?.(false)
      }}
      onExit={() => {
        clear()
        onBack()
      }}
      practiceFor={(page) => ((page.kind === 'turn' || page.kind === 'slice') && onPracticeChange ? { active: practice, onToggle: () => onPracticeChange(!practice) } : undefined)}
      renderPage={(page) => (
        <>
          {page.kind === 'text' &&
            figure(
              page.spotlight ? (
                <>
                  {mini(SOLVED_FACELETS, 'Khối nhìn từ phía trước', 'Phía trước', { spotlight: page.spotlight })}
                  {mini(SOLVED_FACELETS, 'Khối nhìn từ phía sau', 'Phía sau', { spotlight: page.spotlight, view: 'back' })}
                </>
              ) : (
                mini(SOLVED_FACELETS, 'Khối Rubik 3x3')
              )
            )}
          {page.kind === 'pickFront' &&
            figure(mini(SOLVED_FACELETS, 'Mặt trước đã chọn', `Mặt trước: ${name(front)}`, { spotlight: { kind: 'face', face: frame.F }, view: viewOf(frame.F) }))}
          {page.kind === 'face' &&
            figure(
              mini(SOLVED_FACELETS, `Mặt ${page.role}`, `${page.role}: mặt ${name(frame[page.role])}`, {
                spotlight: { kind: 'face', face: frame[page.role] },
                view: viewOf(frame[page.role])
              })
            )}
          {page.kind === 'slice' &&
            (() => {
              const target = { kind: 'slice', axis: SLICE_AXIS[slice] } as const
              const turns = [`${slice}${sliceVariant}`]
              return figure(
                <>
                  {mini(SOLVED_FACELETS, 'Trước khi xoay', 'Trước', { spotlight: target })}
                  {arrow(`${slice}${VARIANT_INFO[sliceVariant].text}`)}
                  {mini(SOLVED_FACELETS, 'Sau khi xoay', 'Sau', { spotlight: target, turns })}
                </>
              )
            })()}
          {page.kind === 'turn' &&
            (() => {
              const v = VARIANTS.indexOf(turnVariant) <= VARIANTS.indexOf(page.variant) ? turnVariant : page.variant
              const actual = frame[turnRole]
              const target = { kind: 'face', face: actual } as const
              const after = toFacelets(applyMoves(SOLVED, [`${actual}${v}` as Move]))
              return figure(
                <>
                  {mini(SOLVED_FACELETS, 'Trước khi xoay', 'Trước', { spotlight: target, view: viewOf(actual) })}
                  {arrow(`${turnRole}${VARIANT_INFO[v].text}`)}
                  {mini(after, 'Sau khi xoay', 'Sau', { spotlight: target, view: viewOf(actual) })}
                </>
              )
            })()}
          {page.body.map((text, i) => (
            <p key={i} style={{ margin: 0, fontSize: '14px', color: 'var(--rb-text)', lineHeight: 1.5 }}>
              {text}
            </p>
          ))}

          {page.kind === 'text' && page.facts && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${page.facts.length}, 1fr)`, gap: '8px' }}>
              {page.facts.map((fact) => (
                <div key={fact.label} style={card}>
                  <div style={{ fontSize: '12px', color: 'var(--rb-text-muted)' }}>{fact.label}</div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--rb-text)', marginTop: '2px' }}>{fact.value}</div>
                </div>
              ))}
            </div>
          )}

          {page.kind === 'pickFront' && (
            <>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--rb-text)' }}>Bạn chọn mặt nào làm mặt trước?</div>
              <div className="rb-seg" role="tablist" aria-label="Chọn mặt trước" style={{ flexWrap: 'wrap' }}>
                {FACES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={front === f}
                    className="rb-seg__item"
                    style={{ minHeight: '40px', height: '40px', fontSize: '13px' }}
                    onClick={() => {
                      setFront(f)
                      onSpotlight?.({ kind: 'face', face: f })
                    }}
                  >
                    {name(f)}
                  </button>
                ))}
              </div>
              {frameSummary}
            </>
          )}

          {page.kind === 'face' && (
            <>
              <div style={card}>
                <div style={{ fontSize: '12px', color: 'var(--rb-text-muted)' }}>{page.name}</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--rb-text)', marginTop: '2px' }}>
                  Mặt {name(frame[page.role])} đang là {page.role}
                </div>
              </div>
              {frameSummary}
            </>
          )}

          {page.kind === 'beforeAfter' &&
            figure(
              <>
                {mini(toFacelets(applyMoves(SOLVED, parseAlgorithm(page.scramble))), 'Khối trước khi lắp', 'Trước khi lắp')}
                {arrow('sau khi lắp')}
                {mini(SOLVED_FACELETS, 'Khối hoàn thành', 'Khối hoàn thành')}
              </>
            )}

          {page.kind === 'slice' && (
            <>
              <div className="rb-seg" role="tablist" aria-label="Chọn lớp giữa">
                {(['M', 'E', 'S'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="tab"
                    aria-selected={slice === l}
                    className="rb-seg__item"
                    style={{ fontWeight: 600, fontSize: '13px', minHeight: '40px', height: '40px' }}
                    onClick={() => {
                      setSlice(l)
                      enter(page, turnRole, undefined, l, sliceVariant)
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {VARIANTS.map((v) => {
                  const selected = sliceVariant === v
                  return (
                    <button
                      key={v}
                      type="button"
                      className="rb-card"
                      aria-pressed={selected}
                      onClick={() => {
                        setSliceVariant(v)
                        enter(page, turnRole, undefined, slice, v)
                      }}
                      style={{
                        alignItems: 'center',
                        padding: '10px 14px',
                        gap: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        fontFamily: 'inherit',
                        background: selected ? 'var(--rb-surface-2)' : 'var(--rb-surface-1)',
                        borderColor: selected ? 'var(--rb-accent-tint-border)' : 'var(--rb-border)'
                      }}
                    >
                      <div
                        className="rb-move"
                        style={{
                          width: '48px',
                          height: '48px',
                          fontSize: '19px',
                          fontWeight: 700,
                          background: selected ? 'var(--rb-accent-gradient)' : 'var(--rb-surface-2)',
                          color: selected ? 'var(--rb-text-on-accent)' : 'var(--rb-text)'
                        }}
                      >
                        {slice}
                        {VARIANT_INFO[v].text}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, fontSize: '13px', color: 'var(--rb-text)', lineHeight: 1.4 }}>
                        Lớp giữa {SLICE_INFO[slice]}: {VARIANT_INFO[v].desc}.
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {page.kind === 'turn' && (
            <>
              <div className="rb-seg" role="tablist" aria-label="Chọn mặt để xem ký hiệu">
                {ROLE_ORDER.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="tab"
                    aria-selected={turnRole === r}
                    aria-label={`Mặt ${r}`}
                    className="rb-seg__item"
                    style={{ fontWeight: 600, fontSize: '13px', minHeight: '40px', height: '40px' }}
                    onClick={() => {
                      setTurnRole(r)
                      enter(page, r, VARIANTS.indexOf(turnVariant) <= VARIANTS.indexOf(page.variant) ? turnVariant : page.variant)
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {VARIANTS.slice(0, VARIANTS.indexOf(page.variant) + 1).map((v) => {
                  const selected = (VARIANTS.indexOf(turnVariant) <= VARIANTS.indexOf(page.variant) ? turnVariant : page.variant) === v
                  return (
                    <button
                      key={v}
                      type="button"
                      className="rb-card"
                      aria-pressed={selected}
                      onClick={() => {
                        setTurnVariant(v)
                        enter(page, turnRole, v)
                      }}
                      style={{
                        alignItems: 'center',
                        padding: '10px 14px',
                        gap: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        fontFamily: 'inherit',
                        background: selected ? 'var(--rb-surface-2)' : 'var(--rb-surface-1)',
                        borderColor: selected ? 'var(--rb-accent-tint-border)' : 'var(--rb-border)'
                      }}
                    >
                      <div
                        className="rb-move"
                        style={{
                          width: '48px',
                          height: '48px',
                          fontSize: '19px',
                          fontWeight: 700,
                          background: selected ? 'var(--rb-accent-gradient)' : 'var(--rb-surface-2)',
                          color: selected ? 'var(--rb-text-on-accent)' : 'var(--rb-text)'
                        }}
                      >
                        {turnRole}
                        {VARIANT_INFO[v].text}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, fontSize: '13px', color: 'var(--rb-text)', lineHeight: 1.4 }}>
                        {FACE_ROLE_NAME[turnRole].split(' – ')[1]} ({name(frame[turnRole])}): {VARIANT_INFO[v].desc}.
                      </div>
                    </button>
                  )
                })}
              </div>
              <div style={{ ...card, borderColor: 'var(--rb-accent-tint-border)' }}>
                <div style={{ fontSize: '12.5px', color: 'var(--rb-text-muted)', lineHeight: 1.5 }}>
                  Nhớ: ký hiệu tính theo mặt trước bạn đã chọn. Với mặt trước {name(front)}, chữ {turnRole} là mặt{' '}
                  <strong style={{ color: 'var(--rb-text)' }}>{name(frame[turnRole])}</strong>. Nếu chọn mặt trước khác, {turnRole} sẽ là mặt khác.
                </div>
              </div>
              {page.variant === '2' && (
                <div style={card}>
                  <div style={{ fontSize: '12.5px', color: 'var(--rb-text-muted)', lineHeight: 1.5 }}>
                    Đây chỉ là cách gọi tên để hướng dẫn trên khối Rubik. Khi đã hiểu, bạn sẽ nhớ và xoay theo bản năng mà không cần nghĩ đến ký hiệu.
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    />
  )
}
