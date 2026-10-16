import { applyMoves } from '../../smart-solver/core/cubie'
import { CORNER_COLORS } from '../../smart-solver/core/facelets'
import type { CubieState, Face } from '../../smart-solver/core/types'
import { LAST_CORNERS_CASES, LAST_CORNERS_COMBINATIONS } from '../copy/lesson7'
import { buildLastCornersGuide, LAST_CORNER_LABEL, LAST_CORNERS_LEFT, LAST_CORNERS_RIGHT, lastCornersChoices, lastCornersPositionDone } from '../guide/lastCornersGuide'
import LastCornersDiagram from './LastCornersDiagram'

export type LastCornersFrames = Partial<Record<number, string>>
interface Colors { faceColors: Record<Face, number>; colorNames: Record<Face, string> }
interface Selection { frames: LastCornersFrames; onVariantChange: (round: number, id: string) => void }
const hex = (v: number) => `#${v.toString(16).padStart(6, '0')}`
const notation = (moves: readonly string[]) => moves.join(' ').replaceAll("'", '′')

function CornerChoice({ state, round = 1, faceColors, colorNames, frames, onVariantChange }: Colors & Selection & { state: CubieState; round?: number }) {
  const choices = lastCornersChoices(state)
  const chosen = choices.find((v) => v.id === frames[round]) ?? choices[0]
  if (!chosen) return <div>Bốn góc đã đúng vị trí. Không cần làm công thức; hướng mặt vàng để Bài 8.</div>
  const guide = buildLastCornersGuide(state, colorNames, chosen.id)!
  const after = applyMoves(state, chosen.moves)
  return <div style={{ display: 'grid', gap: '10px' }}>
    <strong>Lượt {round}: {guide.title.toLowerCase()}</strong>
    {choices.length > 1 && <>
      <div>Đề xuất: giữ góc <strong>{LAST_CORNER_LABEL[chosen.anchor]}</strong>, mặt mốc <strong>{chosen.front}</strong>, dùng bản <strong>{chosen.side === 'right' ? 'R′' : 'L'}</strong>.</div>
      <details><summary style={{ minHeight: '44px', cursor: 'pointer', color: 'var(--rb-accent-link)' }}>Xem các lựa chọn mốc khác</summary>
      <label style={{ display: 'grid', gap: '6px' }}>Chọn góc giữ lại và phía áp dụng
      <select aria-label={`Chọn góc và phía áp dụng lượt ${round}`} value={chosen.id} onChange={(e) => onVariantChange(round, e.target.value)} style={{ width: '100%', minHeight: '44px', borderRadius: 'var(--rb-r-sm)', color: 'var(--rb-text)', background: 'var(--rb-surface-2)', border: '1px solid var(--rb-border)', padding: '8px' }}>
        {choices.map((v) => <option key={v.id} value={v.id}>Giữ {LAST_CORNER_LABEL[v.anchor]} · mặt mốc {v.front} · bản {v.side === 'right' ? 'R′' : 'L'}</option>)}
      </select>
      </label>
      </details>
    </>}
    <LastCornersDiagram state={state} faceColors={faceColors} colorNames={colorNames} variant={chosen} clue={guide.clue} label={`Giữ góc ${LAST_CORNER_LABEL[chosen.anchor]}, vòng ${[...chosen.cycle, chosen.cycle[0]!].map((i) => LAST_CORNER_LABEL[i]).join(' → ')}`} />
    <div>{guide.intro}</div>
    <div>Góc giữ lại: <strong>{LAST_CORNER_LABEL[chosen.anchor]}</strong>. Chọn mặt <strong>{chosen.front}</strong> làm F mốc; góc này đóng vai trò <strong>{chosen.side === 'right' ? 'FR' : 'FL'}</strong> trong công thức.</div>
    <div style={{ padding: '10px', border: '1px solid var(--rb-accent-tint-border)', borderRadius: 'var(--rb-r-sm)' }}>
      <div>Công thức theo F mốc:</div>
      <strong style={{ display: 'block', fontSize: '16px', color: 'var(--rb-accent-link)' }}>{notation(chosen.side === 'right' ? LAST_CORNERS_RIGHT : LAST_CORNERS_LEFT)}</strong>
      <div style={{ marginTop: '6px' }}>Theo vị trí cố định của khối ảo:</div><strong>{notation(chosen.moves)}</strong>
    </div>
    <details><summary style={{ minHeight: '44px', cursor: 'pointer' }}>Xem vị trí góc sau lượt {round}</summary><LastCornersDiagram state={after} faceColors={faceColors} colorNames={colorNames} label={`Các góc sau lượt ${round}`} /></details>
    {lastCornersPositionDone(after) ? <strong style={{ color: 'var(--rb-accent-link)' }}>Đủ bốn góc đúng vị trí. Dừng ở đây; chưa cần lật góc.</strong> : round < 2 && <CornerChoice state={after} round={round + 1} faceColors={faceColors} colorNames={colorNames} frames={frames} onVariantChange={onVariantChange} />}
  </div>
}

export default function LastCornersCases({ faceColors, colorNames, combination, onCombinationChange, frames, onVariantChange }: Colors & Selection & { combination: number; onCombinationChange: (index: number) => void }) {
  const selected = LAST_CORNERS_COMBINATIONS[combination]!
  const kind = LAST_CORNERS_CASES.find((c) => c.id === selected.kind)!
  return <div style={{ display: 'grid', gap: '12px', fontSize: '13px', lineHeight: 1.5, color: 'var(--rb-text-muted)' }}>
    <div role="group" aria-label="Ba trường hợp số góc đúng vị trí" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }}>
      {LAST_CORNERS_CASES.map((c) => {
        const active = selected.kind === c.id
        return <button key={c.id} type="button" className="rb-btn rb-btn--secondary" aria-pressed={active} style={{
          minHeight: '44px', whiteSpace: 'normal', height: 'auto', padding: '8px',
          background: active ? 'var(--rb-accent-tint)' : undefined,
          borderColor: active ? 'var(--rb-accent-link)' : undefined,
          color: active ? 'var(--rb-accent-link)' : undefined,
          fontWeight: active ? 700 : undefined,
        }} onClick={() => onCombinationChange(LAST_CORNERS_COMBINATIONS.findIndex((v) => v.kind === c.id))}>{active && <span aria-hidden="true">✓ </span>}{c.label}</button>
      })}
    </div>
    <strong>{kind.desc}</strong>
    {LAST_CORNERS_COMBINATIONS.filter((c) => c.kind === selected.kind).length > 1 && <details key={combination} style={{ padding: '10px 12px', border: '1px solid var(--rb-border)', borderRadius: 'var(--rb-r-md)' }}>
      <summary style={{ minHeight: '44px', display: 'list-item', cursor: 'pointer', color: 'var(--rb-accent-link)' }}>Xem thêm tổ hợp khác ({LAST_CORNERS_COMBINATIONS.filter((c) => c.kind === selected.kind).length - 1})</summary>
      <div style={{ marginBottom: '10px' }}>Chọn một mẫu khác để đối chiếu hoặc luyện. Cách nhận diện và xử lý vẫn theo trường hợp đang chọn.</div>
    <div role="group" aria-label="Các tổ hợp góc của trường hợp đang chọn" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
      {LAST_CORNERS_COMBINATIONS.map((c, index) => c.kind !== selected.kind || index === combination ? null : <button key={c.id} type="button" className="rb-btn rb-btn--secondary" aria-pressed={combination === index} onClick={() => onCombinationChange(index)} style={{ display: 'grid', gap: '5px', height: 'auto', padding: '8px', borderColor: combination === index ? 'var(--rb-accent-link)' : undefined }}>
        <span>Tổ hợp {index + 1}</span>
        {[4, 5, 6, 7].map((slot) => <span key={slot} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '10px' }}>
          <span>{LAST_CORNER_LABEL[slot]}{c.state.cp[slot] === slot ? ' ✓' : ''}</span>
          {CORNER_COLORS[c.state.cp[slot]!]!.map((f) => <span key={f} title={colorNames[f]} style={{ width: '11px', height: '11px', borderRadius: '2px', background: hex(faceColors[f]) }} />)}
        </span>)}
      </button>)}
    </div>
    </details>}
    <div>Xem mẫu và cách xử lý đề xuất dưới đây. Khi cần đối chiếu thêm, mở “Xem thêm tổ hợp khác”.</div>
    <div style={{ padding: '12px', display: 'grid', gap: '10px', border: '1px solid var(--rb-border)', borderRadius: 'var(--rb-r-md)' }}>
      <strong style={{ color: 'var(--rb-text)' }}>Mẫu tham khảo · {kind.label}</strong>
      {selected.kind === 'done' ? <>
        <LastCornersDiagram state={selected.state} faceColors={faceColors} colorNames={colorNames} label="Bốn góc đúng vị trí dù mặt vàng có thể chưa hướng xuống" />
        <strong style={{ color: 'var(--rb-accent-link)' }}>Đã xong Bài 7. Không làm công thức; phần lật góc để Bài 8.</strong>
      </> : <CornerChoice key={selected.id} state={selected.state} faceColors={faceColors} colorNames={colorNames} frames={frames} onVariantChange={onVariantChange} />}
    </div>
    <div>✓: đúng vị trí, không yêu cầu đúng mặt. Khung nét đứt: góc giữ lại. Viền cam: góc bên cạnh có 2/3 màu thuộc vị trí đang đứng. Ba ô “Cần” là bộ màu của vị trí để đối chiếu.</div>
  </div>
}
