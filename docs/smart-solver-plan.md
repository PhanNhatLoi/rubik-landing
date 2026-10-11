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

- [x] `camera/CameraController`: `start/stop`, `getUserMedia` (ideal 1280×720, 30fps, `facingMode: environment`), `playsInline muted`, mã lỗi tiếng Việt (HTTPS, từ chối quyền, không có camera, camera bận), `track.onended`; an toàn với StrictMode (generation token).
- [x] `camera/FrameScheduler`: `requestVideoFrameCallback` (fallback `requestAnimationFrame`), cắt khung ngắm (62% cạnh ngắn) → 320×320 qua canvas 2D (`OffscreenCanvas` nếu có) → `getImageData` → transfer buffer sang worker; tối đa 1 frame in-flight; giới hạn 15 lần/giây.
  - Quyết định: dùng `getImageData` trên main thread thay cho `createImageBitmap` + OffscreenCanvas trong worker vì chạy được ở mọi trình duyệt; chi phí đo được ~2–3 ms/frame ở 320×320.
- [x] OpenCV.js: `@techstark/opencv-js@4.12.0-release.1` (docs.opencv.org chặn tải tự động). Nạp trong worker, chunk riêng 10.8 MB (gzip 3.36 MB), chỉ tải khi bật camera. Module là thenable tự resolve chính nó → `initOpenCv` trả `{ cv }`; test nạp qua `require`.
- [x] `vision/vision.worker.ts` + `VisionClient` (protocol có `frameId`, dispose giải phóng Mat rồi terminate).
- [x] `vision/detect.ts`: gray → Laplacian (độ nét) → blur → Canny (ngưỡng theo median) → dilate → contour → lọc blob vuông (solidity, aspect, fill) → `vision/lattice.ts` khớp lưới 3×3 bằng homography (thuần TS, có refine) → 9 ô + màu trung bình.
- [x] `ui/CameraPanel` + `ui/overlay`: video, khung ngắm, lưới phát hiện (ô thấy: viền liền; ô suy ra: viền đứt), số liệu UI fps / Vision fps / Capture / Detect / Blobs / Sharpness / Heap / OpenCV load. Nút Bật/Tắt trong `.controls`.
- [x] Test: 6 test lattice (thuần), 5 test detector chạy OpenCV thật trên ảnh tổng hợp (xoay ±35°, phối cảnh, che 2 ô, nền trống, đổi kích thước frame).
- [x] Smoke test Chrome headless với camera giả (video `.y4m` tổng hợp), cả dev và bản build production.
- [ ] Deploy preview lên Vercel; test trên Safari macOS, iOS Safari, Android Chrome (cần thiết bị thật).

**Kết quả đo (Chrome headless trên Mac, camera giả 640×480 @15fps, chưa phải thiết bị thật)**

| Chỉ số | Kết quả |
|---|---|
| UI fps khi camera + worker chạy | 58–62 |
| Vision fps | 12–16 (giới hạn bởi nguồn 15 fps) |
| Capture (main thread) | 2–3 ms |
| Detect (worker) | ~2.6 ms |
| Heap WASM sau ~1000 frame (80 s) | 128 MB, không tăng |
| Đóng/mở lại panel | Phát hiện lại bình thường |

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

- [x] `vision/color`: sRGB → CIELAB (D65), ΔE2000 (khớp bộ số liệu Sharma 2005), median Lab. Màu ô lấy bằng **trung vị** từng kênh trong vùng lõi ô (chống vệt lóa).
- [x] Không dùng bảng màu cố định: mỗi ô so với **màu 6 ô tâm** đo trên chính khối đó, ΔE2000 với kL = 2 (giảm trọng số độ sáng vì mỗi mặt được chiếu sáng khác nhau).
- [x] `scan/ScanSession` (thuần, không DOM): thứ tự F → R → B → L → U → D; chỉ chụp khi lưới ổn định 6 frame liên tiếp (dịch chuyển < 8% bước lưới), ≥ 7 ô thấy, đủ nét; từ chối mặt đã quét (so màu tâm); chọn lại một mặt để quét lại.
- [x] `scan/reconstruct`: thử 4⁶ = 4096 tổ hợp hướng xoay mặt; với mỗi tổ hợp gán cubie bằng Hungarian (8×8 góc, 12×12 cạnh), sửa twist/flip/parity bằng thay đổi rẻ nhất; trả về ô đã tự sửa (`changed`), ô màu lưng chừng (`lowConfidence`), và lời giải thay thế nếu chênh lệch < ngưỡng (`alternative`) — **không tự chọn khi mơ hồ**.
- [x] `ui/SmartSolverPanel` + `ui/FaceletNet`: hướng dẫn từng mặt, thanh "giữ yên", lưới 2D 54 ô (viền cam = đã tự sửa, viền vàng đứt = nghi ngờ), bấm ô tâm để quét lại mặt, bấm ô khác để đổi màu, "Áp dụng lên khối 3D" → `CubeController.setFacelets`.
- [x] Chống quét trùng bằng **so cả 9 ô** (4 hướng xoay, ΔE2000 trung bình < 6) thay vì chỉ so ô tâm: qua webcam đỏ/cam chỉ cách nhau ΔE ~8–11 nên mặt cam từng bị coi là "mặt đỏ đã quét".
- [x] Hiển thị không dùng chữ: tâm được đặt tên màu chuẩn (Hungarian giữa 6 tâm và 6 màu chuẩn), ô tô bằng màu chuẩn giống khối 3D; cảnh báo khi bố cục màu khác chuẩn.
- [ ] Chạy `reconstruct` trong worker (hiện ~0.2 s trên main thread, chạy một lần khi quét xong).

**Kết quả kiểm tra**

- Unit test: ΔE2000, Hungarian (so với vét cạn), reconstruct (12 scramble ngẫu nhiên + ánh sáng lệch ±17% + nhiễu, mặt bị cầm xoay sai, đỏ đọc thành cam → tự sửa và báo đúng ô, ô màu lưng chừng bị đánh dấu, tâm trùng màu bị từ chối), ScanSession (ổn định, mất dấu, mờ, trùng mặt, quét lại).
- End-to-end trong Chrome headless với camera giả (video tổng hợp 6 mặt của một khối đã xáo trộn, mỗi mặt độ sáng khác nhau): quét đủ 6 mặt trong ~15 s, trạng thái hợp lệ, khối 3D sau khi áp dụng **khớp 100%** với đáp án.
- **Chưa kiểm chứng với khối thật.**

**Nghiệm thu**

- Bộ test tổng hợp (state ngẫu nhiên + nhiễu màu + xoay mặt ngẫu nhiên): tỉ lệ "sai mà không cảnh báo" = 0.
- Thử thực tế ≥ 30 lần quét với khối thật, ≥ 2 điều kiện ánh sáng: ≥ 90% không cần sửa tay; mọi trường hợp sai đều bị cảnh báo.
- State quét xong hiển thị đúng trên UI 3D.

**Điều kiện sang phase sau:** đạt các tiêu chí; bắt đầu ghi bộ video có nhãn để dùng cho phase 4.

---

## Phase 3 — Solver + Hướng dẫn (xác nhận thủ công)

**Mục tiêu:** từ state đã quét, đưa ra lời giải và dẫn người dùng từng bước; xác nhận bước bằng nút bấm, chưa tự động nhận phép xoay.

**Công việc**

- [x] `solver/coords.ts` + `solver/twophase.ts`: two-phase Kociemba tự viết (không symmetry reduction). Phase 1: twist, flip, UD-slice (C(12,4)); phase 2: hoán vị góc, hoán vị 8 cạnh U/D, hoán vị 4 cạnh slice. Bảng move + 4 bảng cắt tỉa (Int8, BFS), dựng lúc chạy trong worker ~0.5 s, không cần cache. Tìm tiếp lời giải ngắn hơn đến hết ngân sách thời gian (mặc định 1 s).
- [x] `solver/solver.worker.ts` + `SolverClient` (chunk 6 KB).
- [x] `guidance/fsm.ts`: reducer thuần `IDLE → SCANNING → SOLVING → GUIDING ⇄ RECOVERING → VERIFYING → COMPLETED` (+ `ERROR`), `epoch` loại kết quả solver cũ. Xoay sai → hiện ngay lời giải dự phòng `[nghịch đảo] + phần còn lại`, đồng thời tính lời giải mới; chỉ thay nếu không dài hơn.
- [x] `CubeController.highlight(move)`: tô sáng (emissive) tầng cần xoay, bám theo tầng sau mỗi lần xoay.
- [x] UI: `ScanView` (tách từ panel quét), `GuideView` (ô màu + ký hiệu, mô tả tiếng Việt, chuỗi bước, "Đã xoay", "Xoay sai" → chọn phép đã xoay, "Không rõ — quét lại"), kéo xoay trên khối 3D cũng được tính là báo bước. Kết thúc: "Quét xác nhận" hoặc "Bỏ qua".
- [x] Panel neo dưới khung controls (không che nút Bật/Tắt), controls xếp ngang trên mobile.

**Kết quả đo (Node, MacBook; chưa đo trên điện thoại)**

| Chỉ số | Kết quả |
|---|---|
| Dựng bảng | ~0.49 s |
| 40 trạng thái ngẫu nhiên, dừng khi ≤ 20 bước | TB 19.9 bước (max 21), trung vị 124 ms, max 634 ms |
| 10 trạng thái ngẫu nhiên, ngân sách 1 s | TB 20.2 bước, max 21 |
| Superflip | 21 bước (tối ưu là 20) |
| Scramble ngắn (3–6 bước) | Lời giải ≤ độ dài scramble |

Lời giải là **gần tối ưu**, không chứng minh tối ưu (tối ưu trung bình ~17–18 bước HTM).

**End-to-end (Chrome headless, camera giả)**: quét 6 mặt → giải 13 bước (đúng nghịch đảo scramble 13 bước) → bấm "Đã xoay" từng bước, cố ý xoay sai một lần (U thay vì D2) → hệ thống chuyển sang `U'` + phần còn lại → khối 3D về trạng thái giải → "Hoàn thành".

### Phase 3B — Đường đi ngắn nhất trên đồ thị trạng thái

**Nguồn:** `docs/root-cube.png` (54 ô dán, mỗi vòng là quỹ đạo của một phép xoay) và `docs/rubik_3x3_node_graph.xlsx` (mô hình cubie Kociemba, 18 bảng phép xoay, đồ thị BFS độ sâu 2 từ trạng thái đã giải). Đã đối chiếu tự động: 18/18 bảng phép xoay, 262/262 node, 342/342 cạnh **khớp hoàn toàn** với `core/`.

**Mô hình:** node = trạng thái khối (cp, co, ep, eo), cạnh = 18 phép xoay HTM (chi phí 1). Đường đi ngắn nhất từ trạng thái hiện tại đến node gốc (đã giải) = lời giải tối ưu. Đồ thị có 4.3×10¹⁹ node nên không thể dựng toàn bộ; duyệt **đồ thị ẩn** (sinh hàng xóm bằng bảng phép xoay khi cần).

**Thuật toán (`solver/optimal.ts`):**

1. **Bảng đích (mở rộng sheet `Nodes_BFS_2`)**: DFS từ trạng thái đã giải đến độ sâu 5, lưu khoảng cách chính xác của 621.649 trạng thái (khớp số trạng thái theo lớp 1/18/243/3240/43239/574908) trong bảng băm mở ~27 MB. Node trong bảng → khoảng cách chính xác; ngoài bảng → khoảng cách ≥ 6.
2. **Đồ thị chiếu theo cụm (pattern database)**: chỉ theo dõi vị trí + hướng của một nhóm 4 mảnh (3 nhóm góc, 5 nhóm cạnh, mỗi nhóm 331.776 trạng thái), BFS toàn bộ đồ thị chiếu. Khoảng cách trong đồ thị chiếu ≤ khoảng cách thật → cận dưới chấp nhận được.
3. **IDA\***: h(s) = max(các bảng chiếu, bảng đích hoặc 6); tăng dần ngưỡng; khi gặp node trong bảng đích thì đi xuống theo khoảng cách giảm dần. Đường đầu tiên tìm được **là ngắn nhất (đã chứng minh)**. Hết giờ → trả `null` kèm cận dưới đã chứng minh.

**Benchmark (Node, MacBook; 5 trạng thái mỗi mức, giới hạn 15 s; dựng bảng 1.1 s):**

| Scramble | Chứng minh được | Trung vị / max |
|---|---|---|
| 8 | 5/5 | 0 / 2 ms |
| 10 | 5/5 | 2 / 345 ms |
| 12 | 4/5 | 10 / 23 ms |
| 13 | 4/5 | 234 ms / 10.1 s |
| 14 | 4/5 | 3.0 / 3.2 s |
| 15 | 2/5 | — |
| 16 | 1/5 | — |

→ Trong trình duyệt chứng minh được đường ngắn nhất khi khoảng cách ≲ 11–12 (đôi khi tới 14). Trạng thái ngẫu nhiên (~18 bước) **không khả thi realtime**; cần bảng lớn hơn nhiều (Korf/Kociemba: hàng trăm MB, phút–giờ) → để dành cho server (Phase 5).

**Hướng dẫn lai (đã tích hợp):**

- Hiện ngay lời giải two-phase; song song chạy IDA\* tối ưu (3 s) từ bước đầu.
- Khi còn ≤ 14 bước và chưa có chứng minh, thử lại ở mỗi bước (khóa `epoch:index`, kết quả cũ bị bỏ).
- Đã chứng minh → nhãn "Đường đi ngắn nhất (đã chứng minh)"; làm đúng từng bước thì giữ nhãn mà không tính lại (đoạn cuối của đường ngắn nhất cũng ngắn nhất). Xoay sai → mất nhãn, hiện lời giải dự phòng, tìm lại.
- E2E (Chrome): scramble 8 bước → lời giải 8 bước có nhãn ngay từ đầu; xoay sai → chứng minh lại 7 bước; scramble 13 bước → chưa chứng minh trong 3 s, giữ two-phase và thử lại ở các bước sau.

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
