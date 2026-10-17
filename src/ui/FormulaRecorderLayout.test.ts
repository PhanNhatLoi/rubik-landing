import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PlayShell from './PlayShell'

describe('formula recording controls placement', () => {
  it.each([true, false])('places the recorder below scramble/reset on desktop=%s', (isDesktop) => {
    const html = renderToStaticMarkup(createElement(PlayShell, {
      stageSlotRef: null, solverSlotRef: null, solverPhase: 'IDLE', solverCollapsed: false, stageHidden: false,
      onScramble: () => {}, onReset: () => {}, onZoomIn: () => {}, onZoomOut: () => {},
      onOpenSize: () => {}, onChangeSize: () => {}, onSelectTab: () => {},
      section: null, onOpenSection: () => {}, onCloseSection: () => {}, sizeTriggerRef: null,
      isDesktop, size: 3, activeTab: 'play', timeMs: 0, moves: 0, running: false, statusText: '',
      recorderSlot: createElement('div', { 'data-testid': 'formula-recorder' }, 'Ghi log')
    }))
    const recorder = html.indexOf('data-testid="formula-recorder"')
    expect(recorder).toBeGreaterThan(html.indexOf('Xáo trộn'))
    expect(recorder).toBeGreaterThan(html.indexOf(isDesktop ? 'Reset' : 'Đặt lại khối'))
    if (isDesktop) expect(recorder).toBeLessThan(html.indexOf('Kích thước'))
  })
})
