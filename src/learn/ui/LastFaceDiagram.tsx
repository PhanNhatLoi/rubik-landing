import type { CubieState, Face } from '../../smart-solver/core/types'
import { fromCubie } from '../guide/physical'
import { LAST_CORNER_LABEL } from '../guide/lastCornersGuide'
import type { LastFaceVariant } from '../guide/lastFaceGuide'

const SIDES: Face[] = ['F', 'R', 'B', 'L']
const KEYS = { F: 'pz', R: 'px', B: 'nz', L: 'nx', D: 'ny', U: 'py' } as const
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`
const ink = (n: number) => (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 140 ? '#fff' : '#111'

/** One whole cube seen from below; only bottom corners and visible centers retain color. */
export default function LastFaceDiagram({ state, faceColors, colorNames, variant, label }: {
  state: CubieState; faceColors: Record<Face, number>; colorNames: Record<Face, string>; variant?: LastFaceVariant; label: string
}) {
  const yaw = SIDES.indexOf(variant?.front ?? 'F')
  const sign = variant?.side === 'left' ? -1 : 1
  const front = SIDES[yaw]!
  const side = SIDES[(yaw + (sign === 1 ? 1 : 3)) % 4]!
  const cubies = fromCubie(state)
  const project = ([u, y, z]: number[]) => [170 + sign * (64 * u! - 40 * z!), 130 - 64 * y! - 24 * u! - 24 * z!]
  const world = (u: number, z: number) => {
    const x = sign * u
    return [[x, z], [z, -x], [-x, -z], [-z, x]][yaw]!
  }
  const planes = [
    { face: front, point: (c: number, r: number) => [-1 + c * 2 / 3, 1 - r * 2 / 3, 1] },
    { face: side, point: (c: number, r: number) => [1, 1 - r * 2 / 3, 1 - c * 2 / 3] },
    { face: 'D' as Face, point: (c: number, r: number) => [-1 + c * 2 / 3, -1, 1 - r * 2 / 3] },
  ]
  return <figure style={{ margin: 0 }}>
    <svg viewBox="0 0 340 268" role="img" aria-label={label} style={{ width: '100%', maxWidth: '340px', height: 'auto', display: 'block', margin: '0 auto' }}>
      <title>{label}</title>
      {planes.map(({ face, point }) => <g key={face} data-visible-face={face}>
        {Array.from({ length: 9 }, (_, i) => {
          const col = i % 3, row = Math.floor(i / 3)
          const [u, y, z] = point(col + .5, row + .5)
          const [x, zz] = world(Math.round(u!), Math.round(z!)) as [number, number]
          const yy = Math.round(y!)
          const cubie = cubies.find((c) => c.grid.x === x + 1 && c.grid.y === yy + 1 && c.grid.z === zz + 1)!
          const corner = yy === -1 && Math.abs(x) === 1 && Math.abs(zz) === 1
          const slot = corner ? (zz === 1 ? (x === 1 ? 4 : 5) : (x === 1 ? 7 : 6)) : undefined
          const center = i === 4
          const color = cubie.stickers[KEYS[face]]!
          const lit = slot !== undefined && variant?.affected.includes(slot)
          const points = [[col + .025, row + .025], [col + .975, row + .025], [col + .975, row + .975], [col + .025, row + .975]]
            .map(([c, r]) => project(point(c!, r!)).join(',')).join(' ')
          const [tx, ty] = project(point(col + .5, row + .5))
          const clue = variant?.corner === slot && face === 'D'
          return <g key={i}>
            <polygon points={points} data-center={center ? face : undefined} data-sticker={slot !== undefined ? `${slot}-${face}` : undefined} data-twist-corner={lit && face === 'D' ? slot : undefined}
              fill={center || corner ? hex(faceColors[color]) : '#64748b'} stroke={lit || (center && face === front && variant) ? '#f59e0b' : '#0f172a'} strokeWidth={lit ? 2.5 : 1.5} strokeLinejoin="round" />
            {center && <text x={tx} y={ty! + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill={ink(faceColors[color])}>{face === front ? 'F' : face === side ? (sign === 1 ? 'R' : 'L') : 'D'}</text>}
            {clue && <text x={tx} y={ty! + 3} textAnchor="middle" fontSize="10" fontWeight="700" fill={ink(faceColors[color])}>●</text>}
            {(center || corner) && <title>{center ? `Tâm ${face}: ${colorNames[color]}` : `Góc ${LAST_CORNER_LABEL[slot!]}, ô ở mặt ${face}: ${colorNames[color]}`}</title>}
          </g>
        })}
      </g>)}
    </svg>
    <figcaption style={{ fontSize: '12px', lineHeight: 1.5, textAlign: 'center', color: 'var(--rb-text-muted)' }}>
      {variant ? <>Nhìn từ dưới · mặt {front} làm F mốc.<br />Hai góc viền cam sẽ xoắn; ô có ● trùng màu tâm F.</> : <>Nhìn từ dưới: các góc tầng cuối và tâm dùng để đối chiếu.</>}
    </figcaption>
  </figure>
}
