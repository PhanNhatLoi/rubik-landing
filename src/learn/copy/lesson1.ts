import type { Face } from '../../smart-solver/core/types'
import type { SpotlightTarget } from '../../smart-solver/adapter/types'
import type { LessonPage } from '../ui/LessonPlayer'

/** Lesson 1: the cube's structure and the notation. Pages are rendered by NotationView. */
export type Lesson1Page = LessonPage &
  (
    | { kind: 'text'; body: string[]; facts?: { label: string; value: string }[]; spotlight?: SpotlightTarget }
    | { kind: 'pickFront'; body: string[] }
    | { kind: 'face'; role: Face; name: string; body: string[] }
    | { kind: 'turn'; variant: '' | "'" | '2'; body: string[] }
    | { kind: 'slice'; body: string[] }
    | { kind: 'beforeAfter'; scramble: string; body: string[] }
  )

export const FACE_ROLE_NAME: Record<Face, string> = {
  F: 'Front – mặt trước',
  B: 'Back – mặt sau',
  U: 'Up – mặt trên',
  D: 'Down – mặt dưới',
  R: 'Right – mặt phải',
  L: 'Left – mặt trái'
}

const OVERVIEW = 'Cấu trúc khối'
const FACES_SECTION = 'Các mặt'
const NOTATION = 'Ký hiệu xoay'
const SLICES = 'Lớp giữa'
const PREVIEW = 'Trước và sau'

export const LESSON1_PAGES: readonly Lesson1Page[] = [
  {
    id: 'overview',
    section: OVERVIEW,
    title: 'Rubik 3x3 gồm những gì?',
    kind: 'text',
    body: [
      'Khối Rubik 3x3 có 6 mặt, mỗi mặt là một lưới 3×3 ô màu, tổng cộng 54 ô màu.',
      'Bên trong có 27 khối nhỏ ghép lại: 1 lõi ẩn ở giữa và 26 khối nhìn thấy được. 26 khối này chia làm 3 loại: tâm, cạnh và góc.'
    ],
    facts: [
      { label: 'Mặt', value: '6' },
      { label: 'Ô màu', value: '54' },
      { label: 'Khối nhìn thấy', value: '26' }
    ]
  },
  {
    id: 'centers',
    section: OVERVIEW,
    title: 'Tâm — 6 khối',
    kind: 'text',
    spotlight: { kind: 'centers' },
    body: [
      'Các khối đang phát sáng trên khối 3D là tâm. Tâm nằm giữa mỗi mặt và chỉ có 1 màu.',
      'Tâm không bao giờ đổi vị trí so với nhau, chúng chỉ quay tại chỗ. Vì vậy tâm quyết định màu của cả mặt: mặt có tâm trắng sẽ là mặt trắng khi giải xong.',
      'Các màu đối diện nhau là cố định: trắng – vàng, xanh lá – xanh dương, đỏ – cam.'
    ],
    facts: [
      { label: 'Số lượng', value: '6' },
      { label: 'Số màu', value: '1' }
    ]
  },
  {
    id: 'edges',
    section: OVERVIEW,
    title: 'Cạnh — 12 khối',
    kind: 'text',
    spotlight: { kind: 'edges' },
    body: [
      'Các khối đang phát sáng là cạnh. Cạnh nằm giữa hai tâm và có 2 màu, nối hai mặt kề nhau.',
      'Khi giải, bạn đưa từng cạnh về đúng chỗ bằng cách ghép hai màu của nó với hai tâm bên cạnh.'
    ],
    facts: [
      { label: 'Số lượng', value: '12' },
      { label: 'Số màu', value: '2' }
    ]
  },
  {
    id: 'corners',
    section: OVERVIEW,
    title: 'Góc — 8 khối',
    kind: 'text',
    spotlight: { kind: 'corners' },
    body: [
      'Các khối đang phát sáng là góc. Góc nằm ở các đỉnh của khối và có 3 màu, thuộc về ba mặt gặp nhau tại đỉnh đó.',
      'Góc khó hơn cạnh vì phải đúng cả vị trí lẫn hướng của 3 màu.'
    ],
    facts: [
      { label: 'Số lượng', value: '8' },
      { label: 'Số màu', value: '3' }
    ]
  },
  {
    id: 'front',
    section: FACES_SECTION,
    title: 'Chọn mặt trước (Front)',
    kind: 'pickFront',
    body: [
      'Các mặt được gọi theo vị trí so với bạn, không theo màu. Nên trước tiên hãy chọn mặt nào sẽ hướng về phía bạn: đó là mặt trước (F).',
      'Chọn mặt nào cũng được. Mọi tên gọi và ký hiệu phía sau đều dựa vào lựa chọn này, và sẽ đổi theo nếu bạn chọn mặt khác.'
    ]
  },
  { id: 'up', section: FACES_SECTION, title: 'Mặt trên (U)', kind: 'face', role: 'U', name: FACE_ROLE_NAME.U, body: ['Mặt trên là mặt hướng lên trên, phía đỉnh khối. Chữ U lấy từ Up.'] },
  { id: 'down', section: FACES_SECTION, title: 'Mặt dưới (D)', kind: 'face', role: 'D', name: FACE_ROLE_NAME.D, body: ['Mặt dưới đối diện mặt trên, hướng xuống đáy. Chữ D lấy từ Down.'] },
  { id: 'right', section: FACES_SECTION, title: 'Mặt phải (R)', kind: 'face', role: 'R', name: FACE_ROLE_NAME.R, body: ['Mặt phải là mặt bên tay phải của bạn khi nhìn vào mặt trước. Chữ R lấy từ Right.'] },
  { id: 'left', section: FACES_SECTION, title: 'Mặt trái (L)', kind: 'face', role: 'L', name: FACE_ROLE_NAME.L, body: ['Mặt trái đối diện mặt phải, bên tay trái của bạn. Chữ L lấy từ Left.'] },
  { id: 'back', section: FACES_SECTION, title: 'Mặt sau (B)', kind: 'face', role: 'B', name: FACE_ROLE_NAME.B, body: ['Mặt sau nằm phía sau, đối diện mặt trước nên bạn không nhìn thấy khi cầm khối. Chữ B lấy từ Back.'] },
  {
    id: 'cw',
    section: NOTATION,
    title: 'Một chữ cái: xoay theo kim đồng hồ',
    kind: 'turn',
    variant: '',
    body: [
      'Chữ cái đứng một mình nghĩa là xoay mặt đó 1/4 vòng theo chiều kim đồng hồ, khi bạn nhìn thẳng vào chính mặt đó.',
      'Mặt U là ví dụ đầu tiên. Bạn có thể chọn mặt khác bên dưới để xem ký hiệu của mặt đó.'
    ]
  },
  {
    id: 'ccw',
    section: NOTATION,
    title: "Dấu ′: xoay ngược kim đồng hồ",
    kind: 'turn',
    variant: "'",
    body: ['Thêm dấu nháy (′) sau chữ cái nghĩa là xoay ngược chiều kim đồng hồ 1/4 vòng. Ví dụ U′ là mặt trên xoay ngược lại.']
  },
  {
    id: 'half',
    section: NOTATION,
    title: 'Số 2: xoay nửa vòng',
    kind: 'turn',
    variant: '2',
    body: [
      'Thêm số 2 nghĩa là xoay hai lần 1/4 vòng, tức nửa vòng (180°). Ví dụ U2.',
      'Xoay nửa vòng thì chiều nào cũng cho cùng kết quả nên không cần dấu nháy.'
    ]
  },
  {
    id: 'slices',
    section: SLICES,
    title: 'Xoay lớp giữa: M, E, S',
    kind: 'slice',
    body: [
      'Ngoài 6 mặt, còn 3 lớp giữa cũng xoay được. Chúng không phải mặt ngoài nên có tên riêng: M, E và S.',
      'M là lớp giữa nằm giữa L và R, quay cùng chiều với L (mặt trước đi xuống). E là lớp giữa nằm giữa U và D, quay cùng chiều với D. S là lớp giữa nằm giữa F và B, quay cùng chiều với F.',
      'Cũng có dấu ′ (ngược chiều) và số 2 (nửa vòng): M′, M2, E′, S2…',
      'Lưu ý: xoay lớp giữa làm các tâm đổi chỗ. Khi dùng nó, nhớ trả lại bằng nước ngược (ví dụ M rồi M′) để các tâm về chỗ cũ.'
    ]
  },
  {
    id: 'beforeAfter',
    section: PREVIEW,
    title: 'Trước khi lắp → sau khi lắp',
    kind: 'beforeAfter',
    scramble: "R U R' U' F' U2 L D2",
    body: [
      "Từ bài sau, mỗi bước đều cho bạn xem hai khối: bên trái là khối trước khi lắp, bên phải là khối sau khi hoàn thành bước đó. Mũi tên ở giữa là việc bạn cần làm.",
      "Ví dụ: khối bên trái được xáo trộn bằng 8 nước R U R′ U′ F′ U2 L D2. Lắp lại xong, nó trở về khối hoàn thành bên phải."
    ]
  }
]
