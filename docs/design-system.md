# Rubik 3D Playground — Design System

Nguồn thiết kế: artifact Claude Design `https://claude.ai/artifact/92DEazGKYtr9cYB8nqWQA3`
(artboard `DesignSystem`, `tokens.css`, 7 màn hình mobile/desktop).
Bản chạy trong repo: [`src/styles/tokens.css`](../src/styles/tokens.css) — **copy nguyên từ design, không sửa tay giá trị**. Cần đổi giá trị thì đổi trên design rồi copy lại.

## 1. Quy ước

| | |
|---|---|
| Prefix | CSS variable `--rb-*`, class `.rb-*` (BEM: `.rb-block__elem`, `.rb-block--mod`) |
| Font | Space Grotesk 400/500/600/700 (đã `@import` ở `style.css`) |
| Lưới | 4px (`--rb-s-*`) |
| Breakpoint | **một** mốc: `min-width: 960px` (desktop). Dưới 960px là mobile |
| Vùng chạm | ≥ 44px, khoảng cách giữa các nút ≥ 8px |
| Số | luôn `tabular-nums` (`.rb-num`) để đồng hồ không nhảy |
| Icon | stroke 1.8px, 18–22px, `currentColor`, `aria-hidden` (nút icon bắt buộc có `aria-label`) |
| Trạng thái | dùng thuộc tính ARIA làm selector (`aria-pressed`, `aria-selected`, `aria-current`), không dùng class `.active` |
| Focus | `--rb-ring-focus` (viền cyan 3px), không bỏ outline mà không thay thế |
| Màu cứng | không viết hex trong component mới; luôn `var(--rb-*)` |

## 2. Token

### Màu
- **Nền / bề mặt:** `--rb-bg-0` (trang) · `--rb-bg-1` (sheet, panel dock) · `--rb-surface-1` (chip, track segmented, input) · `--rb-surface-2` (thẻ chưa chọn, move token) · `--rb-surface-3` (segment đang chọn) · `--rb-glass` (panel nổi, kèm `backdrop-filter: var(--rb-blur)`) · `--rb-scrim`
- **Viền:** `--rb-border` (mặc định) · `--rb-border-strong` (nút, thẻ, sheet) · `--rb-border-selected`
- **Chữ:** `--rb-text` · `--rb-text-soft` · `--rb-text-muted` · `--rb-text-subtle` (overline, chú thích; đạt 4.5:1) · `--rb-text-on-accent`
- **Accent:** `--rb-accent-1` → `--rb-accent-2` (`--rb-accent-gradient`); `--rb-accent-link`; `--rb-accent-tint(-border)`
- **Trạng thái:** `--rb-warn*` (ô độ tin cậy thấp, alert), `--rb-idle-dot`
- **Sticker:** `--rb-cube-{white,yellow,green,blue,red,orange}` — **chỉ dùng cho hình khối Rubik / swatch màu mặt**, không dùng làm màu giao diện
- **Nền trang:** `--rb-bg-page`

### Typography
| Token | Cỡ / đậm | Dùng cho |
|---|---|---|
| `--rb-fs-display` | 46 / 600 | đồng hồ |
| `--rb-fs-move` | 46 / 700 | ký hiệu nước đi (`R'`, `D2`) |
| `--rb-fs-title-lg` | 20 / 600 | tiêu đề sheet, panel |
| `--rb-fs-title` | 17 / 600 | tiêu đề header |
| `--rb-fs-body` | 14 / 400 | thân |
| `--rb-fs-caption` | 13 | phụ, trạng thái |
| `--rb-fs-micro` | 12 | nhãn tab, face chip |
| `--rb-fs-overline` | 11, hoa, `0.12em` | `.rb-overline` |

### Khoảng cách, bo góc, kích thước
- Spacing `--rb-s-1…8` = 4/8/12/16/20/24/32; gutter `--rb-gutter` 16px (mobile), `--rb-gutter-desktop` 24px.
- Radius: `xs 6` (sticker chip) · `sm 10` (segment, move) · `md 12` · `lg 14` (nút) · `xl 16` (thẻ) · `2xl 20` (panel) · `sheet 24` · `pill`.
- Control: `--rb-h-control` 52 (mobile) / `--rb-h-control-desktop` 48 · `--rb-h-icon` 44 · `--rb-h-segment` 40 · `--rb-h-chip` 28.
- Layout: `--rb-panel-left` 320 · `--rb-panel-right` 360 / `--rb-panel-right-open` 440 · `--rb-tabbar-h` 80.
- Motion: `--rb-ease`, `--rb-t-fast/base/sheet` (120/220/320ms). Tôn trọng `prefers-reduced-motion`.

## 3. Component

| Class | Dùng cho | Ghi chú |
|---|---|---|
| `.rb-btn` `--primary` `--secondary` `--ghost` `--link` `--block` | mọi nút chữ | **Một** primary mỗi màn hình |
| `.rb-icon-btn` `--square` | đóng, zoom, quay lại, thu/mở panel | 44px, luôn `aria-label` |
| `.rb-seg` + `.rb-seg__item` | Size (desktop), Webcam/Chụp ảnh, Giải nhanh/Người mới học | `role="tablist"` + `aria-selected`, hoặc `aria-pressed` cho nhóm nút |
| `.rb-chip` (`--run`) + `.rb-chip__dot` | số nước đi, trạng thái | |
| `.rb-overline` + `.rb-num` | nhãn "Thời gian" + giá trị đồng hồ | |
| `.rb-size-card` | chọn size trong bottom sheet (mobile) | `aria-pressed` |
| `.rb-face` `--done` `--current` + `.rb-face__swatch` | tiến độ quét 6 mặt | |
| `.rb-sticker` `--sm` `--low` | ô màu ở màn kiểm tra | `aria-pressed` = đang chọn; `--low` khi `lowConfidence` |
| `.rb-move` `--done` `--current`, `.rb-move-hero` | chuỗi lời giải + ký hiệu nước đi hiện tại | |
| `.rb-alert` | cảnh báo quét, khối không hợp lệ | |
| `.rb-panel` | panel nổi desktop | glass + blur |
| `.rb-sheet` + `.rb-sheet__grab` + `.rb-scrim` | bottom sheet mobile | |
| `.rb-tabbar` + `.rb-tabbar__item` | điều hướng mobile Chơi / Giải khối | tự ẩn ≥ 960px |
| `.rb-shell` `__left` `__stage` `__right` `--open` | khung 3 cột desktop | chỉ có style từ 960px |

## 4. Khoảng trống của tokens.css (agy cần bổ sung khi triển khai, theo cùng quy ước)

Đã bổ sung vào cuối `tokens.css` dưới mục "Additions":

1. Trạng thái `:hover` cho `.rb-btn`, `.rb-icon-btn`, `.rb-seg__item`, `.rb-size-card` (chỉ trong `@media (hover: hover)`); `:disabled` cho `.rb-btn`, `.rb-icon-btn` (opacity 0.5, `cursor: not-allowed`).
2. Layout mobile: `.rb-screen` (cột flex 100dvh, padding 0 `var(--rb-gutter)`, overflow hidden).
3. Header màn hình: `.rb-header`, `.rb-header__title`, `.rb-header__subtitle` (lặp lại ở Scan/Review/Guide).
4. Thanh tiến độ giải: `.rb-progress`, `.rb-progress__bar` (`4px`, gradient) ở Guide.
5. Khung camera: `.rb-camera` (bo 24px, viền `--rb-border`), `.rb-camera__badge` nổi (`rgba(5,8,14,.78)`), `.rb-camera__countdown` (vòng đếm ngược), `.rb-camera__feedback` (chip phản hồi đáy).
6. Đánh dấu ô đã sửa theo luật: `.rb-sticker--changed` (viền vàng `--rb-cube-yellow`).
7. Utility & helper: `.rb-card` (hero move card), `.rb-stats-block`, `.rb-section-title`, `.rb-screen__stage`, `.rb-mini-cube-cell`.

## 5. Ánh xạ class hiện tại → mới

| Hiện tại | Mới | Ghi chú |
|---|---|---|
| `.intro`, `.controls` | `.rb-panel` / `.rb-sheet` | panel nổi desktop; bottom sheet mobile |
| `.scramble` | `.rb-btn .rb-btn--primary` | Xáo trộn / Đúng rồi — Giải / Đã xoay |
| `.reset` | `.rb-btn .rb-btn--ghost` | Reset, Quét lại, Quay lại |
| `.size-btn`, `.modal-option` | `.rb-seg__item` · `.rb-size-card` | segmented desktop, thẻ trong sheet mobile |
| `.zoom-btn` | `.rb-icon-btn .rb-icon-btn--square` | 36 → 44px |
| `.panel-toggle`, `.close` | `.rb-icon-btn` | có `aria-label` |
| `.stat`, `.stats` | `.rb-overline` + `.rb-num` + `.rb-chip` | đồng hồ 46px, số nước đi thành chip |
| `.facelet` | `.rb-sticker` | `--low` khi `lowConfidence`, `--changed` khi tự sửa |
| `.guide-token` | `.rb-move` `--done`/`--current` | trạng thái theo chỉ số bước |
| `.guide-notation` | `.rb-move-hero` | |
| `.scan-error` | `.rb-alert` | |
| `.scan-mode button`, `.scan-faces button` | `.rb-seg__item`, `.rb-face` | |
