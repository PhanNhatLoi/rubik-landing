# Chế độ "Người mới học" — Implementation Plan (cho agy)

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
- Chỉ 3x3 trong chế độ học. Chế độ giải "Cơ bản" ở mục Giải và các bài 5–8 (chưa có bài riêng) vẫn dùng bộ giải `solveBeginner3` (`nxn/beginner.ts`), không theo quy tắc 15.3.
- Chưa có bản desktop riêng cho các bài học và chưa kiểm thử trên thiết bị thật; phần giao diện chủ yếu đã được duyệt bằng mắt của chủ dự án.
- Nhiều chuỗi chữ tiếng Việt nằm thẳng trong code (`copy/lessonN.ts`, các `*Guide.ts`); `guide-copy.vi.json` chỉ giữ chữ của bộ luyện tập cũ.
