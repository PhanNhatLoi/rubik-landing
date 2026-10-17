import { expect, it } from 'vitest'
import { Children, isValidElement, type ReactElement } from 'react'
import { narrateContent, NarrationScene, TypedText, typingDuration } from './LessonNarration'

it('keeps the title, page header and note cards static; reserves typing time only for body and scenes', () => {
  const cursor = { time: 0 }
  const header = <header data-no-typing><div>Bài 2 · Phần 1/4</div><h2>Tiêu đề</h2></header>
  const nodes = Children.toArray(narrateContent([
    header,
    <div key="note" role="note">Đang lắp: trắng</div>,
    <h3 key="heading">Vì sao?</h3>,
    <p key="body">Nội dung cần gõ.</p>,
    <NarrationScene key="scene" duration={1000}><div>Khối mẫu</div></NarrationScene>
  ], cursor)) as ReactElement<{ children?: unknown; start?: number }>[]
  expect(nodes[0]!.props.children).toBe(header.props.children)
  expect(nodes[1]!.props.children).toBe('Đang lắp: trắng')
  expect(nodes[2]!.props.children).toBe('Vì sao?')
  const body = Children.toArray(nodes[3]!.props.children as ReactElement)[0]
  expect(isValidElement(body) && body.type).toBe(TypedText)
  expect(nodes[4]!.props.start).toBe(typingDuration('Nội dung cần gõ.'))
  expect(cursor.time).toBe(typingDuration('Nội dung cần gõ.') + 1000)
})

it('leaves formula cards and illustration titles visible without consuming typing time', () => {
  const cursor = { time: 0 }
  const nodes = Children.toArray(narrateContent([
    <div key="title">Trượt cạnh sang phải</div>,
    <strong key="formula">D′ R′ D R D F D′ F′</strong>,
    <div key="caption">Trước khi lắp · Sau khi lắp</div>,
    <p key="body">Đưa cạnh xuống rồi lắp lại.</p>
  ], cursor)) as ReactElement<{ children?: unknown }>[]
  expect(nodes.slice(0, 3).map((node) => Children.toArray(node.props.children as ReactElement))).toEqual([
    ['Trượt cạnh sang phải'], ['D′ R′ D R D F D′ F′'], ['Trước khi lắp · Sau khi lắp']
  ])
  expect(cursor.time).toBe(typingDuration('Đưa cạnh xuống rồi lắp lại.'))
})

it('types the whole lecture paragraph including formulas, but leaves all framed text static', () => {
  const cursor = { time: 0 }
  const framedText = <p>Công thức trong khung: R U R′. Đọc chú thích rồi chạy thử.</p>
  const [paragraph, frame] = Children.toArray(narrateContent([
    <p key="lecture">Xem R U R′ rồi thử lại.</p>,
    <div key="frame" data-no-typing>{framedText}</div>
  ], cursor)) as ReactElement<{ children: ReactElement }>[]
  const [typed] = Children.toArray(paragraph!.props.children)
  expect(isValidElement(typed) && typed.type).toBe(TypedText)
  expect(isValidElement<{ text: string }>(typed) && typed.props.text).toBe('Xem R U R′ rồi thử lại.')
  expect(frame!.props.children).toBe(framedText)
  expect(cursor.time).toBe(typingDuration('Xem R U R′ rồi thử lại.'))
})
