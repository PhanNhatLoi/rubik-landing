import { useCallback, useEffect, useRef, useState } from 'react'
import type { CubeController, NxnController } from '../smart-solver/adapter/types'
import { getEngine } from '../smart-solver/nxn/engine'
import { formatSceneFormulaLog, readFormulaSnapshot, type RecordedFormulaTurn, type FormulaSnapshot } from './formulaRecording'

export function useFormulaRecorder(getController: () => NxnController | CubeController | null, sceneVersion: number, size: number) {
  const session = useRef<{ start: FormulaSnapshot; turns: RecordedFormulaTurn[] } | null>(null)
  const [recording, setRecording] = useState(false)
  const [count, setCount] = useState(0)
  const [output, setOutput] = useState('')
  const [message, setMessage] = useState('')

  const stop = useCallback((reason?: string) => {
    const current = session.current
    if (!current) return
    session.current = null
    const log = formatSceneFormulaLog(current.start, current.turns)
    setOutput(log)
    setRecording(false)
    console.info(`[Rubik — log công thức]\n${log}`)
    setMessage(reason ?? 'Đã in log ra Console. Bấm Sao chép log để gửi lại.')
  }, [])

  useEffect(() => {
    const controller = getController()
    if (!controller || controller.size !== 3 || !('getFacelets' in controller)) return
    const unsubscribe = controller.onUserTurn((token) => {
      const current = session.current
      if (!current) return
      const after = readFormulaSnapshot(controller)
      const before = current.turns.at(-1)?.after ?? current.start
      const expected = getEngine(3).apply(Uint8Array.from(before.stickers), token)
      if (!expected.every((v, i) => v === after.stickers[i])) {
        stop('Khối đã thay đổi ngoài các nước tự xoay. Đã dừng và giữ log trước thay đổi; hãy bắt đầu ghi lại.')
        return
      }
      current.turns.push({ token, after })
      setCount(current.turns.length)
    })
    return () => {
      unsubscribe()
      stop('Khối đã được dựng lại hoặc đổi kích thước. Log các nước đã ghi vẫn được giữ để sao chép.')
    }
  }, [getController, sceneVersion, size, stop])

  const start = useCallback(() => {
    const controller = getController()
    if (!controller || controller.size !== 3 || !('getFacelets' in controller)) return
    session.current = { start: readFormulaSnapshot(controller), turns: [] }
    setRecording(true)
    setCount(0)
    setOutput('')
    setMessage('Đang ghi các nước tự xoay trên khối 3D. Xoay xong rồi bấm Dừng và in log.')
  }, [getController])

  return { recording, count, output, message, start, stop, available: size === 3 }
}

export type FormulaRecorderState = ReturnType<typeof useFormulaRecorder>
