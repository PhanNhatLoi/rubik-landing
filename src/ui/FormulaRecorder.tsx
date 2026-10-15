import { useState } from 'react'
import type { FormulaRecorderState } from './useFormulaRecorder'

export default function FormulaRecorder({ recorder }: { recorder: FormulaRecorderState }) {
  const [copyMessage, setCopyMessage] = useState('')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, flexShrink: 0 }}>
      <button type="button" className="rb-btn rb-btn--secondary" style={{ minHeight: '44px', width: '100%' }} disabled={!recorder.available} onClick={() => {
        setCopyMessage('')
        if (recorder.recording) recorder.stop()
        else recorder.start()
      }}>
        {recorder.recording ? `Dừng và in log (${recorder.count} nước)` : 'Bật ghi log công thức'}
      </button>
      {!recorder.available && <div style={{ fontSize: '12px', color: 'var(--rb-text-muted)' }}>Chọn khối 3×3 để ghi công thức.</div>}
      {recorder.message && <div role="status" aria-live="polite" style={{ fontSize: '12px', color: 'var(--rb-text-muted)', lineHeight: 1.5 }}>{recorder.message}</div>}
      {recorder.output && <>
        <button type="button" className="rb-btn rb-btn--secondary" style={{ minHeight: '44px' }} onClick={async () => {
          try {
            await navigator.clipboard.writeText(recorder.output)
            setCopyMessage('Đã sao chép log. Bạn có thể dán vào cuộc trò chuyện.')
          } catch {
            setCopyMessage('Chạm vào ô log để chọn toàn bộ, rồi sao chép thủ công.')
          }
        }}>Sao chép log</button>
        <div role="status" style={{ fontSize: '12px', color: 'var(--rb-text-muted)' }}>{copyMessage}</div>
        <textarea aria-label="Log công thức để gửi lại" readOnly value={recorder.output} rows={4} onFocus={(event) => event.currentTarget.select()} style={{ width: '100%', maxHeight: '130px', boxSizing: 'border-box', padding: '8px', borderRadius: 'var(--rb-r-sm)', border: '1px solid var(--rb-border)', background: 'var(--rb-surface-2)', color: 'var(--rb-text)', fontSize: '12px' }} />
      </>}
    </div>
  )
}
