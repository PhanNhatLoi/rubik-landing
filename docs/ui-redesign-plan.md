# UI Redesign — Implementation Plan (cho agy)

> Chỉ đổi **giao diện và bố cục**. Không đổi logic 3D, FSM, solver, vision, scan.
> Design nguồn: `https://claude.ai/artifact/92DEazGKYtr9cYB8nqWQA3` (đọc bằng tool Artifact: `project/*.dc.html`, `project/tokens.css`).
> Design system: [design-system.md](./design-system.md) + [`src/styles/tokens.css`](../src/styles/tokens.css) (đã có sẵn, đã import trong `main.jsx`).

## 0. Nguyên tắc

1. **Không refactor logic.** `App.jsx` (effect Three.js), `smart-solver/{core,vision,scan,solver,guidance,nxn,camera,adapter}` giữ nguyên. Chỉ sửa JSX/className/CSS và thêm component bố cục.
2. **Giữ nguyên props và hành vi** của `SmartSolverPanel`, `ScanView`, `NxnScanView`, `GuideView`, `NxnGuideView`, `CameraPanel`, `SchemePicker`, `ScanNet`. Test hiện có (`pnpm test`) phải xanh sau mỗi phase.
3. **Dùng token, không hex.** Component mới chỉ dùng `var(--rb-*)` và class `.rb-*`. Thiếu gì thì thêm vào cuối `tokens.css` mục "Additions" (xem design-system.md §4).
4. **Một breakpoint 960px.** Không giữ `max-width: 720px` cũ. Dùng CSS cho khác biệt bố cục; chỉ dùng JS (`useMediaQuery('(min-width: 960px)')`) khi mobile và desktop render **cây DOM khác nhau** (size picker, điều hướng).
5. **Mỗi phase là một PR/commit độc lập**, app chạy được ở cuối mỗi phase. Xoá CSS cũ chỉ ở Phase 6, khi không còn chỗ dùng.
6. **Không thêm thư viện** (router, UI kit, CSS-in-JS). Không dùng `any`. Package manager: `pnpm`; không tự chạy `pnpm install` hay sửa lockfile.
7. Tên nhánh: tiếp tục trên `enhance/mobile-UI`. Commit conventional (`feat:`, `refactor:`), chỉ commit khi được yêu cầu.

## 1. Hiện trạng vs thiết kế

| | Hiện tại | Thiết kế |
|---|---|---|
| Khung | canvas `position:absolute; inset:0` full màn hình; `.intro` và `.controls` nổi đè lên | Mobile: cột dọc (header · stage · hint · action bar · tab bar). Desktop: 3 cột `rb-shell` (panel trái 320 · stage · panel phải 360/440) |
| Điều hướng mobile | không có; nút "Quét: Bật/Tắt" | Tab bar dưới: **Chơi / Giải khối** |
| Chọn size | modal giữa màn hình | Mobile: bottom sheet 4 thẻ. Desktop: `.rb-seg` 4 nút trong panel trái |
| Smart Solver | panel nổi, mở rộng tại chỗ | Mobile: toàn màn hình, 3 bước nối tiếp (Quét → Kiểm tra màu → Hướng dẫn). Desktop: panel phải 440px, khối 3D vẫn thấy |
| Thống kê | 2 ô "Time"/"Moves" | Đồng hồ 46px + chip "N nước đi" + chip trạng thái |
| Zoom | 2 nút 36px "+ / −" | Mobile: cặp nút dọc mép phải stage. Desktop: cặp nút ngang cuối panel trái (44px) |

`mountRef` đo kích thước bằng `getBoundingClientRect` trong `resize()` (`App.jsx:543`), nên canvas **có thể đặt trong ô grid/flex** — không cần sửa code Three.js, chỉ cần `.canvas-wrap` là phần tử có kích thước thật và `ResizeObserver`/`resize` bắt kịp (xem Phase 1).

Ánh xạ pha FSM → màn hình (mobile):

| `guide.phase` (và `nxn.guide.phase`) | Màn hình thiết kế |
|---|---|
| `SCANNING` | 3 · Quét (`ScanCamera`) |
| `REVIEWING` | 4 · Kiểm tra màu (`ScanReview`) |
| `SOLVING` | giữ màn Review/Quét + trạng thái "Đang tính lời giải…" (không có artboard) |
| `GUIDING`, `RECOVERING` | 5 · Hướng dẫn giải (`Guide`) |
| `VERIFYING`, `COMPLETED`, `ERROR` | **không có artboard** — xem §7 câu hỏi mở |

## 2. Phase 0 — Nền tảng bố cục

**Mục tiêu:** có khung responsive mới, chưa đổi nội dung bên trong.

- Thêm `src/ui/useMediaQuery.ts` (hook nhỏ, `matchMedia`, an toàn SSR/StrictMode) và hằng `DESKTOP_QUERY = '(min-width: 960px)'`.
- Bổ sung vào cuối `tokens.css` mục `/* ---------- Additions ---------- */`: hover/disabled, `.rb-screen`, `.rb-header`, `.rb-progress`, `.rb-camera` (theo design-system.md §4). Cập nhật bảng đó trong doc.
- `style.css`: bỏ `overflow:hidden` cứng trên `body` chỉ khi cần cho sheet cuộn; giữ `#root{height:100dvh}`. Thay `@import` font nếu trùng với design (hiện đã cùng Space Grotesk, thêm weight 500 nếu thiếu).
- Thêm `viewport-fit=cover` vào `index.html` (cần cho `env(safe-area-inset-bottom)` của tab bar).

**Nghiệm thu:** `pnpm build` + `pnpm typecheck` + `pnpm test` xanh; giao diện cũ không đổi.

## 3. Phase 1 — Màn "Chơi" (mobile + desktop)

Artboard: `Main` (mobile), `DesktopPlay` (desktop), `Cube` (component).

**Việc cần làm**

1. Tách khung trong `App.jsx` return thành component trình bày (props thuần, không chứa logic mới), ví dụ `src/ui/PlayShell.jsx`, `src/ui/StatsBlock.jsx`, `src/ui/ZoomControl.jsx`. Chỉ truyền xuống `timeMs`, `moves`, `statusText`, `size`, callback `scramble/reset/zoomIn/zoomOut/openSize`.
2. **Mobile (< 960px)** — `rb-screen`:
   - Header: "Rubik 3D" / "Playground" + nút "Hướng dẫn thao tác" (`rb-icon-btn`, hiển thị nội dung hint hiện có trong một popover/sheet đơn giản; nếu chưa có nội dung thì để nút ẩn và ghi vào PR).
   - Khối thời gian: `rb-overline` "Thời gian" + `rb-num` 46px; hàng chip: `N nước đi`, chip trạng thái (`rb-chip--run` khi đang giải).
   - Stage: `.canvas-wrap` chiếm phần còn lại (`flex:1; min-height:0`), zoom dọc mép phải (`position:absolute; right:16px`).
   - Hint một dòng: "Kéo nền để xoay góc nhìn · Kéo mặt khối để quay tầng".
   - Action bar: `[3x3 ▾]` (mở size sheet) · `[Reset]` (`rb-icon-btn--square`) · `[Xáo trộn]` (`rb-btn--primary`, flex-grow).
   - Tab bar: `Chơi` / `Giải khối` (`rb-tabbar`, `aria-current="page"`).
3. **Desktop (≥ 960px)** — `rb-shell`:
   - Trái (`rb-panel`, 320px): tên + hint, đồng hồ + chip, hai nút `Xáo trộn` (primary) / `Reset` (secondary), `rb-seg` Kích thước 2x2–5x5, zoom ngang.
   - Giữa: `.canvas-wrap` trong `rb-shell__stage`, tối đa ~560px.
   - Phải: thẻ Smart Solver đang tắt (icon, "Đang tắt", mô tả, `Bật Smart Solver` primary, `Giải khối 3D đang hiển thị` ghost) — thay cho nút "Quét: Bật/Tắt".
4. **Canvas:** `.canvas-wrap` đổi từ `inset:0` sang phần tử flow có kích thước. Thêm `ResizeObserver` trên `mount` gọi `resize()` (đây là thay đổi nhỏ duy nhất trong effect Three.js; không đổi gì khác). Kiểm tra StrictMode không rò observer (`disconnect` trong cleanup).
5. Giữ nguyên `scrambleRef/zoomInRef/zoomOutRef/setResetKey/setSize` — chỉ đổi nơi gọi.

**Không làm ở phase này:** Smart Solver bên trong (Phase 3–5). Nút "Bật Smart Solver"/tab "Giải khối" tạm gọi `setShowCamera(true)` và hiển thị panel cũ.

**Nghiệm thu**
- Mobile 390×844 và desktop 1440×900 khớp artboard `Main`/`DesktopPlay` (so bằng mắt: khoảng cách, cỡ chữ, radius).
- Xoay nền, kéo tầng, xáo trộn, reset, zoom, đổi size vẫn hoạt động; đồng hồ không nhảy khi số đổi.
- Không còn scroll dọc trên mobile; tab bar cách đáy đúng safe area.

## 4. Phase 2 — Chọn kích thước

Artboard: `SizeSheet`; desktop dùng `rb-seg` ở Phase 1.

- Mobile: thay `.modal` bằng `.rb-scrim` + `.rb-sheet` (`role="dialog"`, `aria-label="Chọn kích thước khối"`, nút đóng `rb-icon-btn`, 4 `.rb-size-card[aria-pressed]` lưới 2×2, nút "Chọn N×N" primary). Thẻ có lưới minh hoạ N×N (ô 14/10/7.5/6px theo size) và caption: 2x2 "Mini · làm quen", 3x3 "Tiêu chuẩn", 4x4 "Nâng cao", 5x5 "Chuyên gia".
- Chọn trong sheet chỉ **nháp** (`pickedSize`); chỉ gọi `setSize` khi bấm "Chọn N×N" (khớp thiết kế: "Đổi kích thước sẽ reset khối và đồng hồ").
- Đóng bằng: nút ×, bấm scrim, phím `Esc`. Focus vào sheet khi mở, trả focus về nút `3x3 ▾` khi đóng. Animation `--rb-t-sheet`, tắt khi `prefers-reduced-motion`.
- Desktop: bỏ modal; `rb-seg` gọi `setSize` ngay.

**Nghiệm thu:** đổi size ở cả hai chế độ reset khối + đồng hồ; `onRequestSize` của Smart Solver vẫn đổi được size; Esc/scrim/× đều đóng.

## 5. Phase 3 — Smart Solver: khung + Quét

Artboard: `ScanCamera` (mobile), `DesktopSolver` (desktop).

**Khung (`SmartSolverPanel.tsx`, `App.jsx`)**
- Mobile: khi tab "Giải khối" đang chọn, `SmartSolverPanel` render **toàn màn hình** (`rb-screen`) thay cho màn Chơi; vẫn dùng chung một instance `SmartSolverPanel` (đang `cameraMounted` + `open`), không unmount khi đổi tab để không mất phiên quét. Tab bar luôn hiện.
- Desktop: `rb-shell__right` (360px đóng / `--open` 440px khi đang quét/giải), khối 3D ở giữa vẫn hiển thị. Nút × trong header panel thay cho "Tắt".
- Thay cơ chế `headerSlot` (portal vào `.solver-head`) bằng header bố cục mới nếu đơn giản hơn; nếu khó, giữ portal nhưng đặt slot vào header mới. **Không đổi chữ ký props công khai** nếu có thể.

**Quét (`CameraPanel.tsx`, `ScanView.tsx`, `NxnScanView.tsx`, `SchemePicker.tsx`)**
- Header: nút quay lại (mobile) · "Smart Solver" + "Đang quét các mặt · 3x3" · nút bộ màu ("Quốc tế" + 4 ô mini) mở `SchemePicker`.
- `rb-seg` nguồn quét: Webcam / Chụp ảnh (thay `.scan-mode`).
- Khung camera `.rb-camera` (cao 332px mobile): badge "Mặt cam" (góc trái), vòng đếm ngược (góc phải, thay `.camera-countdown`), lưới 3×3 overlay, chip phản hồi đáy ("Đã thấy lưới 3×3 (9/9 ô)"). Overlay hiện đang vẽ bằng canvas (`overlay.ts`) — **giữ nguyên cơ chế vẽ**, chỉ chỉnh style khung/badge bằng CSS.
- Dòng hướng dẫn 16px + phụ đề 13px; hàng 6 `.rb-face` (`--done` có dấu ✓, `--current` viền cyan, còn lại nét đứt). Bấm mặt đã quét = quét lại mặt đó (đúng hành vi hiện tại của `onFaceClick`).
- Hàng nút: `Quét lại` (ghost) + `Chụp ngay` (primary, có icon máy ảnh). Link "Bỏ qua quét — giải khối đang hiển thị" (`rb-btn--link`).
- Lỗi/cảnh báo scan: `.scan-error` → `.rb-alert`.
- Với N×N (`NxnScanView`) dùng cùng khung; số ô overlay theo `n`.

**Nghiệm thu:** quét đủ 6 mặt bằng webcam và ảnh vẫn chạy; countdown/autoCapture không đổi; chuyển tab Chơi ↔ Giải khối không làm mất mặt đã quét; desktop vẫn thấy khối 3D khi quét.

## 6. Phase 4 — Kiểm tra màu & Phase 5 — Hướng dẫn giải

### Phase 4 — Kiểm tra màu (artboard `ScanReview`)
- Header "Kiểm tra màu" / "Đã quét 6/6 mặt · chạm ô để sửa".
- Sơ đồ 6 mặt dạng cross (đã có `ScanNet`; chỉ đổi style sang token, mặt đang chọn viền cyan 2px).
- Mặt đang chọn hiển thị lưới 3×3 ô `.rb-sticker--sm` 64px (`aria-pressed` = ô chọn, `--low` = `lowConfidence`), bên dưới 6 nút chọn màu 48px ("Đổi ô đang chọn thành"). Hàng `rb-seg` Giải nhanh / Người mới học (nguồn: `solveMode`, đã lưu `localStorage`). Nút: `Quét lại` (ghost) + `Đúng rồi — Giải` (primary).
- Alert `.rb-alert` khi có ô độ tin cậy thấp: "N ô có độ tin cậy thấp ở mặt X — kiểm tra ô viền cam".
- **Lưu ý:** hiện review diễn ra trên **khối 3D** ("Kiểm tra trên khối 3D") và `ScanNet` cho sửa ô. Design có UI sửa ô riêng (lưới 64px + palette). Agy phải kiểm tra `onCellClick`/`ScanView` đã đủ thao tác sửa màu chưa; nếu thiếu, **dừng và hỏi** trước khi thêm logic (xem §7).

### Phase 5 — Hướng dẫn giải (artboard `Guide`)
- Header: nút × thoát · "Giai đoạn i/n" + "Góc tầng 1 · Người mới học" · `bước/tổng`; thanh tiến độ `.rb-progress` gradient.
- Giữa: nhãn hướng nhìn ("Mặt xanh lá hướng về bạn · mặt vàng ở trên") + khối 3D (có mũi tên gợi ý — dùng `highlight(move)` của `CubeController`, đã có).
- Sheet dưới (`rb-sheet`-like, không scrim): `rb-move-hero` (ký hiệu 46px) + "Bước i/n" + mô tả; dòng "Công thức: …"; chuỗi `rb-move` (done gạch ngang / current cyan / sắp tới); nút `←` (icon vuông 56px, hoàn tác) + `Đã xoay` (primary 56px); ghi chú "Có thể kéo xoay trực tiếp… Xoay nhầm sẽ tự chèn bước hoàn tác."
- Desktop: cùng nội dung đặt trong panel phải 440px (không có artboard — xem §7).
- Áp dụng cho `GuideView` và `NxnGuideView`.

**Nghiệm thu:** FSM chạy đủ `SCANNING → REVIEWING → SOLVING → GUIDING → (VERIFYING) → COMPLETED`; "Đã xoay", hoàn tác, tự chèn bước khi xoay nhầm, optimal search vẫn hoạt động; không đổi gì trong `guidance/`.

## 7. Câu hỏi mở (agy phải hỏi/ghi vào PR, không tự đoán)

1. **Màn không có artboard:** `VERIFYING`, `COMPLETED` ("Hoàn thành!"), `ERROR`, `SOLVING` ("Đang tính lời giải…"), khối không hợp lệ. Đề xuất mặc định: dùng `rb-sheet` + `rb-alert` + `rb-btn` theo cùng ngôn ngữ; cần chủ dự án xác nhận hoặc bổ sung design.
2. **Desktop cho Review và Guide:** design chỉ có `DesktopPlay` và `DesktopSolver` (Quét). Đề xuất mặc định: tái dùng nội dung mobile trong panel phải 440px.
3. **Review dùng UI sửa ô riêng của design vs "kiểm tra trên khối 3D" hiện tại** (xem Phase 4).
4. **Nút "Hướng dẫn thao tác" (?)** ở header mobile: chưa có nội dung ngoài câu hint.
5. **Left panel của `DesktopSolver`** không có Zoom và bỏ dòng "Đang giải" — xác nhận có chủ ý hay lược giản artboard.
6. Cảnh báo `docs/smart-solver-plan.md` còn ghi `yarn` nhưng repo dùng `pnpm`; không sửa trong task này.

## 8. Phase 6 — Dọn dẹp & QA

- Xoá selector CSS không còn dùng trong `style.css` (`.intro`, `.controls`, `.modal*`, `.zoom-*`, `.stat*`, `.scramble`, `.reset`, `.size-btn`, `.scan-mode`, `.scan-faces`, `.guide-*`, `.facelet`… — xác minh bằng grep `className` trước khi xoá). Phần `.scheme-*` chuyển sang token nếu còn dùng.
- Không còn hex trong CSS component (ngoại trừ nội bộ `tokens.css` và màu sticker vẽ bằng canvas/Three).
- A11y: mọi nút icon có `aria-label`; trạng thái chọn bằng ARIA; thứ tự Tab hợp lý; focus ring thấy rõ; sheet bẫy focus; `role="status"` cho alert/feedback quét.
- Reduced motion: tắt animation sheet, scan-net-enter, transition nút.
- Kiểm tra tay (chỉ chạy nhẹ, tắt dev server/Chrome headless sau khi dùng): mobile 390×844, 360×640 (nhỏ), 768 (tablet = mobile layout), 959 / 960 (mốc), 1440×900. Safari iOS: `100dvh`, safe-area, `getUserMedia`.
- `pnpm typecheck && pnpm test && pnpm build` xanh.

## 9. Bản đồ file

| File | Việc |
|---|---|
| `src/styles/tokens.css` | đã có; chỉ thêm mục Additions |
| `src/main.jsx` | đã import tokens trước `style.css` |
| `src/App.jsx` | chỉ phần `return (...)` và `ResizeObserver` cho canvas; tách component trình bày |
| `src/ui/*` (mới) | `useMediaQuery`, `PlayShell`, `StatsBlock`, `ZoomControl`, `SizeSheet`, `TabBar` |
| `src/smart-solver/ui/SmartSolverPanel.tsx` | khung + header + điều hướng 3 bước |
| `src/smart-solver/ui/{CameraPanel,ScanView,NxnScanView,SchemePicker}.tsx` | className + cấu trúc theo Phase 3 |
| `src/smart-solver/ui/ScanNet.tsx` | style theo token (Phase 4) |
| `src/smart-solver/ui/{GuideView,NxnGuideView}.tsx` | Phase 5 |
| `src/style.css` | dọn ở Phase 6 |
| `index.html` | `viewport-fit=cover` |
