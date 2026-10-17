import { applyMoves, invertMoves, SOLVED } from '../../smart-solver/core/cubie'
import { LAST_FACE_SAMPLES, LAST_FACE_VARIANTS } from '../guide/lastFaceGuide'
import type { LessonPage } from '../ui/LessonPlayer'

export const LAST_FACE_CASES = [
  { wrong: 2, label: '2 góc cần lật' }, { wrong: 3, label: '3 góc cần lật' }, { wrong: 4, label: '4 góc cần lật' }, { wrong: 0, label: 'Đã hoàn thành' }
] as const
export const LAST_FACE_DEFAULT = LAST_FACE_SAMPLES.findIndex((sample) => sample.wrong === 2)
export const LAST_FACE_FORMULA_PICTURES = (['right', 'left'] as const).map((side) => {
  const variant = LAST_FACE_VARIANTS.find((v) => v.front === 'F' && v.side === side)!
  const before = applyMoves(SOLVED, invertMoves(variant.moves))
  return { variant, before, after: applyMoves(before, variant.moves) }
})
export const LAST_FACE_GOAL_PICTURE = LAST_FACE_FORMULA_PICTURES[0]!

export const LESSON8_PAGES: readonly (LessonPage & { body: string[]; reason: string })[] = [
  {
    id: 'goal', section: 'Mục tiêu', title: 'Lật góc để hoàn thành Rubik',
    body: [
      'Sau Bài 7, bốn góc vàng đã ở đúng vị trí nhưng màu vàng có thể còn quay sang bên hông. Bài này sẽ đưa màu vàng xuống D và các màu bên hông về khớp tâm.',
      'Học xong, bạn sẽ biết cách chọn cặp góc cần xoắn và làm đủ một lượt để hoàn thành Rubik. Các cạnh và hai tầng phía trên được giữ nguyên sau cả lượt.'
    ],
    reason: 'Đúng vị trí chưa có nghĩa là đúng mặt màu. Góc có thể đứng đúng chỗ nhưng vẫn cần xoắn để ba màu cùng khớp với ba tâm.'
  },
  {
    id: 'recognize', section: 'Chọn mặt bắt đầu', title: 'So màu dưới góc với tâm mặt bên',
    body: [
      'Chọn một góc chưa có màu vàng hướng xuống. Nhìn màu của ô đang nằm dưới góc đó, rồi tìm tâm mặt bên cùng màu để làm F mốc.',
      'Nhìn từ mặt mốc: góc ở phía trước bên phải thì dùng bản bắt đầu từ phải; góc ở phía trước bên trái thì dùng bản bắt đầu từ trái. B là mặt phía sau, đối diện F mốc.',
      'Hình giữ màu các góc và tâm để bạn so sánh. Hai góc sáng là cặp cùng bị xoắn. Đổi mặt mốc bằng cách nhìn khối từ phía khác, không xoay D riêng.'
    ],
    reason: 'Khi màu dưới góc trùng tâm F mốc, công thức đúng phía sẽ đưa màu đó lên mặt F. Góc còn lại của cặp cũng xoắn, nên sau một lượt cần quan sát lại cả bốn góc.'
  },
  {
    id: 'formula', section: 'Công thức hai nửa', title: 'Làm đủ hai nửa trong một lượt',
    body: [
      'Đây là công thức đổi cạnh của Bài 6, ghép hai bên đối diện. Bắt đầu bên phải hoặc bên trái theo góc vừa chọn, rồi làm ngay nửa còn lại.',
      'D2 là xoay đáy nửa vòng. D2′ cũng là nửa vòng, nhưng đi theo chiều D′; khi thực hành, app tách thành hai nước cùng chiều để bạn dễ theo dõi.',
      'Chưa dừng sau nửa đầu: các cạnh lúc này có thể còn lệch. Làm đủ cả hai nửa để các cạnh trở về; sau đó quan sát màu dưới góc và chọn lượt tiếp theo nếu cần.'
    ],
    reason: 'Hai nửa đổi vòng cạnh theo hai chiều ngược nhau nên trả các cạnh về chỗ cũ. Kết quả cả lượt chỉ xoắn hai góc bên bắt đầu, giữ nguyên vị trí các khối.'
  },
  {
    id: 'practice', section: 'Tham khảo và thực hành', title: 'Chọn mẫu, tìm mốc và lật góc',
    body: [
      'Chọn số góc chưa có màu vàng hướng xuống để xem một mẫu. Chỉ cần làm theo đề xuất trước; các mẫu và cách chọn mốc khác được mở khi bạn muốn tham khảo.',
      'Làm đủ hai nửa, quan sát lại rồi chọn mốc cho lượt tiếp theo. Bấm Thực hành để luyện trên đúng mẫu đang xem; Gợi ý đi theo mốc bạn đã chọn.'
    ],
    reason: 'Khối hợp lệ có thể còn 2, 3 hoặc 4 góc cần lật; không có trường hợp chỉ một góc bị xoắn. Chọn công thức bằng màu dưới góc và tâm mốc, không chỉ bằng số góc sai.'
  }
]
