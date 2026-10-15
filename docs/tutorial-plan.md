# Chế độ "Người mới học" — Implementation Plan (cho agy)

> **Cập nhật mới nhất: §17.** Chủ dự án đã yêu cầu và cho phép chuyển bài 1–5, lộ trình/giải cơ bản 3×3 và hướng quét sang trắng trên → tầng giữa → vàng dưới. Các phần nghiệm thu cũ phía dưới là lịch sử; hướng hiện hành theo §17.

> Chỉ thêm **chế độ học** (lộ trình, hướng dẫn từng bước, luyện tập). Không đổi logic giải/quét/vision. Ngoại lệ duy nhất đụng Three.js: Phase 2 (mũi tên F/B/nửa vòng), làm PR riêng.
> Đọc theo thứ tự: §1 bối cảnh → §2 design → §3 hiện trạng code → §4 hợp đồng dữ liệu → §5 phase. Mỗi phase có "Nghiệm thu" để tự kiểm.

## 0. Nguyên tắc (giống `ui-redesign-plan.md`)

1. Không refactor ngoài phạm vi. Theo pattern có sẵn: JSX trong `src/ui/`, smart-solver là TS.
2. Dùng token `var(--rb-*)` và class `.rb-*` (xem `docs/design-system.md`, `src/styles/tokens.css`). Không hex rải rác.
3. TypeScript strict, không `any`. Package manager `pnpm`; **không** tự chạy `pnpm install` hay sửa lockfile; không thêm thư viện (không router, không UI kit).
4. Mỗi phase là một commit/PR độc lập, app chạy được ở cuối. Commit conventional (`feat:`, `refactor:`), chỉ commit khi được yêu cầu, không tự push, không commit lên `main`.
5. Giữ props/hành vi của `SmartSolverPanel`, `ScanView`, `GuideView`, `CameraPanel`. `pnpm test` phải xanh sau mỗi phase.
6. Nhánh làm việc: `enhance/mobile-UI` (hoặc nhánh mới từ nó).
7. Test nhẹ: chỉ test logic thuần (copy, kiểm tra giai đoạn, dựng mẫu). Không dựng e2e nặng.

## 1. Mục tiêu và quyết định

Người chơi mới học giải **3x3** theo phương pháp từng tầng, hiểu *vì sao* phải xoay và xoay xong *được gì*.

Đã chốt:
- **Chỉ 3x3.** 2x2/4x4/5x5 ghi ở §9 (nợ kỹ thuật), **không làm**.
- **Chọn giai đoạn tự do**: không khoá. Chạm giai đoạn nào trong lộ trình đều học/luyện được ngay.
- **Minh hoạ bằng chính khối 3D** (mũi tên xoay + tô sáng), không vẽ sơ đồ riêng.
- **Luyện tập có hai nguồn khối**: mẫu có sẵn hoặc quét khối thật.

## 2. Design nguồn

Artifact Claude Design "Rubik 3D — Mobile": `https://claude.ai/artifact/92DEazGKYtr9cYB8nqWQA3`. Đọc bằng tool Artifact (`action: read`, `path: project/<tên>.dc.html`). Các artboard nhóm "Chế độ Người mới học":

| Mã | File | Màn |
|---|---|---|
| N1 | `LearnRoadmap` | Lộ trình 7 giai đoạn. Chạm giai đoạn để mở Mục tiêu/Vì sao, có 2 nút: **Học từ đây** → N3, **Luyện tập** → N5 |
| N2 | `LearnNotation` | Làm quen ký hiệu (cầm khối, 3 loại mảnh, đọc ký hiệu tương tác) |
| N3 | `GuideBeginner` | Hướng dẫn từng bước: lời trước, ký hiệu sau, mũi tên 3D, cụm thuật toán, "Xoay nhầm?", "Ký hiệu là gì?" |
| N4 | `LearnCheckpoint` | Kiểm tra khi xong giai đoạn: hình mẫu + checklist; "Giống rồi" / "Chưa giống — giúp mình sửa" (→ quét lại) |
| N5 | `LearnPracticeSource` | **Mới.** Chọn nguồn khối để luyện: tab "Mẫu có sẵn" (3 mẫu A/B/C) hoặc "Quét khối của mình" |
| N6 | `LearnPractice` | **Mới.** Đang luyện: thẻ mục tiêu có tiến độ (vd 2/4 cạnh), đếm nước đi, Gợi ý, Hoàn tác, Kiểm tra |
| N7 | `LearnPracticeDone` | **Mới.** Hoàn thành: số nước đi, thời gian, số gợi ý, "Bạn vừa làm được…", luyện tiếp/luyện lại/về lộ trình |
| N8 | `LearnPrecondition` | **Mới.** Khối quét chưa đủ điều kiện (vd cần xong tầng 1): checklist điều kiện, 3 lối ra |
| 8 | `DesktopGuide` | Bản desktop của N3 (chưa có desktop cho N5–N8: xem §9) |
| — | `ContentCopy` | **Toàn bộ chữ tiếng Việt** (18 nước đi, 7 giai đoạn, 12 tình huống, từ vựng). Đây là nguồn copy, chép vào JSON, không tự nghĩ chữ |

Luồng:
```
N1 ─ Học từ đây ─→ N3 ─ xong giai đoạn ─→ N4 ─ giống ─→ N3 (giai đoạn kế)
 │                                          └ chưa giống ─→ ScanCamera (quét lại)
 └ Luyện tập ─→ N5 ─ Mẫu ─→ N6 ─ Kiểm tra ─→ N7 ─→ N5 (giai đoạn kế) / N6 (luyện lại) / N1
                  └ Quét ─→ ScanCamera → ScanReview ─→ (đủ điều kiện) N6
                                                      └ (thiếu) N8 ─→ N3 (giai đoạn thiếu) / N5 (dùng mẫu) / ScanCamera
```

## 3. Hiện trạng code (đã xác minh)

- `src/smart-solver/nxn/beginner.ts`: `solveBeginner3(state: CubieState): BeginnerStep[]`. Mỗi `BeginnerStep` = `{ stage, title, moves: Move[], algorithms: string[] }`. **7 `stage` id đúng bằng 7 giai đoạn design**, theo thứ tự: `cross, corners, middle, topCross, topFace, topCorners, topEdges`. Cross làm ở **mặt đáy (D)**.
- Có sẵn các hàm kiểm tra điều kiện (hiện **chưa export**): `crossDone`, `firstLayerDone`, `topCrossDone`, `topFaceDone`, `cornersDone`, `allDone`, `cornerDone(x,i)`, `edgeDone(x,i)`. Dùng lại cho kiểm tra giai đoạn và `precondition`; cần export (không đổi hành vi).
- `src/smart-solver/core/cubie.ts`: `SOLVED`, `applyMoves`, `invertMoves`, `parseAlgorithm`, `isSolved`, `equals`. `core/facelets.ts`: `toFacelets`, `fromFacelets`, `SOLVED_FACELETS`.
- Controller khối 3D trong `src/App.jsx` (`cubeControllerRef`; cho 3x3 có `getFacelets`, `setFacelets` → `{ok,reason?}`, `playMove(move)` (Promise), `highlight(move|null)`, `onUserMove(listener)` → hàm huỷ). Cách dùng: xem `src/smart-solver/ui/GuideView.tsx` và `guidance/fsm.ts` (đã xử lý xoay nhầm bằng cách chèn nước hoàn tác).
- Luồng quét: `ScanView` → kiểm tra màu → `fsm` phase `SCANNING → REVIEWING → SOLVING → GUIDING`. Tab hiện có: `Chơi`, `Giải khối` (`src/ui/TabBar.jsx`, state `activeTab` trong `App.jsx`).
- `ContentCopy §8` ghi: **mũi tên 3D hiện hỗ trợ R, L, U, D và dạng ngược; F, B và nửa vòng (`2`) chưa có** → Phase 2.

Chưa xác minh (làm ở P0): quy ước **xanh lá hướng về người chơi, vàng ở trên** có khớp màu mặc định (`DEFAULT_FACE_COLOR` trong `App.jsx`) và khung toạ độ của solver không; ý nghĩa "trên/dưới/phải/trái" của từng nước so với câu chữ ở `ContentCopy §5`.

## 4. Hợp đồng dữ liệu (để các phase ghép được với nhau)

Đặt trong `src/learn/`. Tên và kiểu dưới đây là **thiết kế đề xuất**, giữ nguyên để các phase sau dùng.

```ts
// src/learn/stages.ts
export type StageId = 'cross' | 'corners' | 'middle' | 'topCross' | 'topFace' | 'topCorners' | 'topEdges'
export interface StageDef {
  id: StageId
  index: number            // 0..6, hiển thị "Giai đoạn index+1/7"
  prerequisite: StageId | null   // giai đoạn phải xong trước (null cho 'cross')
  isDone(state: CubieState): boolean        // dùng các hàm *Done của beginner.ts
}
export const STAGES: readonly StageDef[]

// src/learn/copy/guide-copy.vi.json   (chép từ ContentCopy)
// { moves: { "R'": { title, hint }, ... 18 nước },
//   stages: [{ id, title, goal, why, check }, ... 7],
//   situations: { key: "chuỗi có {tham số}" } }

// src/learn/engine/practice.ts
export interface PracticeSample { id: string; label: string; desc: string; stage: StageId; setup: Move[] /* áp lên SOLVED-đến-prereq */ }
export function buildPracticeState(stage: StageId, sample: PracticeSample): CubieState
export function checkPrecondition(stage: StageDef, state: CubieState): { ok: boolean; missing: StageId[] }
export function stageProgress(stage: StageDef, state: CubieState): { done: number; total: number }  // vd 2/4 cạnh
export function nextHint(stage: StageDef, state: CubieState): { move: Move; stage: StageId } | null   // dùng solveBeginner3, lấy bước đầu thuộc stage
```

Quy tắc:
- **Câu chữ không nằm trong code.** Mọi chuỗi tiếng Việt lấy từ `guide-copy.vi.json`. Số bước/tổng (vd "Bước 3/12", "58 bước") **tính từ `solveBeginner3` của khối thật**, không hardcode (số trong design chỉ là ví dụ).
- Mẫu luyện: `setup` là chuỗi nước **ngược** áp lên khối đã giải đến hết `prerequisite`, để khối thoả `precondition` và chưa thoả `isDone`. Phải có test cho từng mẫu.
- `checkPrecondition`/`isDone` chỉ kiểm **mục tiêu**, không kiểm chuỗi nước người chơi dùng.

## 5. Phases

### P0 — Xác minh giả định và chốt điểm vào (không viết UI)
- Chạy thử khối thật qua `window.__cube` (DEV) và `solveBeginner3`: xác nhận quy ước hướng/màu ở §3 "Chưa xác minh". Ghi kết quả vào mục "Kết quả P0" cuối file này; nếu lệch, báo lại thay vì tự sửa solver.
- Chốt **lối vào** chế độ học: đề xuất nút "Người mới học" ở tab `Giải khối` (trước khi quét) và ở `ScanReview` (design N1 quay về `ScanReview`). Nếu không rõ, hỏi người dùng, không tự chọn.
- Nghiệm thu: ghi chú P0 hoàn tất; không đổi code ứng dụng.

### P1 — Engine + copy (thuần logic, có test)
- Export các hàm `*Done` trong `beginner.ts` (không đổi hành vi). Tạo `src/learn/stages.ts`, `copy/guide-copy.vi.json`, `copy/copy.ts` (`getMove(move)`, `getStage(id)`, `format(key, params)`), `engine/practice.ts`.
- Chép copy từ `ContentCopy` **nguyên văn**.
- Test: (a) cả 18 nước đều có `title`+`hint`; (b) mỗi `StageDef.isDone` đúng/sai trên khối dựng sẵn; (c) mỗi `PracticeSample` thoả `checkPrecondition` và **không** thoả `isDone`; (d) áp lời giải từ `nextHint` lặp lại thì `isDone` thành đúng.
- Nghiệm thu: `pnpm typecheck`, `pnpm test` xanh.

### P2 — Mũi tên F, B và nửa vòng trên khối 3D
- Thêm hiển thị mũi tên cho `F, F', B, B'` và nửa vòng (`R2, L2, U2, D2, F2, B2`: mũi tên kép hoặc nhãn "×2") trong cảnh Three.js (xem `makeArrowGeometry`, `buildArrow` trong `App.jsx`, hiện chỉ R/L/U/D).
- PR riêng, thay đổi tối thiểu, không đổi logic xoay/tween.
- Nghiệm thu: `highlight(move)` hiển thị đúng hướng cho cả 18 nước (kiểm bằng mắt từng nước); test hiện có xanh.

### P3 — N1, N2, N3 (mobile) và nối vào luồng hướng dẫn
- Tạo `src/learn/ui/RoadmapView`, `NotationView`, `StepView` (JSX/TSX, class `rb-*`), theo artboard N1/N2/N3; tái dùng FSM/`GuideView` cho xoay nhầm và theo dõi nước đi; nút "Xoay nhầm?" và "Ký hiệu là gì?" như design.
- N1: chạm giai đoạn mở thẻ; "Học từ đây" bắt đầu `StepView` ở giai đoạn đó (tính bước từ trạng thái hiện tại của khối); "Luyện tập" mở N5 (đến P5 mới có màn, tạm ẩn nút).
- Nghiệm thu: so 390×844 với N1/N2/N3; bấm "Đã xoay xong" hoặc kéo khối thật đều tiến bước; sai nước thì chèn nước hoàn tác.

### P4 — N4 kiểm tra giai đoạn + desktop
- `CheckpointView` (N4): tự kiểm bằng `StageDef.isDone`; nếu đúng, tự đánh dấu các mục checklist và bật "Giống rồi"; nếu chưa chắc, người chơi vẫn đánh dấu tay được (dự phòng). "Chưa giống — giúp mình sửa" mở luồng quét lại sẵn có.
- Desktop theo artboard `DesktopGuide` (breakpoint 960px như `ui-redesign-plan.md`).
- Nghiệm thu: so 1440×900 với `DesktopGuide`; xong giai đoạn thì sang giai đoạn kế đúng.

### P5 — Luyện tập (N5–N8) và chọn giai đoạn tự do
- `src/learn/ui/PracticeSourceView` (N5), `PracticeView` (N6), `PracticeDoneView` (N7), `PreconditionView` (N8); thêm 2 nút trong thẻ giai đoạn N1 ("Học từ đây", "Luyện tập") như design.
- **Mẫu có sẵn** (N5 → N6): mỗi giai đoạn ≥ 3 `PracticeSample` (A dễ / B vừa / C đủ bộ), dựng bằng `buildPracticeState`, nạp vào khối bằng `controller.setFacelets(toFacelets(state))`. Nếu `setFacelets` trả `{ok:false}` (đang bận) thì thử lại sau khi hết animation, không crash.
- **Quét khối** (N5 → ScanCamera → ScanReview): tái dùng nguyên luồng quét; sau khi người chơi xác nhận màu, gọi `checkPrecondition`: thoả → N6 trên chính khối quét; thiếu → N8. Không sửa pipeline vision/scan.
- **N6**: `stageProgress` cập nhật khi người chơi xoay (`onUserMove`); đếm nước đi; "Gợi ý" gọi `nextHint` → `highlight(move)` + hiện câu chữ từ copy; "Hoàn tác" quay lại bằng `invertMoves` của nước cuối; "Kiểm tra" và tự nhận biết đều dựa trên `isDone`. Khi `isDone` đúng → N7.
- **N7**: hiển thị số nước đi, thời gian, số gợi ý (đo bởi state của `useLearn`), "Bạn vừa làm được" lấy từ `copy.stages[i].why`/`goal`; nút "Luyện tiếp" chọn giai đoạn kế (chỉ gợi ý, không bắt buộc).
- **N8**: danh sách `missing` từ `checkPrecondition`; "Làm … trước" → N3 ở giai đoạn thiếu; "Dùng khối mẫu thay thế" → N5 (tab mẫu); "Quét lại khối" → ScanCamera.
- Lưu tiến độ (giai đoạn đã xong/đã luyện) trong `localStorage`, bọc `try/catch`, vẫn chạy khi không lưu được.
- Nghiệm thu: mỗi giai đoạn luyện được từ mẫu A/B/C; quét khối chưa đủ điều kiện hiển thị N8 đúng; trạng thái quét không hợp lệ dùng thông báo `invalidState` trong copy; không còn crash khi `setFacelets` bận.

### P6 — Hoàn thiện
- a11y (nút 44px, `aria-label`, `aria-live` cho gợi ý), thử trên điện thoại thật, kiểm tra không tràn màn ở 360px.
- Nghiệm thu: `pnpm typecheck && pnpm test && pnpm build` xanh.

Thứ tự phụ thuộc: P0 → P1 → (P2 song song P3) → P4 → P5 → P6.

## 6. Rủi ro

- Câu chữ mô tả hướng ("kéo cột phải lên") sai nếu khung toạ độ lệch → P0 là điều kiện tiên quyết cho P3.
- Người học phải giữ nguyên hướng cầm khối; nhắc ở N2/N3.
- Bộ giải có thể chọn thuật toán khác sách (số bước khác ví dụ) → UI đọc số từ solver.
- `setFacelets` trả lỗi khi khối đang bận hoặc facelets không hợp lệ → xử lý `{ok:false}`.
- Quét sai màu → trạng thái không hợp lệ → dùng luồng kiểm tra màu sẵn có.

## 7. Việc ngoài phạm vi

Không làm: bộ giải mới, đổi vision/scan, thêm thư viện, i18n, tài khoản/đồng bộ, desktop cho N5–N8 (xem §9).

## 8. Kết quả P0

1. **Xác minh hướng và màu mặc định (`App.jsx:38`, `stickerModel.ts`):**
   - **Mặt trước (F):** Tọa độ `+z` (camera tại `(0, 3.1, 9)` nhìn về `(0, 0, 0)`). Màu mặc định `COLORS.green` (xanh lá). Khớp hoàn toàn với quy ước **"xanh lá hướng về người chơi"**.
   - **Mặt trên (U) và mặt đáy (D):**
     - Trong `DEFAULT_FACE_COLOR`: `U` (`+y`, trên) là **Trắng** (`COLORS.white`), `D` (`-y`, dưới) là **Vàng** (`COLORS.yellow`).
     - Trong `solveBeginner3` (`beginner.ts`): Giai đoạn 1 `cross` giải trên `CROSS = [DF, DR, DB, DL]` (mặt đáy `D` = Vàng), các giai đoạn sau 4–7 (`topCross`, `topFace`, `topCorners`, `topEdges`) giải trên mặt trên `U` (= Trắng).
     - **Chốt phương án:** Giữ nguyên logic solver hiện tại (mặt đáy D = vàng, mặt trên U = trắng).

2. **Ý nghĩa chiều xoay 18 nước đi:**
   - Đã xác minh qua `stickerModel.test.ts` (18 nước round-trip chuẩn WCA/quy ước 3D):
     - `R` / `R'`: Cột phải xoay lên / xoay xuống (nhìn từ mặt F).
     - `L` / `L'`: Cột trái xoay xuống / xoay lên.
     - `U` / `U'`: Hàng trên gạt sang trái / gạt sang phải.
     - `D` / `D'`: Hàng dưới gạt sang phải / gạt sang trái.
     - `F` / `F'`: Mặt trước xoay theo kim đồng hồ (sang phải) / ngược kim đồng hồ (sang trái).
     - `B` / `B'`: Mặt sau xoay theo kim đồng hồ / ngược kim đồng hồ (nhìn từ sau).
     - `*2`: Xoay nửa vòng 180°.

3. **Mũi tên 3D (Three.js trong `App.jsx`):**
   - Đã kiểm tra hàm `buildArrow` và `makeArrowGeometry`: Hiện tại `buildArrow` đã có code hỗ trợ cả trục `z` (`F`, `B`) và `heads = 2` cho nước nửa vòng (`*2`), sẽ kiểm tra trực quan ở Phase 2 để tinh chỉnh hoàn thiện.

4. **Chốt lối vào chế độ học:**
   - **Vị trí 1 (tab Giải khối):** Đặt nút "Người mới học" ở `ScanView` (màn hình bắt đầu trước khi bật camera quét).
   - **Vị trí 2 (`ScanReview`):** Sau khi quét xong khối thật, có nút "Luyện tập với khối này" dẫn sang N5/N6.

5. **Nguồn copy (`ContentCopy`):**
   - Chờ người dùng paste nội dung hoặc gửi file copy để bắt đầu Phase 1.

**Nghiệm thu P0:** Đạt. Ghi chú P0 hoàn tất; không đổi code ứng dụng.

## 8.1 Kết quả P1

1. Đã export các hàm kiểm tra điều kiện `*Done` trong `src/smart-solver/nxn/beginner.ts`.
2. Tạo `src/learn/stages.ts` định nghĩa 7 giai đoạn `StageDef` và `STAGES`.
3. Tạo `src/learn/copy/guide-copy.vi.json` và `src/learn/copy/copy.ts` chứa toàn bộ câu chữ 18 nước đi và 7 giai đoạn.
4. Triển khai `src/learn/engine/practice.ts` với `buildPracticeState`, `checkPrecondition`, `stageProgress`, `nextHint`, cùng 21 mẫu luyện tập (`PRACTICE_SAMPLES`).
5. `src/learn/learn.test.ts` gồm 8 test suites kiểm tra đầy đủ các yêu cầu (a), (b), (c), (d).

**Nghiệm thu P1:** Đạt. `pnpm typecheck` và `pnpm test` xanh 100%.

## 8.2 Kết quả P2

1. **Mũi tên F, B trên trục z:**
   - Đã xác thực trục `z` trong `buildArrow` tạo đúng các mũi tên bao quanh khối và vòng xoáy (pinwheel) trên nắp mặt F (`+z`) và B (`-z`).
2. **Nước đi nửa vòng 180° (`*2`):**
   - Đã sửa lỗi dấu chiều xoay của các nước nửa vòng (`R2, U2, F2, L2, D2, B2`) trong `src/smart-solver/adapter/stickerModel.ts` và `src/smart-solver/adapter/nxnModel.ts`: `turns === 2 ? cw * 2 : ...`. Giúp mũi tên của cả 6 nước nửa vòng luôn chỉ cùng chiều kim đồng hồ với nước đơn tương ứng.
3. **Hình học mũi tên kép (`>>`):**
   - Tinh chỉnh `makeArrowGeometry` trong `src/App.jsx`: thêm góc khuyết (notch) vào đuôi mỗi chevron và điều chỉnh khoảng cách `step` để khi `heads = 2`, 2 mũi tên kép tách bạch rõ ràng, sắc nét dạng `>>`, thân mũi tên ăn khớp vào đuôi chevron.
4. **Kiểm thử tự động:**
   - Bổ sung test kiểm tra `F`, `B` và dấu/độ lớn góc xoay của toàn bộ các nước nửa vòng trong `src/smart-solver/adapter/stickerModel.test.ts`.

**Nghiệm thu P2:** Đạt. `pnpm typecheck`, `pnpm test`, `pnpm build` xanh 100%.

## 8.3 Kết quả P3

1. **Giao diện N1, N2, N3 (`src/learn/ui/`):**
   - Tạo [RoadmapView.tsx](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/learn/ui/RoadmapView.tsx) (N1): Lộ trình 7 giai đoạn, mở thẻ xem Mục tiêu / Vì sao / Tiêu chí kiểm tra, có nút "Học từ đây" bắt đầu hướng dẫn tại giai đoạn đó.
   - Tạo [NotationView.tsx](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/learn/ui/NotationView.tsx) (N2): Quy ước cầm khối, 3 loại mảnh Rubik, và bảng tra cứu tương tác 18 ký hiệu (kèm highlight trực quan trên khối 3D).
   - Tạo [StepView.tsx](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/learn/ui/StepView.tsx) (N3): Hướng dẫn từng bước với tên tiếng Việt, thẻ Hero card, dãy nước đi, nút "Xoay nhầm?" và "Ký hiệu là gì?".
2. **Nối vào luồng SmartSolverPanel & ScanView:**
   - Kết nối lối vào "Chế độ Người mới học" ở `ScanView` và tab segmented "Người mới học" trong `SmartSolverPanel`.
   - Nút "Học từ đây" khởi tạo lời giải `solveBeginner3`, nạp mẫu luyện tập nếu giai đoạn đã xong, và bắt đầu hướng dẫn tại giai đoạn đã chọn.
   - Tái dùng FSM: bấm "Đã xoay xong" hoặc kéo xoay khối 3D trực tiếp đều tiến bước; xoay nhầm sẽ kích hoạt luồng hoàn tác `RECOVERING`.
3. **Kiểm thử tự động:**
   - Tạo `src/learn/learnFlow.test.ts` kiểm tra dữ liệu N1, N2, và bước tiến / hoàn tác N3.

**Nghiệm thu P3:** Đạt. `pnpm typecheck`, `pnpm test` (26 test files / 199 tests), `pnpm build` xanh 100%.

## 8.4 Kết quả P4

1. **Màn kiểm tra giai đoạn CheckpointView (N4):**
   - Tạo [CheckpointView.tsx](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/learn/ui/CheckpointView.tsx) (N4): tự động kiểm tra `StageDef.isDone(cube)`; nếu khối thoả mãn tiêu chí, tự đánh dấu toàn bộ checklist và bật nút "Giống rồi".
   - Dự phòng thủ công: người chơi có thể tự bấm chọn từng tiêu chí trong danh sách checklist để kiểm tra và kích hoạt "Giống rồi".
   - Hai nút hành động: "Giống rồi" (tiến sang giai đoạn kế tiếp, hoặc hoàn thành nếu là giai đoạn cuối) và "Chưa giống — giúp mình sửa" (kích hoạt luồng quét lại khối).
   - Tích hợp nút "Kiểm tra" ngay trên header của [StepView.tsx](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/learn/ui/StepView.tsx) và tự động chuyển sang `CheckpointView` khi hoàn tất toàn bộ nước đi của giai đoạn.
2. **Giao diện Desktop (≥ 960px):**
   - Tích hợp chế độ "Người mới học" trong layout desktop 3 cột: Cột trái (Playground controls, 320px), Cột giữa (3D Rubik stage căn giữa), Cột phải (`.rb-shell__right--open`, 440px) hiển thị `RoadmapView`, `NotationView`, `StepView`, hoặc `CheckpointView`.
   - Đáp ứng mượt mà cả mobile (`390×844`) và desktop (`1440×900`), đảm bảo toàn bộ kích thước, token CSS và font chữ khớp thiết kế.
3. **Kiểm thử tự động:**
   - Mở rộng [learnFlow.test.ts](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/learn/learnFlow.test.ts) kiểm tra export `CheckpointView`, tiêu chí checklist cho cả 7 giai đoạn, kiểm tra tự động `isDone` trên khối đã giải và khối mẫu, tính tuần tự chuyển giai đoạn, và định dạng chuỗi tiếng Việt.
   - Bổ sung các khóa copy tiếng Việt vào `guide-copy.vi.json`, 100% tuân thủ quy tắc không hardcode chuỗi trong code.

**Nghiệm thu P4:** Đạt. `pnpm typecheck`, `pnpm test` (26 test files / 204 tests passed, 1 skipped), `pnpm build` xanh 100%.

## 8.5 Kết quả P5

1. **Giao diện N5–N8 (`src/learn/ui/`):**
   - [PracticeSourceView.tsx](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/learn/ui/PracticeSourceView.tsx) (N5): Chọn nguồn khối để luyện — tab "Mẫu có sẵn" (mỗi giai đoạn ≥ 3 mẫu A/B/C) hoặc "Quét khối của mình" để quét khối thật.
   - [PracticeView.tsx](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/learn/ui/PracticeView.tsx) (N6): Màn hình đang luyện tập — thanh tiến độ thực tế theo `stageProgress` (vd: 2/4 cạnh), đếm số nước đi, đồng hồ thời gian, nút "Gợi ý" (`nextHint` + tô sáng mũi tên 3D và hiện câu chữ), nút "Hoàn tác" đảo chiều nước vừa xoay, nút "Kiểm tra" và tự động phát hiện `isDone` để hoàn thành.
   - [PracticeDoneView.tsx](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/learn/ui/PracticeDoneView.tsx) (N7): Màn chúc mừng hoàn thành luyện tập — hiển thị chi tiết số nước, thời gian, số gợi ý, tóm tắt "Bạn vừa đạt được", các nút "Luyện tiếp", "Luyện lại mẫu này", "Về lộ trình".
   - [PreconditionView.tsx](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/learn/ui/PreconditionView.tsx) (N8): Hiển thị khi khối quét chưa thoả mãn điều kiện tiên quyết của giai đoạn — liệt kê giai đoạn thiếu cùng 3 lối ra ("Học giai đoạn thiếu trước", "Dùng khối mẫu thay thế", "Quét lại khối").
2. **Lưu trữ tiến độ an toàn (`src/learn/engine/storage.ts`):**
   - Lưu trữ danh sách giai đoạn đã hoàn thành (`completed`) và đã luyện tập (`practiced`) vào `localStorage`, có cơ chế fallback in-memory, bọc `try/catch` hoàn toàn không gây crash.
   - Tích hợp nút "Luyện tập" trên từng thẻ giai đoạn ở [RoadmapView.tsx](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/learn/ui/RoadmapView.tsx) (N1), hiển thị badge "Đã luyện" và dấu ✓ hoàn thành.
3. **An toàn điều khiển khối 3D:**
   - Cơ chế nạp facelets với hàm `applyFaceletsSafely`: tự động thử lại khi khối đang xoay animation (`busy`), tránh crash.
   - Thao tác kéo xoay trực tiếp trên khối 3D trong phiên luyện tập được cập nhật thẳng vào bộ đếm và tiến độ riêng của N6, không làm lệch FSM hướng dẫn giải chính.
4. **Kiểm thử tự động:**
   - Mở rộng [learnFlow.test.ts](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/learn/learnFlow.test.ts) kiểm tra export N1–N8, xác thực cả 21 mẫu luyện thoả mãn precondition, kiểm tra nhận diện thiếu điều kiện N8, tiến độ stageProgress, gợi ý nextHint, và lưu trữ localStorage.

**Nghiệm thu P5:** Đạt. `pnpm typecheck`, `pnpm test` (26 test files / 204 tests passed, 1 skipped), `pnpm build` xanh 100%.

## 8.6. Kết quả P6 — Hoàn thiện & Khả năng tiếp cận (a11y)

1. **Khả năng tiếp cận (Accessibility - a11y):**
   - **Vùng bấm chuẩn cảm ứng (Touch Target):** Mọi nút bấm, tab điều khiển (`rb-seg__item`), nút đóng/quay lại (`rb-icon-btn`), nút xem ký hiệu, nút thẻ giai đoạn, và các ô chọn nước xoay đều đạt kích thước tối thiểu $\ge 40\text{px} - 52\text{px}$ (chuẩn WCAG 2.1).
   - **Nhãn hỗ trợ đọc màn hình (`aria-label`, `aria-expanded`, `aria-selected`):** Bổ sung đầy đủ nhãn ngữ nghĩa cho các nút icon, tab chọn mặt Rubik, thẻ nước đi, thông số luyện tập, và nút thoát/dừng luyện.
   - **Thông báo động cho Screen Reader (`aria-live="polite"`, `role="status"`):**
     - Thẻ gợi ý nước đi (`Active Hint Card`) và thông báo phản hồi trong [PracticeView.tsx](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/learn/ui/PracticeView.tsx) (N6) tự động thông báo khi có gợi ý mới.
     - Cảnh báo trạng thái xoay nhầm/phục hồi trong [StepView.tsx](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/learn/ui/StepView.tsx) (N3).
     - Banner tự động kiểm tra giai đoạn trong [CheckpointView.tsx](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/learn/ui/CheckpointView.tsx) (N4).

2. **Chống tràn màn hình ở viewport hẹp 360px:**
   - Đã bổ sung quy tắc `.rb-learn-*` trong [src/styles/tokens.css](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/styles/tokens.css): `width: 100%; max-width: 100%; box-sizing: border-box; overflow-x: hidden;`.
   - Các cụm nút hành động đôi ("Sửa lại" / "Giải", "Quét lại" / "Tiếp tục", "Học từ đây" / "Luyện tập") được bổ sung `flex-wrap: wrap` và `min-width: 0` để linh hoạt co giãn không bị xô lệch hay tràn viền trên màn hình 360px (và 320px).

3. **Toàn bộ nội dung tập trung:**
   - 100% câu chữ giao diện và nhãn a11y được khai báo trong [src/learn/copy/guide-copy.vi.json](file:///Users/ocn/Documents/Ocany_sources/rubik-landing/src/learn/copy/guide-copy.vi.json), không có chuỗi cứng rải rác.

4. **Nghiệm thu toàn diện:**
   - `pnpm typecheck`: Exit code 0 (TypeScript strict không lỗi).
   - `pnpm test`: 26/26 test suites passed (213 passed, 1 skipped).
   - `pnpm build`: Bản dựng Vite production thành công trong 2.14s.

## 8.7 Kết quả P7 — Sửa sau review

1. Checkpoint dựa trên khối thật: giai đoạn đang học = `stageInProgress(guide.cube)` (`engine/stagePlan.ts`), checkpoint mở khi giai đoạn chuyển tiếp hoặc khối xong; không còn nhầm "step" của solver với "giai đoạn", không còn vòng lặp checkpoint.
2. "Học từ đây": kiểm `checkPrecondition` (thiếu → N8), không cắt step, không ghi đè khối thật (chỉ nạp mẫu khi khối đã giải hoàn toàn); lời giải do solver effect tính qua chuỗi `START_SCAN → SCANNED → CONFIRM_REVIEW`.
3. `scanModeForPractice` được tắt khi đổi chế độ/huỷ; `ScanView` không còn bị gỡ khi mở màn học (chỉ ẩn).
4. Mẫu luyện: cross/topFace/topEdges/topCross đổi lại để độ khó tăng dần A→C; `label`/`desc` chuyển vào `guide-copy.vi.json` (`practiceSamples`).
5. N6: gợi ý/highlight bị xoá khi xoay, bấm lại không tăng bộ đếm; reset kế hoạch gợi ý khi vào/ra phiên.
6. Chuỗi cứng còn sót trong `StepView`/`PracticeView`/`RoadmapView` chuyển vào JSON; màu hex thay bằng token `--rb-success-*`; bỏ nút "Tự động xoay" chạy `playMove` hai lần.
7. Chưa làm: tách `useLearn` khỏi `SmartSolverPanel`; chưa chạy thử UI trên trình duyệt/điện thoại; mô tả hình dạng (L/đường thẳng) của mẫu topCross chưa kiểm.

## 9. Nợ kỹ thuật (làm sau)

- [ ] **2x2** (`beginner.ts` đã có `bottom`, `oll`, `pbl`).
- [ ] **4x4, 5x5**: rút gọn (tâm, ghép cạnh) rồi giải như 3x3; `NxnController` đủ để demo.
- [ ] Quét-để-luyện cho size khác 3x3 (`NxnScanView`).
- [ ] **Desktop cho N5–N8** (hiện chỉ có mobile).
- [ ] Khoá giai đoạn theo thứ tự (tuỳ chọn) và lộ trình gợi ý.
- [ ] Luyện riêng từng thuật toán (Sune, A-perm, U-perm…).
- [ ] Sơ đồ minh hoạ riêng nếu mũi tên 3D chưa đủ rõ.
- [ ] Phương pháp nâng cao (F2L, OLL/PLL, CFOP).
- [ ] Đồng bộ tiến độ qua tài khoản (hiện chỉ localStorage).
- [ ] Đa ngôn ngữ cho `guide-copy`.

## 10. Bài 1 — Làm quen khối và ký hiệu (ĐÃ CHỐT; chỉ thêm trang Lớp giữa M/E/S ngày 2026-10-16)

UI và nội dung bài 1 đã được duyệt. Không sửa nếu chưa được yêu cầu; dùng làm mẫu (template) cho các bài sau.

**Cấu trúc (14 trang, 5 phần; thêm phần "Lớp giữa": M, E, S với ′ và 2)** — nội dung ở `src/learn/copy/lesson1.ts`, hiển thị ở `src/learn/ui/NotationView.tsx`, khung điều hướng chung ở `src/learn/ui/LessonPlayer.tsx`.
1. Cấu trúc khối: tổng quan, tâm (6), cạnh (12), góc (8). Tâm/cạnh/góc phát sáng đúng màu của ô.
2. Các mặt: chọn mặt trước (Front) trước, rồi U, D, R, L, B; mỗi mặt phát sáng khi được nói tới. Ký hiệu phụ thuộc mặt trước đã chọn (`src/learn/frame.ts`).
3. Ký hiệu xoay: chữ cái (theo kim đồng hồ), dấu ′ (ngược), số 2 (nửa vòng). Mỗi trang thêm một option dưới các option trước; chọn mặt U/D/R/L/F/B ở trên. Hình "trước → sau" của nước xoay.
4. Trước và sau: khối xáo trộn `R U R′ U′ F′ U2 L D2` → mũi tên → khối hoàn thành. Mẫu cho các bước của bài sau.

**Quy tắc template**
- Hình minh hoạ là khối mini tĩnh (`MiniCube.jsx`), có thể làm sáng tâm/cạnh/góc/mặt, xem từ phía trước hoặc sau.
- Khối 3D chính ẩn khi học (mobile); chỉ mở bằng nút "Thực hành", và nút này chỉ có ở 3 trang ký hiệu xoay. Trên desktop khối 3D luôn hiện.
- Nút thu gọn panel (mobile) chỉ xuất hiện khi khối 3D đang hiện.
- Quay lại / Thực hành / Tiếp theo dính ở đáy vùng cuộn; luôn có nút "Bỏ qua".
- Ghi chú cuối bài: ký hiệu chỉ là cách gọi tên để hướng dẫn, khi đã hiểu sẽ xoay theo bản năng.

## 11. Quy tắc chung cho hướng dẫn "Gợi ý" của các bài (từ Bài 2)

Không dùng lời giải tối ưu của solver để hướng dẫn người mới (xoay được nhưng không hiểu). Thay vào đó:

1. Mỗi lần bấm Gợi ý chỉ chọn **một** khối cần đưa về đích: khối dễ thấy/dễ làm nhất. Làm xong khối đó thì dừng.
2. UI lúc hướng dẫn chỉ phát sáng **tâm của mặt đang lắp** và **khối đang di chuyển**. Không phát sáng gì khác.
3. Xác định khối đang ở **trường hợp nào** rồi rẽ nhánh `if / else` theo bộ công thức của bài. Mỗi nhánh là một vài bước ngắn.
4. Mỗi nhánh phải **ghi văn bản giải thích vì sao** làm như vậy, không chỉ liệt kê nước đi.
5. Nếu khối đã đúng chỗ thì không làm gì.

Bài 2 (dấu cộng ở mặt đáy D; "mặt vàng" là mặt đang lắp): 4 trường hợp cho khối cạnh cần lắp
- Đã đúng chỗ, đúng mặt: không làm gì.
- Đã ở tầng đáy nhưng sai chỗ hoặc sai mặt (lật ngược): đưa lên rồi lắp xuống lại; sai mặt thì đảo mặt trước khi lắp.
- Ở tầng giữa (4 vị trí): xoay một nước là lên đúng chỗ, đúng mặt thì hướng dẫn một bước; không được thì 2 động tác: đưa lên tầng trên mà không làm xáo dấu cộng đang có, rồi đưa tới vị trí thích hợp để lắp.
- Ở tầng trên cùng: đặt vào vị trí phù hợp để lắp xuống.

**Đã chốt:** "trục giữa" = lớp giữa. M (giữa L–R, cùng chiều L), E (giữa U–D, cùng chiều D), S (giữa F–B, cùng chiều F).

**Cài đặt hiện tại của Gợi ý Bài 2** (`src/learn/guide/crossGuide.ts`, mô phỏng khối thật ở `physical.ts`):
- Chọn khối: tầng giữa xoay một nước là xong → tầng trên → tầng đáy sai chỗ/mặt → tầng giữa phải hai động tác.
- Lắp từ tầng trên (mặt vàng lên trên): `[xoay U cho đúng chỗ] lớp giữa xuống, D2, lớp giữa lên`. Mặt vàng nằm bên hông: `[U] D, lớp giữa xuống, D', lớp giữa lên` (hoặc D′…D). Mỗi công thức đều được kiểm tra bằng mô phỏng: khối vào đúng chỗ VÀ các cạnh đã lắp không bị xáo. Nếu không công thức nào an toàn thì dùng chuỗi ngắn nhất (≤4 nước) kiểm chứng tương tự.
- Tầng đáy sai: xoay mặt chứa nó nửa vòng để đưa lên tầng trên, rồi lắp như trên.
- Tầng giữa không xuống thẳng được: đưa lên tầng trên (có bảo vệ dấu cộng: mặt, U, mặt ngược) rồi lắp.
- Mỗi bước có câu giải thích. Chỉ phát sáng tâm mặt đáy (D) và đúng một khối đang di chuyển.
- Giả định: các tâm đang ở chỗ cũ khi bấm Gợi ý.

## 12. Bài 2 — Dấu cộng ở tầng đầu (ĐÃ CHỐT)

UI, gợi ý (`src/learn/guide/crossGuide.ts`), mức độ Dễ/Trung bình/Khó với xáo ngẫu nhiên (`generateCrossScramble` trong `src/learn/copy/lesson2.ts`) và cách xử lý nước nửa vòng (xoay lần 1/2 không bị coi là sai) đã được duyệt. Không sửa nếu chưa được yêu cầu. Mẫu cho các bài sau: `CrossLessonView.tsx` + `LessonPlayer.tsx` + `guide/physical.ts`.

## 13. Bài 3 — Lắp các khối góc (ĐÃ CHỐT)

Cài đặt: `src/learn/guide/cornerGuide.ts`, `src/learn/copy/lesson3.ts`, `src/learn/ui/CornerLessonView.tsx`. Cần dấu cộng xong trước.
- Chỉ phát sáng tâm mặt đáy (D) và đúng một góc đang di chuyển.
- Ba trường hợp: (1) góc ở tầng trên, mặt vàng ở hông → lắp xuống; (2) góc ở tầng trên, mặt vàng hướng lên → lật sang hông rồi lắp; (3) góc ở tầng đáy nhưng sai → đưa lên tầng trên rồi như (1)/(2). Góc đã đúng thì bỏ qua.
- Cả ba đều là cùng một công thức 3 nước: `mặt bên, xoay tầng trên, mặt bên ngược lại` (đổi mặt bên, hướng và số lần xoay U cho khớp; có thể thêm một nước U căn trước). Mô phỏng khối thật kiểm chứng: góc vào đúng chỗ, dấu cộng và các góc đã lắp không bị xáo.
- Mức Dễ/Trung bình/Khó: xáo ngẫu nhiên bằng các khối `mặt bên – U – mặt bên ngược` (không phá dấu cộng), kiểm tra lệch 1/2/4 góc.

**Bài 3 đã chốt** (2026-10-16): không sửa nếu chưa được yêu cầu.

## 14. Bài 4 — Lắp các cạnh tầng giữa (ĐÃ CHỐT)

Cài đặt: `src/learn/guide/middleGuide.ts`, `src/learn/guide/middleAlgs.ts`, `src/learn/copy/lesson4.ts`, `src/learn/ui/MiddleLessonView.tsx`. Cần tầng đầu (dấu cộng + 4 góc) xong trước.
- Chỉ một công thức và bản đối xứng: phải `U R U' R' U' F' U F`, trái `U' L' U L U F U' F'`. Xoay quanh trục đứng (F→R→B→L) cho 4 rãnh, nên không cần người học đổi cách cầm khối.
- Hai trường hợp: (1) cạnh ở tầng trên (cạnh không có màu trắng/vàng) → xoay U cho màu trước khớp tâm, rồi dùng công thức hướng theo màu còn lại; (2) cạnh ở tầng giữa nhưng sai chỗ/ngược → dùng chính công thức ở rãnh đó để đẩy nó lên tầng trên, rồi như (1).
- Giải thích theo nhịp: nhịp 1 `U R U' R'` đưa góc tầng đầu lên đứng cạnh khối cạnh thành một cặp; nhịp 2 `U' F' U F` trượt cả cặp xuống. Phát sáng: hai tâm mà cạnh nằm giữa, và đúng cạnh đang di chuyển.

## 15. Bàn giao cho người làm tiếp (Bài 5 trở đi) — các quyết định đã chốt

Bài 1–4 đã chốt, không sửa nếu chủ dự án chưa yêu cầu. Chạy `pnpm typecheck`, `pnpm test`, `pnpm build` sau mỗi thay đổi; `pnpm` là bắt buộc (không `npm`/`yarn`), không tự `pnpm install`, không thêm thư viện. Chưa commit gì (nhánh `enhance/mobile-UI`); chỉ commit khi được yêu cầu, không push.

### 15.1 Cấu trúc ứng dụng (menu)
- `App.jsx` giữ `section` (`null` = danh sách menu, hoặc `learn` / `scan` / `solve`). Menu: **Học chơi Rubik**, **Quét Rubik**, **Giải** (giải nhanh / cơ bản). Camera chỉ bật ở mục Quét (và khi người học chủ động quét trong bài học); các mục khác không bao giờ bật camera.
- Mobile: tab "Menu" thay cho "Giải khối". Khối 3D bị ẩn khi đang xem lộ trình hoặc một bài học, chỉ hiện khi bấm "Thực hành". Nút thu gọn panel chỉ có khi khối 3D đang hiện. Desktop: khối 3D luôn hiện, không có nút thu gọn.
- Lộ trình: Bài 1 = Làm quen khối và ký hiệu; Bài 2–8 = 7 giai đoạn giải (cross, corners, middle, topCross, topFace, topCorners, topEdges). Giai đoạn có bài riêng (`lessonStageIds` trong `SmartSolverPanel.tsx`) mở thẳng bài khi chạm; còn lại vẫn là thẻ mở rộng cũ.

### 15.2 Khung bài học (dùng lại)
- `LessonPlayer.tsx`: điều hướng từng trang, thanh tiến độ, nút **Bỏ qua** luôn có, footer dính đáy (Quay lại / Thực hành / Tiếp theo). `practiceFor(page)` quyết định trang nào có nút Thực hành.
- `MiniCube.jsx`: khối 3D tĩnh để minh hoạ (làm sáng tâm/cạnh/góc/mặt/lớp giữa/ô theo toạ độ, xem từ trước, sau hoặc đáy, áp dụng chuỗi xoay `turns`). Trang đầu của mỗi bài: ảnh trước → mũi tên → ảnh sau, banner "Đang lắp", mục tiêu, khung "Vì sao?".
- Bài giảng có thực hành mới: sao chép mẫu `MiddleLessonView.tsx` (bài 4) + `copy/lessonN.ts` + `guide/xxxGuide.ts`, rồi nối vào `SmartSolverPanel.tsx` (kiểu `LearnScreen`, `stageHidden`, điều kiện `onUserMove`, `lessonStageIds`, `onOpenLesson`, khối render).

### 15.3 Quy tắc "Gợi ý" (bắt buộc cho mọi bài)
1. Không dùng lời giải tối ưu của solver để hướng dẫn. Mỗi lần bấm Gợi ý chỉ lo **một** khối, xong thì dừng.
2. Chọn khối "dễ thấy nhất" theo thứ tự ưu tiên riêng của bài; khối đã đúng thì bỏ qua.
3. Rẽ nhánh theo trường hợp, mỗi nhánh có câu **giải thích vì sao**, theo từng bước.
4. Khi bật hướng dẫn chỉ phát sáng đúng thứ cần thiết (tâm mặt đang lắp/hai tâm liên quan + một khối đang di chuyển). Khi không bật hướng dẫn: chỉ phát sáng các khối còn cần lắp.
5. Người học xoay khác hướng dẫn: báo "Bạn đã xoay khác hướng dẫn. Bấm Hoàn tác để quay lại", **không phát sáng khối nào**; quay về bất kỳ trạng thái nào trên đường đi (kể cả bằng Hoàn tác) thì hướng dẫn tự tiếp tục đúng bước đó (`guide/follow.ts`).
6. Nước nửa vòng (`X2`) gồm hai lần xoay: lần đầu theo cả hai chiều là tiến độ, không phải sai (`halves` trong guide).
7. Mỗi guide trả về: `steps` (ký hiệu theo vị trí cố định + câu giải thích), `states` (trạng thái tâm-tương-đối sau mỗi bước, khớp với cách app đọc nước xoay), `halves`, ô cần phát sáng. Kiểm chứng bằng mô phỏng (`guide/physical.ts`): khối đích vào đúng chỗ và phần đã lắp không bị xáo; test chạy hàng trăm khối ngẫu nhiên (xem `*Guide.test.ts`).

### 15.4 Quyết định kỹ thuật cần biết
- **Ký hiệu:** 18 nước mặt + lớp giữa M (giữa L–R, cùng chiều L), E (giữa U–D, cùng chiều D), S (giữa F–B, cùng chiều F), đều có `′` và `2`. Ký hiệu trong guide là vị trí cố định (sau M thì `D2` vẫn là mặt đáy thật). Mặt trước do người học chọn chỉ có tác dụng trong bài 1 (`learn/frame.ts`).
- **Mặt đang lắp:** mặt đáy D (màu vàng theo bảng màu mặc định), tầng trên là U (trắng); công thức bài 4 dùng U ở trên.
- **Công thức đã chốt:** bài 2: lớp giữa xuống / `D2` / lớp giữa lên (+ biến thể xoay D, chọn biến thể nào kiểm chứng an toàn, có dự phòng chuỗi ngắn ≤4 nước); bài 3: một công thức 3 nước `mặt bên, U, mặt bên ngược` dùng cho lắp, lật (mặt vàng hướng lên) và đưa góc sai ở đáy lên; bài 4: `U R U' R' U' F' U F` và `U' L' U L U F U' F'` xoay quanh trục đứng cho 4 rãnh.
- **Thực hành:** ba mức Dễ/Trung bình/Khó, xáo ngẫu nhiên nhưng kiểm tra độ khó (số khối lệch 1/2/4) và giữ phần đã làm của các bài trước (`generateXxxScramble`).
- **Theo dõi khối:** `SmartSolverPanel` giữ khối đang luyện (`practiceCube`) và đọc lại từ khối 3D sau mỗi lần xoay/Hoàn tác (`syncFromScene`) để không lệch. Hoàn tác xoay ngược đúng lớp cố định vừa xoay (kể cả lớp giữa, có hoạt ảnh) qua `playTurn` + `inverseToken`.
- **Khối 3D (`App.jsx`, `adapter/types.ts`):** `spotlight(target)` (bài 1: tâm/cạnh/góc/mặt), `mark(cells)` (phát sáng ô theo toạ độ, giữ khi đổi mũi tên), `highlightTurn(token)` (lớp theo vị trí cố định, dùng cho lớp giữa), `highlight(move)` (theo tâm).

### 15.5 Giới hạn đã biết
- Guide giả định các tâm đang ở chỗ cũ khi bấm Gợi ý.
- Chỉ 3x3 trong chế độ học. Chế độ giải "Cơ bản" ở mục Giải và các bài 6–8 (chưa có bài riêng) vẫn dùng bộ giải `solveBeginner3` (`nxn/beginner.ts`), không theo quy tắc 15.3.
- Chưa có bản desktop riêng cho các bài học và chưa kiểm thử trên thiết bị thật; phần giao diện chủ yếu đã được duyệt bằng mắt của chủ dự án.
- Nhiều chuỗi chữ tiếng Việt nằm thẳng trong code (`copy/lessonN.ts`, các `*Guide.ts`); `guide-copy.vi.json` chỉ giữ chữ của bộ luyện tập cũ.


## 16. Bài 5 — Dấu cộng tầng vàng ở đáy (đã chốt cùng Bài 1–4)

Cài đặt: `guide/topCrossGuide.ts`, `copy/lesson5.ts`, `ui/TopCrossLessonView.tsx`. Tên file và stage id `topCross` được giữ để tương thích, nhưng mặt đích hiện là **D vàng ở đáy**. Cần tầng trắng U và tầng giữa xong trước (`learn/goals.ts`).

- Lộ trình: mục tiêu/khối trước-sau → nhận diện chữ L/hai cạnh đối/chấm → chọn cách học → công thức và thực hành. Không chọn sẵn phương pháp.
- Công thức chữ L nguyên bản chủ dự án: **L′ F′ D F L B D′ B′**; căn chữ L ở **DF–DR (trước–phải)**. Hình chấm dùng hai lượt liên tiếp, không cần căn giữa hai lượt.
- Công thức đối là bản quy đổi của phương pháp 6 nước cũ sang đích D: **B R D R′ D′ B′**; căn hai cạnh ở **DL–DR**. Nếu dùng riêng công thức này cho chữ L, căn L ở **DF–DL** rồi chuyển qua hai cạnh đối.
- Cách **một công thức** dùng công thức L gốc cho mọi trường hợp: mức Dễ/Trung bình/Khó (đối/L/chấm) cần 2/1/2 lượt. Đối → L (căn lại D) → cộng; chấm → L → cộng không cần căn giữa hai lượt. Cách **hai công thức** dùng L gốc và công thức đối, cần 1/1/2 lượt. Hình minh hoạ, công thức và gợi ý thực hành theo cùng lựa chọn này.
- Đếm nước, lời giải thích, gợi ý, căn D, mũi tên, phát sáng, nhận diện nước nửa vòng và Hoàn tác theo khối thật. Chỉ tâm D và một cạnh được theo dõi khi bật Gợi ý. Hai tầng phía trên phải được khôi phục sau mỗi lượt.
- Khối minh hoạ nhìn từ dưới, trạng thái sau được dựng từ cùng khối trước; chưa yêu cầu góc vàng hay màu cạnh bên khớp tâm.
- Đã kiểm tra công thức từ log chủ dự án, mô phỏng từng nước và 300 mẫu cho mỗi phương pháp; chưa kiểm tra UI trên thiết bị thật.

### 16.1 Ghi công thức do người học cung cấp

- Nút **Bật ghi log công thức** đặt ngay dưới **Xáo trộn / Reset** trong `PlayShell` (desktop và tab Chơi trên mobile); không cần mở Bài 5. `useFormulaRecorder` giữ phiên ghi ở App nên đổi layout không làm mất log.
- Ghi trực tiếp `onUserTurn` từ khối 3D, giữ token lớp cố định và snapshot stickers gốc cùng facelets tương đối tâm. Log `rubik-formula-v2` tái hiện được từ bất kỳ khối bắt đầu nào, cả khi các tâm đã di chuyển; nhận diện M/E/S.
- **Dừng và in log** in ra Console, có **Sao chép log** và ô văn bản dự phòng. Reset/xáo trộn/đổi scene tự dừng và giữ log. Bắt đầu phiên mới xoá bản ghi cũ. Nếu có thay đổi ngoài nước kéo tay giữa hai bước, dừng và báo để tránh tạo chuỗi không tái hiện được.
- Đã kiểm tra vị trí nút bằng render desktop/mobile và tái hiện từ snapshot có tâm đổi chỗ. Chưa thử UI trực tiếp trên trình duyệt.

## 17. Đổi hướng lắp và quét — ĐÃ TRIỂN KHAI, CHỜ DOUBLE CHECK

Chủ dự án đã cho phép thực hiện sau đánh giá ảnh hưởng. Khung vật lý/các màu vẫn là **U trắng, D vàng, F xanh lá, R đỏ**. Thứ tự học là **tầng trắng ở trên → tầng giữa → tầng vàng ở đáy**.

### 17.1 Kiến trúc

- `learn/orientation.ts`: phép quy đổi x2 cho trạng thái/công thức của phương pháp cũ, bao gồm đổi vị trí và nhãn màu để SOLVED vẫn là SOLVED; scene không bị lật/repaint. Có kiểm tra đảo ngược và tính nhất quán trạng thái/nước xoay trên 100 khối.
- `learn/goals.ts`: điều kiện và danh sách mảnh vật lý riêng cho lộ trình học. Cross/góc đầu kiểm U; tầng cuối kiểm D. Không thay các predicate nội bộ của solver cũ vốn dùng D trước.
- `learn/engine/solveLearning.ts`: tái sử dụng `solveBeginner3` trong khung quy đổi, trả lại nước cố định đúng với scene. Nhánh giải cơ bản 3×3 (`solveRubik`) và gợi ý luyện tập cũ dùng wrapper này để khớp lộ trình/checkpoint. Giải nhanh và giảm bậc 4×4/5×5 giữ thuật toán hiện có.
- Guide bài 2/3 làm việc trực tiếp với các cạnh/góc U, căn tầng tự do D, mô phỏng lại từng nước (kể cả M/E/S). Guide bài 4 dùng biến thể công thức quy đổi, lấy cạnh từ tầng dưới và bảo vệ tầng trắng phía trên. Bài 5 dùng D và nguyên bản L của chủ dự án.
- Toàn bộ mẫu luyện, hình trước/sau, kiểm tra điều kiện, tiến độ, copy roadmap và bài giảng cập nhật theo hướng mới. Stage IDs vẫn giữ nguyên; `topCross`/`topFace`/`topCorners`/`topEdges` nay có mục tiêu ở D.
- Tiến độ mới lưu ở `rubik.learn.progress.white-top-v2`. Giữ bản ghi cũ `rubik.learn.progress`, không tự chuyển huy hiệu cũ sang mục tiêu mới.

### 17.2 Quét

- `scanGuide.ts`: giữ U (trắng) trên khi quét vòng bên, thứ tự **F → L → B → R → U → D** (xanh lá → cam → xanh dương → đỏ → trắng → vàng theo màu chuẩn).
- Bốn mặt bên hold.top=U; khi chụp U thì L ở phía trên ảnh, khi chụp D thì R ở phía trên ảnh. Chỉ dẫn, số mặt cho khối chẵn, sơ đồ net và phép quy đổi camera dùng cùng các Hold này.
- Dữ liệu đầu ra vẫn chuẩn URFDLB, mô hình màu theo tâm và thuật toán nhận diện được giữ nguyên. Các kích thước 2/3/4/5 dùng chung hướng quét; test render độc lập các pixel theo tọa độ 3D và round-trip đủ 6 mặt cho cả 4 kích thước.

### 17.3 Kiểm tra và bàn giao

- Mô phỏng hàng trăm khối cho từng guide; kiểm tra giữ phần đã lắp, nước nửa vòng, sự nhất quán giữa trạng thái vật lý và event của app, màu/ô phát sáng, precondition và sample.
- Test nối bài 2 → 3 → 4 → 5 trên 30 khối ngẫu nhiên; test solver cơ bản/checkpoint theo thứ tự mới trên 100 khối. Test tiến độ cũ không bị ghi đè.
- Chủ dự án sẽ kiểm tra trực tiếp: tải lại trang, thử ba mức ở bài 2–5, Gợi ý + xoay sai + Hoàn tác, cả hai phương pháp Bài 5, rồi quét đủ 6 mặt của một khối thật. Chưa thử trình duyệt/thiết bị thật trong phiên này.

- Nghiệm thu tự động sau chuyển đổi: `pnpm typecheck`, `pnpm test` (**38 files, 263 passed / 1 skipped**), `pnpm build`, `git diff --check` đều đạt. Build còn cảnh báo OpenCV externalized modules và bundle lớn như trước. Chưa commit/push.

## 18. Chốt Bài 1–5; đổi lộ trình Bài 6–8 theo cách của chủ dự án

- Bài 1–5 đã được chủ dự án chốt. Thứ tự tiếp theo: **Bài 6 đưa 4 cạnh vàng về đúng vị trí → Bài 7 đưa góc vàng về đúng vị trí → Bài 8 lật góc**. Lộ trình học mới dùng `curriculum.ts`, thay thứ tự cũ trên roadmap. Bộ giải tự động giữ thứ tự nội bộ cũ; bài giảng 7–8 chờ công thức của chủ dự án.
- Chủ dự án xác nhận phương pháp lật góc của mình không làm xáo phần đã giải. Không mặc định dùng phương pháp lật góc cũ hoặc đưa cảnh báo xáo tầng vào bài mới. Chờ công thức cụ thể Bài 7–8 để mô phỏng và thiết kế hướng dẫn đúng phương pháp được cung cấp.

### 18.1 Công thức Bài 6 và mẹo chọn mặt (đã kiểm chứng mô phỏng)

- Log `rubik-formula-v2`: `R′ D′ D′ R D R′ D R`, rút gọn **R′ D2 R D R′ D R**. Giữ cạnh DF, chuyển **DR → DL → DB → DR**. Bản đối xứng **L D2 L′ D′ L D′ L′** giữ DF, chuyển **DL → DR → DB → DL**. Cả hai giữ hai tầng trên và dấu cộng vàng khi hoàn thành công thức; các góc tầng cuối chưa phải mục tiêu của bước này.
- Chỉ so màu bên hông cạnh với tâm, không đếm màu vàng hướng xuống (4 cạnh đã vàng từ Bài 5). Thử các hướng D: nếu có 4 cạnh khớp thì xong; nếu có đúng 1 cạnh khớp thì chọn cạnh đó làm mốc F cho công thức.
- Với mốc F đã chọn, nhìn cạnh R: màu bên hông của nó cần về tâm L thì dùng bản bắt đầu R′; cần về tâm B thì dùng bản bắt đầu L. Hai bản là hai chiều của cùng vòng hoán đổi cạnh, không khẳng định là phép nghịch đảo của nhau trên toàn bộ khối.
- Nếu đang có 2 cạnh đúng kề nhau, xoay D để còn đúng 1 cạnh rồi áp dụng mẹo trên. Nếu thử cả 4 hướng D vẫn không có đúng 1 hoặc 4 cạnh khớp (trường hợp hai cạnh đúng đối diện), làm 1 lượt chuẩn bị với một mốc F bất kỳ, rồi căn D tìm 1 cạnh đúng và giải bằng lượt tiếp theo. Không cần xoay công thức dò nhiều lần.
- Tối đa **2 lượt công thức**, ngoài các nước căn D và chọn mặt mốc. Mốc F của công thức có thể khác mặt xanh lá cố định của scene: khi triển khai phải quy đổi nước sang mặt vật lý và hiển thị mốc rõ ràng, giữ trắng U/vàng D.
- `guide/lastEdgesFormula.test.ts`: kiểm tra chiều vòng cạnh, khớp trạng thái cuối log, bảo toàn tầng trên/dấu cộng; duyệt đủ 24 hoán vị cạnh hợp lệ để xác nhận mẹo chọn mốc và giới hạn 2 lượt. UI và guide Bài 6 đã triển khai theo mục 18.2.


### 18.2 Bài 6 — Đã triển khai, chờ chủ dự án kiểm tra trực tiếp

- `guide/lastEdgesGuide.ts`: mỗi gợi ý là một lượt chuẩn bị/giải hoặc chỉ căn D. Tự tìm mặt mốc trong F/R/B/L, chọn chiều công thức bằng mô phỏng; trả về nước xoay theo mặt cố định của scene, không xoay cả khối. Giải đủ 24 hoán vị cạnh trong tối đa hai lượt công thức.
- `copy/lesson6.ts`: 5 phần theo góp ý mới: (1) minh hoạ một lượt đổi cạnh; (2) khái niệm cạnh–tâm trên một mặt Rubik; (3) giữ F, hai chiều đi vòng của R/L/B; (4) hai công thức cùng ví dụ trước/sau cụ thể; (5) các trường hợp, chọn mốc/chiều và thực hành. Chưa giới thiệu công thức ở phần 1–3. Catalog khối hợp lệ được tạo từ công thức và D; ba mức: một cạnh đúng, hai cạnh đúng kề nhau, hai cạnh đúng đối diện. Chọn lại mức luôn đổi sang trạng thái khác.
- `ui/LastEdgesLessonView.tsx`, `LastEdgesDiagram.tsx`, `LastEdgeFace.tsx`, `LastEdgesFormulaExample.tsx`: ảnh mở đầu giữ khối trước, phát sáng ba cạnh R/L/B và lấy ảnh sau từ đúng một lượt công thức (chưa hoàn thành khối). Các sơ đồ dùng mặt Rubik 3×3 với hai hàng trên cùng màu tâm, hai góc dưới xám, cạnh giữa hàng cuối lớn hơn và phát sáng. Phần 3 có mũi tên hai chiều đổi vòng và khung F giữ lại; phần 4 so ba mặt R/L/B trước/sau từng công thức. Thực hành theo khối thật, chỉ rõ F mốc và công thức đã quy đổi, phát sáng cạnh theo dõi và lớp xoay, đếm nước/gợi ý, nhận diện D2 từng nửa và Hoàn tác.
- `curriculum.ts` tách thứ tự bài học khỏi các stage nội bộ của bộ giải tự động. Roadmap hiển thị Bài 6 cạnh → Bài 7 vị trí góc → Bài 8 lật góc; Bài 6 mở bài riêng. Bài 7–8 hiển thị mục tiêu mới và thông báo đang chuẩn bị, không mở lại công thức cũ khác phương pháp đã thống nhất.
- Các điều kiện hoàn thành mới trên roadmap: Bài 6 kiểm cạnh đúng nhưng không yêu cầu góc; Bài 7 thêm vị trí góc, chưa yêu cầu hướng; Bài 8 toàn khối hoàn tất. Mục tiêu và thứ tự solver độc lập vẫn được giữ.
- Kiểm tra tự động: đủ 24 hoán vị cạnh, cả bốn mặt mốc và hai chiều, tái hiện từng nước trên mô hình vật lý, D2 hai nửa, nước sai/Hoàn tác, 300 khối luyện ba mức, chuỗi Bài 2–6 trên 30 khối ngẫu nhiên. Chưa kiểm tra thao tác trực tiếp trên thiết bị thật.

- Nghiệm thu tự động Bài 6: `pnpm typecheck`, `pnpm test` (**40 files, 269 passed / 1 skipped**), `pnpm build`, `git diff --check` đạt. Các huy hiệu hoàn thành tầng cuối của lộ trình cũ không được dùng để đánh dấu nhầm mục tiêu mới trên roadmap; không xoá dữ liệu đã lưu. Chưa commit/push.

- Kiểm tra lần chỉnh minh hoạ/nội dung 5 phần: typecheck, build và 6 test công thức/guide đạt. Test xác nhận ảnh sau xuất phát từ đúng ảnh trước bằng công thức, ba cạnh đổi chỗ và F giữ lại; ảnh mở đầu chưa hoàn thành cạnh, hai ví dụ công thức hoàn thành cạnh nhưng còn góc chưa xong.

- Làm rõ case hai cạnh đúng kề nhau ở phần 5: hình ban đầu → chọn một trong hai cách căn D → hình sau căn D với đúng một cạnh khớp làm F mốc → chọn chiều R′/L. `LastEdgesAdjacentCase.tsx` hiển thị mặt mốc, các mặt phải/trái/sau theo mốc, công thức mẫu và chuỗi quy đổi cố định. Không mặc định F mốc là xanh lá; 1 lượt công thức không tính nước căn D. Các lựa chọn đều lấy từ `lastEdgesCycleOptions`, dùng chung với guide và được mô phỏng tới trạng thái cạnh khớp hoàn toàn. Gợi ý từng nước cũng nói rõ mặt mốc phải được chọn sau bước căn. Kiểm tra lần này: typecheck, build và 12 test (guide/công thức/nối Bài 2–6) đạt; duyệt đủ bốn hoán vị có hai cạnh đúng kề nhau, kiểm cả hai cách căn/mốc/chiều.


### 18.3 Bài 6 — Phương án mới nhất: chỉ xét thứ tự cạnh, bỏ màu tâm

Phần này thay cách nhận diện theo cạnh khớp tâm ở 18.1–18.2. Công thức gốc và chiều hoán đổi không đổi.

- Bài còn **4 phần**: giữ phần mở đầu → nguyên tắc đi vòng → hai công thức → tổ hợp thứ tự và thực hành. Bỏ phần nhận diện cạnh–tâm riêng.
- Trừ ảnh 3D mở đầu đã được duyệt, các hình Rubik đều xám ở tâm và các khối không theo dõi. Phần nguyên tắc/công thức và tổ hợp đều giữ màu cả bốn ô cạnh giữa hàng dưới của bốn mặt F/R/B/L; mọi ô khác xám, không dùng dấu ✓ so với tâm. Ảnh trước/sau công thức luôn hiển thị đủ bốn cạnh có màu.
- Đọc vòng F → R → B → L. Thứ tự chuẩn theo màu chuẩn: xanh lá → đỏ → xanh dương → cam, xoay vòng vẫn tính cùng thứ tự. Gom 24 hoán vị theo phép căn D thành **6 tổ hợp**: 1 đã đúng thứ tự (0 công thức), 4 tổ hợp có 2 lựa chọn cạnh mốc (1 công thức), 1 tổ hợp cần lượt chuẩn bị rồi chọn lại mốc (2 công thức).
- `guide/lastEdgesOrder.ts` mô phỏng trực tiếp theo thứ tự vòng, không yêu cầu căn D để có cạnh khớp tâm trước. Chỉ căn D cuối cùng sau khi thứ tự đã đúng. Các lựa chọn mốc/chiều đều được kiểm chứng bằng mô phỏng; bất kỳ mốc chuẩn bị được hiển thị nào cũng đưa về tổ hợp một lượt.
- `LastEdgesOrderCases.tsx`: liệt kê sáu chuỗi màu; chọn tổ hợp để xem hình. Người học chọn cạnh giữ lại làm F mốc; công thức mẫu, chuỗi theo vị trí cố định và ảnh kết quả đổi theo lựa chọn. Với tổ hợp hai lượt, cho chọn mốc chuẩn bị rồi tiếp tục chọn mốc lượt cuối.
- Thực hành cũng dùng guide theo thứ tự, có nút chọn cạnh mốc trực tiếp trên khối hiện tại, gợi ý đi theo lựa chọn. Ba mức luyện mới: chỉ căn D, một lượt, hai lượt. Cuối cùng vẫn kiểm các cạnh về đúng vị trí thực để sẵn sàng Bài 7.
- Test mới kiểm đủ sáu tổ hợp, mọi lựa chọn cạnh mốc và 24 hoán vị, D2 từng nửa và tái hiện vật lý từng nước; 120 mẫu luyện theo ba mức mới. Test render SVG xác nhận tâm/các khối khác xám, chỉ bốn cạnh được giữ màu; cả ảnh trước và sau mỗi công thức đều có đủ bốn màu cạnh. Test nối Bài 2–6 dùng guide mới, gồm tối đa hai lượt công thức và nước căn D cuối.

- Nghiệm thu phương án theo thứ tự: `pnpm typecheck`, `pnpm build`, `git diff --check` đạt; toàn bộ **42 file, 276 test đạt / 1 bỏ qua**. Test nối Bài 2–6 chạy lại bằng guide mới đạt. Chưa kiểm tra thao tác trực tiếp trên thiết bị thật; chưa commit/push.

- Đính chính hình phần 2 và 3: giữ màu cả bốn cạnh giữa hàng dưới, không dùng chế độ chỉ tô một cạnh. Đã bỏ tuỳ chọn tô một cạnh khỏi sơ đồ; kiểm tra render xác nhận mỗi ảnh có đúng bốn ô màu và các ô khác xám. Typecheck và 2 test hình minh hoạ đạt.

- Cập nhật hình phần 2–4: giữ thêm **tâm D vàng** làm mốc đáy bên cạnh bốn ô cạnh có màu; các ô còn lại xám. Phần tổ hợp/thực hành có mũi tên đổi theo cả mặt mốc F/R/B/L và chiều R′/L đã chọn; chú thích chỉ rõ từng cạnh màu đi từ vị trí nào sang vị trí nào. Khung cạnh giữ lại không tham gia vòng mũi tên. Kiểm tra 6 test đạt, gồm đối chiếu ba mũi tên với phép hoán đổi thực của cả 8 biến thể công thức. Typecheck đạt.

- Bổ sung mũi tên cho tổ hợp 1: vòng đủ bốn cạnh F → R → B → L → F, chú thích đây là thứ tự chuẩn chứ không phải công thức đổi ba cạnh. Test render cả thẻ tổ hợp 1 xác nhận đủ bốn mũi tên.

- Sửa lại tổ hợp 1: bỏ hoàn toàn mũi tên quay cả bốn cạnh. Thứ tự đã đúng được tách thành hình đối chiếu riêng, không đánh số là tổ hợp cần giải; năm tổ hợp cần đổi cạnh được đánh số 1–5. Tổ hợp 1 mặc định mở lựa chọn mốc/chiều và hiển thị đúng ba mũi tên hoán đổi, cạnh mốc đứng yên. Test render thẻ mặc định kiểm trực tiếp ba mũi tên với trạng thái trước/sau công thức.

- Theo yêu cầu hoàn tác: khôi phục **đủ 6 tổ hợp, nguyên thứ tự/nhãn cũ**, bỏ việc tách thứ tự chuẩn thành mẫu đối chiếu riêng. Tổ hợp 1 vẫn giữ nguyên dữ liệu và trạng thái đã đúng thứ tự; bổ sung hình mũi tên minh hoạ đúng vòng **R → L → B → R, giữ F** (không phải vòng bốn cạnh). Giữ thông tin không cần áp dụng công thức nếu đã có thứ tự này. Test UI kiểm đủ sáu mục và ba mũi tên đúng với phép hoán đổi, cạnh F không tham gia.


### 18.4 Chốt cốt lõi Bài 6; bổ sung thực hành theo tổ hợp

- Chủ dự án chốt cốt lõi Bài 6: giữ cấu trúc, đủ sáu tổ hợp và thứ tự/nhãn, công thức và logic minh hoạ; các thay đổi sau chỉ là chi tiết được yêu cầu.
- Thực hành Bài 6 không chọn mức độ nữa. Nút Thực hành tải khối theo đúng tổ hợp hiện đang chọn trong phần 4. `generateLastEdgesCaseScramble` giữ chính xác bốn cạnh ở F/R/B/L giống ảnh đã chọn, chỉ biến đổi các góc bằng chuỗi hợp lệ để tạo khối mới; không xoay D làm lệch hình tổ hợp. Nút Xáo lại tổ hợp này giữ tổ hợp, đổi trạng thái góc; Đổi tổ hợp trở lại phần minh hoạ.
- Lựa chọn tổ hợp và mặt mốc ở từng lượt được giữ ở `LastEdgesLessonView`, truyền cho minh hoạ và bản thực hành. Gợi ý dùng đúng mặt mốc đã chọn (kể cả lượt hai của tổ hợp cần chuẩn bị); người học vẫn có thể chọn mốc hợp lệ khác trên khối đang luyện.
- Tô đậm toàn bộ lời nhắc `LAST_EDGES_FINAL_ALIGNMENT_NOTE`, đổi màu nhấn và thêm nền/viền để nhấn mạnh phải căn D sau khi bốn cạnh đúng thứ tự. Giữ nguyên nội dung câu đã duyệt.
- Kiểm tra bổ sung 180 lần tải/xáo lại trên đủ sáu tổ hợp: màu cạnh đúng cả bốn vị trí trong ảnh, hai tầng trên và dấu cộng được giữ, không lặp lại nguyên trạng thái trước đó, các lựa chọn mốc/lượt hai từ minh hoạ vẫn hợp lệ và guide dùng đúng chuỗi đã chọn. Test render kiểm tổ hợp và mặt mốc được truyền vào đúng, không thay sáu tổ hợp hay các mũi tên đã chốt.

- Nghiệm thu phần thực hành theo tổ hợp: typecheck, build, diff check đạt; toàn bộ **42 file, 280 test đạt / 1 bỏ qua**. Chưa kiểm tra thao tác trực tiếp trên thiết bị thật.
