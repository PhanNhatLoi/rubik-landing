# UI Fix Plan — sửa các lỗi sau review (cho agy)

> Bối cảnh: [ui-redesign-plan.md](./ui-redesign-plan.md) đã triển khai xong Phase 0–5, review phát hiện các lỗi dưới đây.
> Quy tắc giữ nguyên: chỉ đổi giao diện/bố cục; không đổi logic `core/`, `vision/`, `scan/`, `solver/`, `guidance/`, `nxn/`; không thêm thư viện; dùng token `--rb-*`; không `any`; không tự chạy `pnpm install`/sửa lockfile.
> Mỗi mục F là một commit độc lập, app chạy được sau mỗi mục. Sau mỗi mục chạy `tsc --noEmit` và `vitest run`.

## Tóm tắt

| # | Lỗi | Mức | Mục |
|---|---|---|---|
| 1 | Mobile: sang tab "Giải khối" rồi quay lại → khối 3D trống | Nghiêm trọng | F0 |
| 2 | **Co/giãn cửa sổ desktop ↔ mobile (qua mốc 960px, hoặc xoay điện thoại) → mất khối Rubik** | Nghiêm trọng | F0 (cùng nguyên nhân với #1) |
| 3 | Mobile ở tab Giải khối không thấy khối 3D (Review/Guide cần) | Nghiêm trọng | F0 |
| 4 | Panel Smart Solver bị unmount → mất các mặt đã quét | Trung bình | F0 |
| 5 | Review 3x3 + webcam: không còn nút xác nhận | Nghiêm trọng | F1 |
| 6 | Overlay camera lệch/méo do khung cao cố định 332px | Nghiêm trọng | F2 |
| 7 | Review mất thông tin, ô `changed` không đánh dấu, legend sai, face chip lệch design | Trung bình | F3 |
| 8 | Desktop: khối nhỏ hơn dự kiến do ngưỡng `rect.width < 960` | Trung bình | F4 |
| 9 | A11y, token thiếu, inline style, CSS mồ côi, lockfile | Nhỏ | F5 |

---

## F0 — Giữ canvas và Smart Solver sống qua mọi thay đổi layout (lỗi #1–#4)

### Nguyên nhân gốc
- `PlayShell.jsx` trả về **cây DOM khác nhau** theo `isDesktop` (dòng 32) và theo `activeTab` (dòng 224). Div `canvas-wrap` có `ref={mountRef}` bị unmount/remount; renderer Three.js đã `appendChild(renderer.domElement)` vào div cũ ở lần chạy effect đầu ([App.jsx:777](../src/App.jsx), deps `[size, resetKey]`) nên div mới luôn rỗng.
- Tương tự `solverElement` chỉ được render trong một số nhánh → `SmartSolverPanel` unmount, mất state quét.

### Giải pháp: "persistent host" + re-parent
Tạo **một** phần tử DOM bền vững cho canvas và **một** cho Smart Solver; mỗi layout chỉ đặt một `slot` (div trống) và hook gắn host vào slot hiện tại. Không unmount, không đổi logic Three.js.

1. Thêm `src/ui/usePersistentHost.ts`:
   ```ts
   // Trả về host sống suốt vòng đời component và callback ref cho slot hiện tại.
   export function usePersistentHost(className?: string): {
     host: HTMLDivElement
     slotRef: (slot: HTMLElement | null) => void
   }
   ```
   - `host` tạo một lần (`useState(() => document.createElement('div'))`), class `className`, `width/height: 100%`.
   - `slotRef(node)`: lưu node vào state/ref; một `useLayoutEffect` phụ thuộc node đó gọi `node.appendChild(host)` (và không làm gì khi `node === null`; host cứ ở yên trong DOM trôi nổi cho tới slot kế tiếp — canvas vẫn sống).
   - Không dùng `key` đổi theo layout lên slot.
2. `App.jsx`:
   - `const stage = usePersistentHost('canvas-wrap')`; `mountRef` trỏ thẳng `stage.host` (gán `mountRef.current = stage.host` trước effect Three.js, hoặc đổi effect dùng `stage.host`). `ResizeObserver` đã có sẽ tự bắt kích thước mới khi host đổi slot — **giữ nguyên**; đảm bảo `resize()` đã guard `width/height === 0`.
   - `const solver = usePersistentHost('solver-host')`; render `createPortal(<SmartSolverPanel …/>, solver.host)` **một lần**, luôn mounted khi `cameraMounted` (giữ prop `open={showCamera}` như code gốc để panel tự tắt camera). Bỏ wrapper `solverElement`.
   - Truyền `stageSlotRef={stage.slotRef}` và `solverSlotRef={solver.slotRef}` xuống `PlayShell`.
3. `PlayShell.jsx`: thay mọi `<div className="canvas-wrap" ref={mountRef} />` bằng `<div className="rb-stage-slot" ref={stageSlotRef} />`; thay `{solverElement}` bằng `<div className="rb-solver-slot" ref={solverSlotRef} />`.
   - Desktop: slot stage ở cột giữa; slot solver ở panel phải khi `showSolver`.
   - Mobile tab Chơi: slot stage chiếm phần giữa như hiện tại.
   - **Mobile tab Giải khối:** layout dọc `[header solver] [slot stage nhỏ] [slot solver]`. Slot stage luôn có mặt ở đây (cao ~ 35–45% màn hình; ẩn bằng `display:none` ở bước Quét camera nếu cần chỗ, **không** unmount). Khối 3D phải thấy được ở Review và Guide (theo artboard `Guide`: khối ở giữa, sheet nằm dưới).
   - Khi `showSolver` false: panel phải/tab Giải khối vẫn render slot solver nhưng bọc `hidden`; host ở lại trong slot đó (không detach) để `SmartSolverPanel` không mất state.
4. CSS (trong `style.css`, dùng token): `.rb-stage-slot, .rb-solver-slot { width:100%; height:100%; min-height:0; position:relative }`, `.solver-host { width:100%; min-height:0 }`.
5. StrictMode: `usePersistentHost` phải idempotent (effect chạy 2 lần không gắn host trùng/không leak listener).

### Nghiệm thu F0 (thủ công, ghi kết quả vào PR)
- [ ] Mobile 390×844: Chơi → Giải khối → Chơi ×5 lần: khối vẫn hiện, đúng góc xoay/trạng thái đã xáo.
- [ ] Kéo cửa sổ từ 1440 → 800 → 1440 (qua mốc 959/960) khi đang xáo trộn và đang đếm giờ: khối **không mất**, không reset, đồng hồ không dừng, kích thước canvas cập nhật đúng.
- [ ] DevTools xoay màn hình (390×844 ↔ 844×390): khối còn.
- [ ] Quét 2 mặt → đổi tab Chơi → quay lại Giải khối: 2 mặt vẫn còn; kéo qua 960px khi đang quét: không mất phiên quét và camera không bị bật/tắt lại.
- [ ] Review/Guide mobile: nhìn thấy khối 3D, kéo xoay tầng vẫn hoạt động.
- [ ] Không có cảnh báo React trong console; `window.__cube` vẫn dùng được ở dev.

---

## F1 — Khôi phục nút xác nhận khi review webcam ([ScanView.tsx:556](../src/smart-solver/ui/ScanView.tsx))

- Nút primary ở hàng hành động phải phụ thuộc **pha**, không phụ thuộc `mode`:
  - `scanning && mode === 'webcam'` → "Chụp ngay" (`shoot`). Nếu `shoot` chỉ hợp lệ khi `canShutter`/có frame, giữ đúng điều kiện cũ của hàm đó.
  - `scanning && mode === 'photo'` → không cần nút primary riêng (đã có nút "Chụp mặt X" / "Chụp / chọn ảnh" ở phần trên); chỉ hiện "Quét lại".
  - `!scanning` (đã quét đủ 6 mặt, mọi mode) → `confirm` với `confirmLabel`, `disabled={!validation?.ok}`.
- Kiểm tra `NxnScanView` cho cùng lỗi (hiện nút "Áp lên khối 3D" vẫn đúng; chỉ xác nhận không bị ảnh hưởng).
- Thêm test nhẹ nếu dễ (render hàm chọn nút thuần), nếu không thì ghi vào checklist.

**Nghiệm thu:** Webcam: quét đủ 6 mặt → thấy nút xác nhận → bấm → sang pha `REVIEWING`. Photo: tương tự. Mặt chưa đủ → nút xác nhận không hiện.

---

## F2 — Overlay camera khớp video ([CameraPanel.tsx:240](../src/smart-solver/ui/CameraPanel.tsx), tokens `.rb-camera`)

Hiện: `.rb-camera` cao cố định 332px, video `height:auto` căn giữa; canvas overlay vẽ theo `video.clientWidth/Height` nhưng phủ `inset:0` lên cả khung → giãn dọc, lệch lưới.

Chọn **một** hướng (ưu tiên A):
- **A. Video lấp đầy khung (đúng design):** `.rb-camera .camera-video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover }`. Overlay cũng `inset:0`. Trong `draw()` ([CameraPanel.tsx:~118](../src/smart-solver/ui/CameraPanel.tsx)) overlay có canvas theo `video.clientWidth/Height`, nhưng `scale = w / video.videoWidth` giả định video không bị crop. Với `object-fit: cover` phải tính `scale = max(w/videoWidth, h/videoHeight)` và offset `((w - videoWidth*scale)/2, (h - videoHeight*scale)/2)` rồi truyền offset vào `drawOverlay` (thêm tham số `offset` tùy chọn, mặc định 0 để không đổi test/hành vi cũ). Chỉ sửa `overlay.ts` + `CameraPanel.tsx`, không đụng vision.
- **B. Khung theo tỉ lệ video:** bỏ `height:332px`, dùng `aspect-ratio` từ `videoWidth/videoHeight` (đặt khi `loadedmetadata`), overlay bám sát video. Đơn giản hơn nhưng khung camera không cố định 332px như design.

Cũng ở mục này:
- `role="status"` của `.rb-camera__feedback`: chỉ cập nhật khi **trạng thái** đổi (có lưới / không có lưới), không nhúng `stats.inliers` đổi mỗi 500ms. Dùng `aria-live="polite"` trên text ổn định, số ô hiển thị riêng với `aria-hidden`.
- Với ảnh tĩnh (`photo`) và desktop panel 440px kiểm tra lại tỉ lệ.

**Nghiệm thu:** Lưới nhận diện trùng khớp các ô thật của khối trên mobile (390 wide) và desktop (panel 440), cả webcam 16:9 lẫn 4:3; không méo khi đổi kích thước; countdown/badge đúng vị trí.

---

## F3 — Màn Kiểm tra màu: trả lại thông tin, khớp design ([ScanView.tsx](../src/smart-solver/ui/ScanView.tsx))

1. **Trả lại thông điệp trạng thái** (đã bị xoá) dưới tiêu đề review, dùng `.rb-alert`:
   - `result.alternative` → "Có hai cách đọc gần giống nhau — kiểm tra các ô viền vàng và bấm để sửa nếu sai."
   - `result.changed.length` → "Đã tự sửa N ô theo luật của khối. Kiểm tra lại trước khi tiếp tục."
   - Hợp lệ không có gì bất thường → dòng "Trạng thái hợp lệ." dạng text phụ (không phải alert).
2. **Đánh dấu ô trong lưới 64px:** `mark === 'uncertain'` → `.rb-sticker--low` (viền cam, khớp `lowConfidence` trong design); `mark === 'changed'` → thêm modifier mới `.rb-sticker--changed` (viền vàng, `--rb-cube-yellow`) vào mục Additions của `tokens.css` và design-system.md §4. Sửa alert: "N ô có độ tin cậy thấp — kiểm tra ô viền **cam**" và dòng riêng cho ô viền vàng nếu có.
3. **Legend** dòng "Bấm ô tâm để chọn lại mặt…" → viết lại đúng hành vi mới: "Chọn mặt ở sơ đồ, chạm ô rồi chọn màu bên dưới." Cập nhật `title` các nút nếu cần.
4. **Ô tâm:** không cho đổi màu ô tâm (index `k === 4`) — nút vẫn chọn được để xem nhưng bảng màu `disabled` với chú thích "Ô tâm quyết định màu mặt". (Đổi tâm làm hỏng `identify`; hành vi cũ chỉ dùng tâm để chọn mặt.) Nếu muốn giữ cho phép, **hỏi lại chủ dự án**.
5. **Face chip** theo design: ô đã quét = nền `--rb-surface-1`, swatch đổ màu có dấu ✓ **bên trong** swatch, **vẫn hiển thị tên mặt**; chưa quét = viền nét đứt, swatch chỉ có viền màu; đang chọn = viền cyan 2px. Dùng đúng `.rb-face__swatch` + biến thể, không thay tên mặt bằng "✓".
6. **ScanNet:** trong lúc **quét** (mobile) ẩn `ScanNet` (design Quét chỉ có 6 chip); chỉ hiện ở review như artboard. Desktop panel 440px: giữ chip, ẩn net khi quét, hiện khi review.
7. `Quét lại` vs `Quét lại từ đầu`: giữ "Quét lại" nhưng thêm `aria-label="Quét lại từ đầu"`.
8. `<label>` chọn ảnh bị disabled: thêm `.rb-btn[aria-disabled="true"], .rb-btn.is-disabled { opacity:.5; pointer-events:none }` vào Additions và dùng cho label thay cho class `disabled` cũ.

**Nghiệm thu:** Review khớp artboard `ScanReview` (390×844) và `DesktopSolver`; mọi thông điệp cũ vẫn xuất hiện đúng tình huống; sửa 1 ô → `validation` cập nhật → nút xác nhận bật/tắt đúng.

---

## F4 — Cỡ khối mặc định đúng theo viewport ([App.jsx:557, 562](../src/App.jsx))

- `getDefaultScale/Zoom` đang dùng `rect.width < 960`, nhưng `rect` giờ là ô canvas (≤ 560px trên desktop) → desktop luôn dùng cỡ mobile.
- Đổi sang so sánh **viewport**: `window.matchMedia(DESKTOP_QUERY).matches` (hoặc `window.innerWidth < 960`) — không dùng `rect.width`. Giữ nguyên hai giá trị (0.78/11.2 cho mobile, 0.9/9.6 cho desktop); nếu mắt thấy khối quá to/nhỏ trong ô 560px thì chỉnh ở đây và ghi lại.
- `resize()` chỉ áp default khi người dùng chưa zoom (`hasUserZoomed` đã có) — kiểm tra khối đổi cỡ đúng khi qua mốc 960 mà chưa zoom.

**Nghiệm thu:** Desktop 1440×900: khối chiếm hợp lý ô giữa (so artboard `DesktopPlay`); mobile 390×844 khớp artboard `Main`; qua mốc 960 chưa zoom thì cỡ khối đổi theo, đã zoom thì giữ.

---

## F5 — A11y, token, dọn dẹp

1. **Vùng chạm ≥ 44px:** nút × trong `SizeSheet.jsx:116`, panel desktop `PlayShell.jsx:108`, popover `PlayShell.jsx:208`, nút "Đã xoay" thu gọn ở `SmartSolverPanel.tsx` (height 32px) → dùng `.rb-icon-btn` (44px) / `.rb-btn` mặc định. Thay ký tự `×` bằng SVG đóng (`aria-hidden`) như artboard.
2. **SizeSheet:** truyền `triggerRef` từ App tới nút `3x3 ▾` (`PlayShell` giữ `ref`); tách `onClose` ổn định (`useCallback`) hoặc để ref cho effect để không chạy lại mỗi lần render (đang kéo focus về sheet khi đồng hồ chạy); bẫy focus cơ bản (Tab xoay vòng trong sheet).
3. **Token/CSS:**
   - `style.css:63` dùng `--rb-r-full` không tồn tại → `--rb-r-pill`; xoá hẳn `.panel-toggle`, `.panel-summary*`, `.panel-header`, `.camera-countdown`, `.scan-photo-button` nếu grep xác nhận không còn dùng.
   - Thay inline style lặp lại bằng class trong `style.css`/`tokens.css` (mục Additions): `.rb-stats-block`, `.rb-card` (hero move card), `.rb-section-title`, `.rb-screen__stage`, `.rb-solver-slot`, v.v. Màu `rgba(...)` cứng trong `SizeSheet.MiniCubeGrid` → class dùng `--rb-border-selected`/`--rb-accent-tint`.
   - `.rb-move { flex: none }` để dãy nước đi không co trong container cuộn ngang.
   - `TabBar` phải tràn hết chiều ngang: đặt ngoài vùng `padding` của `.rb-screen` (hoặc `margin: 0 calc(-1 * var(--rb-gutter))`).
4. **GuideView:** xoá biến `face` không dùng; nút "Xoay sai" thêm nhãn chữ ngắn (ví dụ "Xoay sai" dưới icon hoặc `title`), không chỉ icon; xoá dòng trống thừa cuối `App()`, `GuideView`, `ScanView`.
5. **Lockfile/phụ:** `yarn.lock` bị sửa 2 dòng `@types/react*` (từ `package.json` đã có sẵn) — xác nhận có chủ ý hay `git checkout yarn.lock`. Xoá `pnpm-lock.yaml` và `pnpm-workspace.yaml` thừa ở thư mục gốc (không thuộc dự án).

**Nghiệm thu:** Không còn `var(--rb-*)` chưa định nghĩa (grep), không còn class CSS mồ côi, mọi nút tương tác ≥ 44px, thứ tự Tab hợp lý và focus ring thấy rõ.

---

## F6 — Kiểm thử cuối (checklist chung)

Chỉ chạy nhẹ; **tắt dev server / Chrome headless sau khi dùng**.

- `tsc --noEmit` sạch; `vitest run` xanh (hiện 179 pass); `vite build` thành công (xuất ra thư mục tạm).
- Ma trận viewport: 360×640, 390×844, 768×1024 (vẫn layout mobile), 959, 960, 1440×900. Mỗi viewport: Chơi (xáo, reset, zoom, đổi size), Giải khối (quét → review → guide).
- Chuyển layout khi đang: (a) đếm giờ, (b) đang quét, (c) đang Guide — khối và phiên giải không mất.
- Safari iOS: `100dvh`, safe-area của tab bar, `getUserMedia`.
- Ghi vào PR: ảnh chụp trước/sau từng màn so với artboard, và danh sách điểm còn lệch design.

## Thứ tự và phụ thuộc

`F0` → `F1` → `F2` → `F3` → `F4` → `F5` → `F6`. F1, F2, F4 độc lập với nhau nên có thể làm song song; F3 nên sau F2 (cùng khung camera/overlay); F5 làm cuối để dọn sau khi bố cục đã ổn định.

## Câu hỏi cần chủ dự án quyết

1. Ô tâm có cho sửa màu ở review không (F3.4)? Đề xuất mặc định: **không**.
2. Khung camera (F2): hướng A (khung cố định, video `cover`) hay B (khung theo tỉ lệ video)? Đề xuất: **A**, đúng design.
3. Tab Giải khối trên mobile ở bước Quét: ẩn khối 3D để dành chỗ cho camera, hay thu nhỏ? Đề xuất: **ẩn bằng CSS** ở bước Quét, hiện ở Review và Guide.
