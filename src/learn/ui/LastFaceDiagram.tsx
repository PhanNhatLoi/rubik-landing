import { CORNER_FACELETS, toFacelets } from '../../smart-solver/core/facelets'
import type { CubieState, Face } from '../../smart-solver/core/types'
import { cornerCell } from '../cells'
import { cornerPlace } from '../guide/lastCornersGuide'
import type { LastFaceVariant } from '../guide/lastFaceGuide'
import MiniCube from './MiniCube'

const hex = (value: number) => `#${value.toString(16).padStart(6, '0')}`

/** Same physical 3D renderer as the other lessons, oriented towards the selected reference face. */
export default function LastFaceDiagram({ state, faceColors, colorNames, variant, label }: {
  state: CubieState; faceColors: Record<Face, number>; colorNames: Record<Face, string>; variant?: LastFaceVariant; label: string
}) {
  const front = variant?.front ?? 'F'
  const bottomColor = variant ? toFacelets(state)[CORNER_FACELETS[variant.corner]![0]] as Face : undefined
  return <figure data-no-typing data-front={front} data-side={variant?.side ?? 'right'} style={{ margin: 0, display: 'grid', gap: '10px' }}>
    <div style={{ width: '100%', maxWidth: '280px', margin: '0 auto' }}>
      <MiniCube facelets={toFacelets(state)} faceColors={faceColors} label={label} view="below" viewFront={front === 'U' || front === 'D' ? 'F' : front} viewSide={variant?.side ?? 'right'} grayRest
        spotlight={{ kind: 'cells', cells: (variant?.affected ?? [4, 5, 6, 7]).map(cornerCell) }}
        keep={[{ kind: 'centers' }, { kind: 'cells', cells: [4, 5, 6, 7].map(cornerCell) }]} />
    </div>
    {variant && bottomColor && <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: 'var(--rb-text)' }}>
      <span data-bottom-color={bottomColor} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: hex(faceColors[bottomColor]), border: '1px solid var(--rb-border-strong)' }} />Ô dưới góc: {colorNames[bottomColor]}
      </span>
      <span aria-hidden="true">=</span>
      <span data-reference-center={front} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: hex(faceColors[front]), border: '1px solid var(--rb-border-strong)' }} />Tâm mốc: {colorNames[front]}
      </span>
    </div>}
    <figcaption style={{ fontSize: '12px', lineHeight: 1.5, textAlign: 'center', color: 'var(--rb-text-muted)' }}>
      {variant ? <>Nhìn từ dưới · mặt {colorNames[front]} làm F mốc.<br />Hai góc sáng là cặp sẽ xoắn. Góc dùng so màu: {cornerPlace(variant.corner, colorNames)}.</> : 'Nhìn từ dưới: chỉ các góc tầng cuối và tâm giữ màu, các khối khác xám.'}
    </figcaption>
  </figure>
}
