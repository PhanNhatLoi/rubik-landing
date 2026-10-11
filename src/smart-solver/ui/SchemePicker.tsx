import { useState } from 'react'
import { FACES, type Face } from '../core/types'
import { slotsFor, stepFor, type Slot } from '../scan/scanGuide'
import {
  PRESET_COLORS,
  PRESET_LABEL,
  SWATCHES,
  duplicateColors,
  type Scheme,
  type SchemePreset,
  type SchemeSettings
} from './palette'

const SLOT_CELL: Record<Slot, { col: number; row: number }> = {
  top: { col: 2, row: 1 },
  left: { col: 1, row: 2 },
  center: { col: 2, row: 2 },
  right: { col: 3, row: 2 },
  back: { col: 4, row: 2 },
  bottom: { col: 2, row: 3 }
}

export interface SchemePickerProps {
  settings: SchemeSettings
  onChange: (settings: SchemeSettings) => void
  /** Scheme in use, including colors learned from the scan. */
  scheme: Scheme
  learned: Face[]
}

/** Center colors of the user's cube: a preset, or picked face by face on a small map of the cube. */
export default function SchemePicker({ settings, onChange, scheme, learned }: SchemePickerProps) {
  const [editing, setEditing] = useState<Face | null>(null)
  // Same layout as the scan net at its first step.
  const slots = slotsFor(stepFor('F').hold)
  const dupes = settings.preset === 'custom' ? duplicateColors(settings.custom) : []

  const choosePreset = (preset: SchemePreset) => {
    setEditing(null)
    // Starting a custom scheme from whatever is showing now.
    const custom =
      preset === 'custom' && settings.preset !== 'custom'
        ? (Object.fromEntries(FACES.map((f) => [f, scheme[f].css])) as Record<Face, string>)
        : settings.custom
    onChange({ preset, custom })
  }

  const setColor = (face: Face, css: string) => onChange({ ...settings, custom: { ...settings.custom, [face]: css } })

  return (
    <div className="scheme">
      <label className="scheme-row">
        <span className="scan-legend">Bộ màu khối</span>
        <select value={settings.preset} onChange={(e) => choosePreset(e.target.value as SchemePreset)}>
          {(['standard', 'japanese', 'custom'] as const).map((p) => (
            <option key={p} value={p}>
              {PRESET_LABEL[p]}
            </option>
          ))}
        </select>
      </label>

      {settings.preset === 'custom' && (
        <div className="scheme-custom">
          <div className="scheme-map" aria-label="Màu ô tâm các mặt">
            {FACES.map((face) => {
              const pos = SLOT_CELL[slots[face]]
              return (
                <button
                  key={face}
                  type="button"
                  className={`scheme-cell${editing === face ? ' active' : ''}${dupes.includes(face) ? ' dupe' : ''}`}
                  style={{ gridColumn: pos.col, gridRow: pos.row, background: settings.custom[face] }}
                  aria-label="Chọn màu ô tâm"
                  onClick={() => setEditing(editing === face ? null : face)}
                />
              )
            })}
          </div>
          {editing ? (
            <div className="scheme-swatches">
              {SWATCHES.map((s) => (
                <button
                  key={s.css}
                  type="button"
                  className={`scheme-swatch${settings.custom[editing].toLowerCase() === s.css ? ' active' : ''}`}
                  style={{ background: s.css }}
                  title={s.label}
                  aria-label={s.label}
                  onClick={() => setColor(editing, s.css)}
                />
              ))}
              <input
                type="color"
                className="scheme-free"
                value={settings.custom[editing]}
                aria-label="Màu tuỳ chọn"
                onChange={(e) => setColor(editing, e.target.value)}
              />
            </div>
          ) : (
            <div className="scan-legend">Bấm vào một ô tâm để chọn màu (bố cục như lúc bắt đầu quét).</div>
          )}
          {dupes.length > 0 && <div className="scan-error">Hai mặt đang có màu giống nhau — hãy chọn màu khác.</div>}
        </div>
      )}

      {settings.preset !== 'custom' && (
        <div className="scheme-preview" aria-hidden>
          {FACES.map((f) => (
            <span key={f} style={{ background: PRESET_COLORS[settings.preset as Exclude<SchemePreset, 'custom'>][f] }} />
          ))}
        </div>
      )}

      {learned.length > 0 && (
        <div className="scan-status">
          Đã cập nhật màu tâm theo khối của bạn: {learned.map((f) => scheme[f].label).join(', ')}.
        </div>
      )}
    </div>
  )
}
