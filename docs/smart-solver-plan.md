# Smart Rubik Solver — Implementation Plan

> Tài liệu kế hoạch thực thi cho tính năng quét Rubik 3x3 thật bằng webcam, đồng bộ với UI 3D hiện tại và hướng dẫn giải từng bước.
> Thiết kế kỹ thuật chi tiết (thuật toán, interface) đã được thảo luận trước đó; file này chỉ tập trung vào **thực thi theo phase**.

## 0. Hiện trạng và nguyên tắc

**Hiện trạng repo**

- Vite 5 + React 18 + JSX + three.js. Chưa có TypeScript, chưa có test.
- Toàn bộ logic 3D nằm trong một `useEffect` của `src/App.jsx`; state khối lưu trên `cubie.userData.grid` / `cubie.userData.stickers`.
- Move nội bộ dạng `{ axis, layer, steps }`, hỗ trợ N×N. Chưa có ký hiệu R/U/F, chưa có API đọc/ghi state từ bên ngoài.
- `src/main.jsx` bật `React.StrictMode` → effect chạy 2 lần ở dev; camera/worker lifecycle phải idempotent.
- Package manager: `yarn` (giữ nguyên `yarn.lock`).

**Nguyên tắc**

1. Không xây lại UI 3D; chỉ bọc API quanh code hiện có.
2. Logic thuần (cube core, scan, verify) là TypeScript không phụ thuộc DOM/React → test được độc lập.
3. Xử lý ảnh chạy trong Web Worker; main thread chỉ lấy frame, vẽ overlay, chạy FSM và UI 3D.
4. Một nơi duy nhất (FSM) được quyền thay đổi "trạng thái thật"; mọi message mang `epoch` để loại kết quả cũ.
5. Không chắc thì hỏi người dùng, không tự đoán (scan mơ hồ, move mơ hồ).
6. Mỗi phase có tiêu chí nghiệm thu đo được; chưa đạt thì không sang phase sau.

**Cấu trúc thư mục dự kiến**

```
src/
  App.jsx                         # giữ nguyên UI, chỉ thêm wiring CubeController
  smart-solver/
    core/                         # pure TS: CubieState, moves, facelets, validate
    adapter/                      # CubeController ↔ three.js scene trong App.jsx
    camera/                       # CameraController, FrameScheduler
    vision/                       # vision.worker.ts, detector, color, stability
    scan/                         # ScanSession, reconstruct (facelets → cubie)
    solver/                       # solver.worker.ts, two-phase wrapper
    guidance/                     # FSM, MoveVerifier, recovery
    ui/                           # CameraPanel, Overlay, ScanProgress, StepHint
public/
  opencv/opencv.js                # lazy-load khi mở tính năng camera
```

---

## Phase 0 — Nền tảng (Cube Core + Controller)

**Mục tiêu:** có một lõi trạng thái thuần TS và API điều khiển UI 3D từ bên ngoài, không đổi hành vi hiện tại.

**Công việc**

- [x] Thêm TypeScript với `allowJs` (giữ `App.jsx`, file mới viết `.ts`/`.tsx`), `strict: true`.
- [x] Thêm test runner `vitest` (bản 3.x — vitest 5 yêu cầu vite ≥ 6.4). Scripts: `yarn test`, `yarn typecheck`.
- [x] `core/`: `CubieState` (cp/co/ep/eo), 18 move HTM, `applyMove(s)`, `invertMove(s)`, `toFacelets`/`fromFacelets` (thứ tự URFDLB), `validateState` (đếm màu, tâm, cubie hợp lệ/trùng, twist, flip, parity), `isSolved`.
- [x] Bảng mapping `Move ↔ { axis, layer, steps }`: R = x/2/−1, L = x/0/+1, U = y/2/−1, D = y/0/+1, F = z/2/−1, B = z/0/+1 — **đã xác nhận** bằng test đối chiếu với `rotateStickers`/`rotateGridIndex` của App.
- [x] Tách `rotateGridIndex`, `rotateStickers`, `normalizeSteps` từ `App.jsx` sang `src/rubikLogic.ts` (không đổi logic) để test dùng chung.
- [x] `adapter/CubeController` (interface ở `adapter/types.ts`, cài đặt trong `App.jsx`): `getFacelets()`, `setFacelets(facelets)`, `playMove(move): Promise<void>`, `onUserMove(cb)`. Chỉ có khi size = 3; dev mode expose `window.__cube`.
- [ ] `highlight(move)` — chuyển sang Phase 3 (cần UI gợi ý).

**Nghiệm thu**

- Test pass: `m⁴ = id`, `m · m⁻¹ = id`, `fromFacelets(toFacelets(s)) = s`, `validate` bắt đúng 5 loại lỗi.
- Test mapping: scramble ngẫu nhiên 100 lần qua `core` và qua logic sticker của App cho cùng kết quả.
- Chơi tay, scramble, timer, đổi size hoạt động như cũ.

**Điều kiện sang phase sau:** mapping move được xác nhận; `setState` + `playMove` chạy đúng trên UI.

---

## Phase 1 — Camera + Vision Spike + Deploy thử Vercel

**Mục tiêu:** chứng minh pipeline camera → worker → OpenCV.js chạy mượt cùng UI 3D, trên localhost và trên Vercel, desktop và mobile.

**Công việc**

- [ ] `camera/CameraController`: `start/stop`, `getUserMedia` (ideal 1280×720, 30fps), `playsInline muted`, xử lý từ chối quyền, `track.onended`, `visibilitychange`, `pagehide`; an toàn với StrictMode (mount/unmount 2 lần).
- [ ] `camera/FrameScheduler`: `requestVideoFrameCallback` (fallback `requestAnimationFrame`), `createImageBitmap(video, { resizeWidth: 640 })`, transfer sang worker, **tối đa 1 frame in-flight**, giới hạn tần suất (mặc định 15 lần/giây).
- [ ] `vision/vision.worker.ts`: lazy-load OpenCV.js, nhận `ImageBitmap` → OffscreenCanvas → `cv.Mat`, `bitmap.close()`, preallocate Mat, `try/finally delete()`.
- [ ] Detector bản đầu: tìm lưới 3×3 **trong khung overlay cố định** (Canny → contour → quad → fit lưới), trả về 4 góc lưới + 9 polygon ô.
- [ ] `ui/CameraPanel` + `ui/Overlay`: hiển thị video, khung ngắm, lưới phát hiện được, FPS UI và ms/frame của worker.
- [ ] Theo dõi heap WASM (`cv.HEAPU8.length`) trong chế độ debug.
- [ ] Deploy preview lên Vercel; test trên Chrome desktop, Safari macOS, iOS Safari, Android Chrome.

**Nghiệm thu**

- UI 3D ≥ 50 fps trên laptop khi camera + worker đang chạy.
- Lưới 3×3 được phát hiện ổn định khi đặt một mặt khối vào khung, ánh sáng trong nhà.
- Heap WASM không tăng sau ≥ 1000 frame.
- Bật/tắt camera 20 lần không rò rỉ (đèn camera tắt, worker dispose).
- Bản Vercel chạy được camera trên ít nhất 1 iPhone và 1 Android.

**Điều kiện sang phase sau:** đạt hiệu năng trên; xác định được fallback cho trình duyệt thiếu OffscreenCanvas/rVFC.

---

## Phase 2 — Quét 6 mặt (Scanning MVP)

**Mục tiêu:** quét khối thật thành state hợp lệ và đồng bộ lên UI 3D, không bao giờ âm thầm chấp nhận state sai.

**Công việc**

- [ ] `vision/color`: lấy mẫu vùng lõi ô (bỏ viền), loại pixel lóa, median, chuyển sang CIELAB, ΔE2000; cân bằng trắng theo tâm trắng.
- [ ] Tham chiếu màu = 6 ô tâm; xác suất màu mỗi ô (softmax), confidence, margin; xử lý riêng đỏ/cam theo hue.
- [ ] `vision/stability`: mặt chỉ được nhận khi lưới ổn định ≥ k frame và đủ nét; gộp log-likelihood qua N frame.
- [ ] `scan/ScanSession`: quét có hướng dẫn (F → R → B → L → U → D), nhận diện mặt theo màu tâm, mini-map mặt đã/chưa quét, cho quét lại một mặt.
- [ ] `scan/reconstruct`: thử 4⁵ hướng xoay mặt, gán cubie có chi phí (Hungarian 8×8 góc, 12×12 cạnh), kiểm tra twist/flip/parity, phát hiện mơ hồ (state tốt nhất vs state khác tốt nhì).
- [ ] `ui`: lưới 2D 54 ô để xem và sửa tay các ô nghi ngờ; nút xác nhận → `CubeController.setState`.

**Nghiệm thu**

- Bộ test tổng hợp (state ngẫu nhiên + nhiễu màu + xoay mặt ngẫu nhiên): tỉ lệ "sai mà không cảnh báo" = 0.
- Thử thực tế ≥ 30 lần quét với khối thật, ≥ 2 điều kiện ánh sáng: ≥ 90% không cần sửa tay; mọi trường hợp sai đều bị cảnh báo.
- State quét xong hiển thị đúng trên UI 3D.

**Điều kiện sang phase sau:** đạt các tiêu chí; bắt đầu ghi bộ video có nhãn để dùng cho phase 4.

---

## Phase 3 — Solver + Hướng dẫn (xác nhận thủ công)

**Mục tiêu:** từ state đã quét, đưa ra lời giải và dẫn người dùng từng bước; xác nhận bước bằng nút bấm, chưa tự động nhận phép xoay.

**Công việc**

- [ ] `solver/solver.worker.ts`: two-phase solver tự viết bằng TS (Kociemba: phase 1 → nhóm G1, phase 2 → solved; move table + pruning table sinh trong worker, cache IndexedDB), sau `SolverProvider` interface, trả về `moves`, thời gian, nhãn `near-optimal`.
- [ ] `guidance/fsm`: `IDLE → SCANNING → VALIDATING → SOLVING → GUIDING → VERIFYING → RECOVERING → COMPLETED`, có `epoch`, mọi chuyển trạng thái đi qua một reducer.
- [ ] `ui/StepHint`: hiển thị bước hiện tại/tổng số bước, ký hiệu move, `highlight` tầng trên UI 3D, animation `playMove` khi xác nhận.
- [ ] Nút "Đã xoay" / "Xoay sai" / "Quét lại"; khi xoay sai → nhập lại hoặc quét lại → tính lại lời giải.
- [ ] Kiểm tra hoàn thành: yêu cầu quét lại 6 mặt để xác nhận đã giải.

**Nghiệm thu**

- 100 state ngẫu nhiên: solver trả lời giải hợp lệ (áp vào `core` ra trạng thái đã giải), độ dài ≤ 22, đo và ghi lại thời gian trên laptop và mobile.
- Luồng end-to-end với khối thật: quét → giải → làm theo → hoàn thành.
- FSM có unit test cho toàn bộ bảng chuyển trạng thái.

**Điều kiện sang phase sau:** luồng thủ công ổn định; đã có ≥ 20 video có nhãn chuỗi move để đánh giá phase 4.

---

## Phase 4 — Tự động nhận diện phép xoay + Recovery

**Mục tiêu:** camera tự xác nhận người dùng xoay đúng/sai, tự chuyển bước, tự phục hồi khi sai.

**Công việc**

- [ ] Hướng dẫn góc cầm nghiêng thấy 3 mặt (F, U, R); detector hỗ trợ tối đa 3 mặt cùng lúc.
- [ ] Temporal gating: `STABLE → IN_MOTION → STABLE`, chỉ đánh giá ở trạng thái ổn định; tay che → bỏ qua frame.
- [ ] Suy hướng cầm (24 hướng) từ ≥ 2 ô tâm thấy được → `CubeController.setOrientation` (đồng bộ hướng khối 3D theo tay).
- [ ] `guidance/MoveVerifier`: ứng viên = identity + 18 move + cặp move (độ sâu 2); chấm điểm log-likelihood trên ô nhìn thấy, gom lớp quan sát giống nhau, margin + hysteresis; verdict `accept | none | wrong | ambiguous | needView | lost`.
- [ ] Recovery: sai một bước → hiển thị ngay `[m⁻¹] + phần còn lại`, đồng thời tìm lời giải mới; không khớp ứng viên nào → tìm độ sâu 3 → nếu vẫn không được thì quét lại một phần/toàn bộ.
- [ ] Harness offline: chạy lại video có nhãn qua cùng pipeline, xuất precision/recall theo move.
- [ ] Giữ nút xác nhận thủ công làm phương án dự phòng.

**Nghiệm thu (mục tiêu, cần đo trên bộ video)**

- Precision nhận diện move ≥ 99%, recall ≥ 95%.
- Không có cập nhật state khi camera mất dấu.
- Mọi lần xoay sai trong bộ test đều được phát hiện và lời giải được tính lại.

**Điều kiện sang phase sau:** đạt mục tiêu trên ≥ 2 loại khối và ≥ 3 điều kiện ánh sáng.

---

## Phase 5 — Production (tùy chọn theo nhu cầu)

**Mục tiêu:** mở rộng độ bền và trải nghiệm; mỗi hạng mục độc lập, làm khi có dữ liệu chứng minh cần.

- [ ] Phát hiện tự do không cần khung ngắm; hỗ trợ khối không viền (thêm phân vùng màu; chỉ thêm model AI nếu bộ đánh giá cho thấy phương pháp truyền thống không đủ).
- [ ] Tối ưu mobile: giảm độ phân giải động, `MediaStreamTrackProcessor` khi có, fallback main thread cho trình duyệt cũ.
- [ ] Solver tối ưu tuyệt đối (HTM): **server riêng ngoài Vercel** (VPS/Fly.io/Railway), gọi bất đồng bộ, có timeout; UI gắn nhãn `optimal` / `near-optimal`.
- [ ] Bám tư thế liên tục 6DoF (`solvePnP`) có làm mượt — chỉ là hiệu ứng phụ.
- [ ] Cache OpenCV.js bằng service worker; build OpenCV.js tối giản.
- [ ] Telemetry lỗi ẩn danh (không gửi ảnh).

---

## 7. Deploy (Vercel)

- Frontend Vite build tĩnh → Vercel; HTTPS có sẵn (bắt buộc cho camera).
- `opencv.js` đặt ở `public/opencv/`, chỉ tải khi mở tính năng camera.
- Chỉ cần header COOP/COEP (`vercel.json`) nếu sau này dùng WASM đa luồng / `SharedArrayBuffer`.
- Dev trên điện thoại qua LAN cần HTTPS (Vite HTTPS hoặc tunnel); `localhost` thì không cần.
- Solver tối ưu tuyệt đối không đặt trên Vercel Functions (bảng tra và RAM vượt giới hạn function).

## 8. Quyết định

| # | Quyết định | Trạng thái |
|---|---|---|
| 1 | Thêm TypeScript (`typescript`, types), `allowJs` để không phải convert `App.jsx` | **Đã chốt** |
| 2 | Test runner `vitest` | **Đã chốt** |
| 3 | Package manager | **Đã chốt: giữ `yarn`** (`yarn add -D ...`), không chuyển pnpm |
| 4 | Nguồn OpenCV.js: file build chính thức, tự host trong `public/` | Đề xuất |
| 5 | Two-phase solver | **Đã chốt: tự viết bằng TS** trên nền `core/` (xem dưới) |
| 6 | Giữ Vite, engine viết độc lập framework | Đề xuất |
| 7 | Solver tối ưu phía server | Hoãn đến Phase 5 |

**Lý do tự viết two-phase solver (quyết định #5)**

- Move table và tọa độ (co, eo, cp, UD-slice...) dùng chung với `core/` → không phải duy trì hai mô hình cube và hai bộ ký hiệu.
- Phase 5 (IDA* tối ưu) tái sử dụng cùng move table và pruning table; dùng thư viện ngoài thì phải viết lại từ đầu.
- Kiểm soát kích thước bundle và chạy hoàn toàn trong worker; không phụ thuộc license của bên thứ ba.
- Thuật toán được mô tả công khai và đầy đủ (kociemba.org), khối lượng ước tính vài trăm dòng TS.

**Cách giảm rủi ro**

- Pruning table sinh trong worker ở lần chạy đầu, cache vào IndexedDB; đo thời gian sinh bảng trên laptop và mobile trong Phase 3.
- Test: 1000 state ngẫu nhiên, mọi lời giải áp vào `core` phải ra trạng thái đã giải; đo phân bố độ dài và thời gian.
- Phương án dự phòng: nếu sau Phase 3 hiệu năng không đạt (đặc biệt trên mobile), đánh giá thư viện có sẵn (license + kích thước) để thay thế phía sau cùng interface `SolverProvider`.

## 9. Rủi ro chính theo phase

| Phase | Rủi ro | Giảm thiểu |
|---|---|---|
| 0 | Mapping move sai chiều | Test đối chiếu với `rotateStickers` |
| 1 | Safari/iOS thiếu API, mobile chậm | Feature-detect + fallback; đo trên thiết bị thật sớm |
| 2 | Nhầm đỏ/cam, trắng/vàng | Tham chiếu theo tâm + ràng buộc cubie + sửa tay |
| 3 | Solver nặng trên mobile | Chạy trong worker, đo thời gian, giới hạn bảng tra |
| 4 | False positive nhận diện move | Chỉ đánh giá khi ổn định, margin + hysteresis, nút thủ công dự phòng |
| 5 | Kỳ vọng "tối ưu tuyệt đối trong vài giây" | Gắn nhãn rõ ràng, chạy server bất đồng bộ |
