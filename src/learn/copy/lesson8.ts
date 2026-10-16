import { LAST_FACE_SAMPLES } from '../guide/lastFaceGuide'
import type { LessonPage } from '../ui/LessonPlayer'
export const LAST_FACE_CASES = [
 { wrong: 2, label: '2 góc cần lật' }, { wrong: 3, label: '3 góc cần lật' }, { wrong: 4, label: '4 góc cần lật' }, { wrong: 0, label: 'Đã hoàn thành' }
] as const
export const LAST_FACE_DEFAULT = LAST_FACE_SAMPLES.findIndex((s)=>s.wrong===2)
export const LESSON8_PAGES: readonly (LessonPage & {body: string[]; reason: string})[] = [
 {id:'goal',section:'Mục tiêu',title:'Lật góc để hoàn thành Rubik',body:[
  'Sau Bài 7, mọi khối đã đúng vị trí. Bài 8 chỉ xoắn các góc tầng đáy để vàng hướng xuống D, các màu bên trùng với tâm.',
  'Một lượt gồm hai nửa từ Bài 6: làm bên này rồi làm bên đối diện. Nửa đầu còn đổi vị trí cạnh; đủ cả hai nửa thì các cạnh trở về, chỉ hai góc bên bắt đầu bị xoắn ngược chiều nhau.'
 ],reason:'Góc không thể lật như cạnh: mỗi góc xoắn 120°. Hai góc xoắn ngược chiều giữ tổng độ xoắn hợp lệ và giữ nguyên vị trí mọi khối.'},
 {id:'recognize',section:'Chọn mặt bắt đầu',title:'So màu dưới góc với tâm F',body:[
  'Nhìn ô đang hướng xuống D của một góc chưa đúng mặt. Chọn mặt bên có tâm trùng màu ô đó làm F mốc.',
  'Nếu góc ấy nằm trước–phải (FR) theo F mốc, bắt đầu bằng bản R′. Nếu nằm trước–trái (FL), bắt đầu bằng bản L. B là mặt đối diện F mốc.',
  'Hình tổng quát là một khối Rubik nhìn từ dưới, thấy mặt F, mặt bên bắt đầu và mặt D. Chỉ các góc tầng cuối và tâm được giữ màu. Hai góc viền cam là cặp sẽ xoắn; ô có chấm tròn có màu trùng tâm F mốc.',
  'Đổi mặt mốc bằng cách nhìn khối từ phía khác; không xoay D riêng. Sau mỗi lượt đủ hai nửa, quan sát lại và chọn mốc mới.'
 ],reason:'Khi màu dưới góc trùng tâm F mốc, bản đúng phía đưa ô đó lên đúng mặt F. Góc cùng phía ở phía sau cũng xoắn; vì vậy cần quan sát lại cả bốn góc sau mỗi lượt.'},
 {id:'formula',section:'Công thức hai nửa',title:'Làm liền hai bên, rồi mới quan sát',body:[
  'Bản R′: R′ D2 R D R′ D R · L D2 L′ D′ L D′ L′.',
  'Bản L: L D2 L′ D′ L D′ L′ · R′ D2 R D R′ D R.',
  'D2 là xoay đáy nửa vòng. Dấu · chỉ chỗ nối hai nửa, không phải điểm dừng. Trên khối ảo, app chia D2 thành hai nước D hoặc D′ để theo dõi từng lần xoay.',
  'Đủ cả hai nửa: giữ vị trí tất cả các khối, chỉ đổi hướng hai góc bên bắt đầu. Không dừng để sửa các cạnh giữa công thức.'
 ],reason:'Hai nửa đổi vòng cạnh theo hai chiều ngược nhau nên triệt tiêu phần đổi cạnh. Làm từ R′ tác động cặp FR–BR; làm từ L tác động cặp FL–BL, tính theo F mốc.'},
 {id:'practice',section:'Tham khảo và thực hành',title:'Xem màu dưới góc, chọn mốc, làm đủ một lượt',body:[
  'Có thể còn 2, 3 hoặc 4 góc cần lật; cũng có thể Rubik đã hoàn thành. Không có trường hợp hợp lệ chỉ một góc bị xoắn.',
  'Chọn nhóm để xem một mẫu và hướng xử lý đề xuất. Các mẫu khác chỉ hiện khi bạn mở danh sách. Thực hành tải đúng mẫu đang xem.',
  'Mỗi lần Gợi ý sẽ chọn F mốc theo màu dưới góc và hướng dẫn đủ hai nửa. Làm xong rồi xem lại; lặp cho tới khi bốn góc khớp tâm và khối hoàn thành.'
 ],reason:'Chỉ đếm số góc chưa đúng mặt chưa đủ quyết định công thức. Màu ô dưới và vị trí của góc so với F mốc mới xác định phía bắt đầu.'}
]
