# Sutta Annotator

Ứng dụng web tĩnh (SPA) hỗ trợ đọc, tra cứu, chú thích và nghe bài giảng/podcast kinh điển Phật giáo Pali - Việt.

---

## 0. Setup

### Yêu cầu
- Node.js >= 18.x
- npm hoặc pnpm / yarn

### Cài đặt và chạy
```bash
# Cài đặt dependencies
npm install

# Khởi chạy môi trường phát triển (HMR)
npm run dev

# Kiểm tra lint
npm run lint

# Build cho môi trường production
npm run build

# Xem trước bản build
npm run preview
```

---

## 1. Tổng quan tính năng

- **Đọc kinh điển chuyên sâu (Reader):**
  - Hỗ trợ chế độ cuộn liên tục (Scroll Mode) và chế độ lật trang dạng sách (Paged Mode) với thanh điều hướng trang, phím tắt (Mũi tên, PageUp/PageDown, Home/End) và cử chỉ vuốt chạm (Touch swipe).
  - Chế độ đọc tập trung (Deep/Zen Mode - phím F11 / ESC).
  - Tùy chỉnh phong phú: Đổi font (Lora, Times New Roman, Google Sans), cỡ chữ (12px - 28px), màu chú thích, khoảng cách dòng (line height), khoảng cách chữ (letter spacing), độ rộng lề hai bên (whitespace padding), chủ đề màu (Sáng, Tối, Sepia).
  - Tự động lưu vị trí đọc (auto-bookmarking) và thanh tiến trình đọc trực quan.
  - Tự động cuộn trang với tùy chỉnh tốc độ.
  - Tìm kiếm & Thay thế (Find & Replace) hỗ trợ CSS Custom Highlight API và phím tắt `Ctrl+H`, `Ctrl+D`.
- **Hệ thống Chú giải & Chú thích (Annotations):**
  - **Chú thích từ/đoạn văn bản (Anchored Annotations):** Bôi đen chữ trên văn bản để tạo chú thích ngay tại chỗ với popup nhập nhanh (`Ctrl+Enter` để lưu). Hover hoặc click để xem tooltip/sửa/xóa hoặc kéo thả thay đổi vùng chọn chú thích.
  - **Chú giải tự do (Standalone / Unanchored Annotations):** Thêm chú giải trực tiếp ngay trong panel chú giải (Right Sidebar) với nút `+ Thêm chú giải` mà không bắt buộc phải bôi đen văn bản trong khung kinh điển. Hỗ trợ tiêu đề/từ khóa tùy chọn và nội dung chi tiết.
  - **Chống xóa nhầm chú giải:** Cơ chế orphan check thông minh tự động bảo vệ các chú giải tự do khi chỉnh sửa nội dung văn bản kinh điển.
- **Bản giải thích & Tóm tắt (Summary / Commentary tab):**
  - Chuyển đổi nhanh giữa bản kinh gốc và bản giải thích/tóm tắt Markdown với hỗ trợ công thức toán học KaTeX.
- **Nghe Audio / Podcast:**
  - Phát âm thanh bài giảng/podcast lưu trực tiếp trong IndexedDB của trình duyệt (`idb-keyval`), hỗ trợ tải file audio máy tính lên, điều chỉnh tốc độ đọc (0.8x - 2.0x), tua nhanh/chậm 10 giây và âm lượng.
- **Dữ liệu & Đồng bộ:**
  - Lưu trữ offline an toàn bằng IndexedDB.
  - Sao lưu & Khôi phục file JSON cục bộ.
  - Đồng bộ đám mây hai chiều qua GitHub Gist cá nhân (Personal Access Token).
  - Sao chép URL chia sẻ trực tiếp mang theo bài kinh và toàn bộ cấu hình hiển thị.
- **Xuất bản:**
  - Xuất bài kinh ra định dạng HTML và Markdown đính kèm đầy đủ chú giải nội dòng và mục "📌 Chú giải chung" ở cuối tài liệu.

---

## 2. Kiến trúc hệ thống

```
src/
├── assets/             # Assets, SVG icons
├── components/
│   ├── PodcastPlayer.jsx   # Widget nghe audio podcast với timeline & speed controls
│   ├── Settings.jsx        # Màn hình cấu hình kiểu chữ, giao diện, backup & đồng bộ Gist
│   ├── Sidebar.jsx         # Menu danh sách bài kinh, tìm kiếm kinh, thêm kinh & settings
│   ├── SuttaReader.jsx     # Trình đọc kinh chính (Scroll / Paged, Tooltip, FullEditor, FindReplace)
│   └── UploadModal.jsx     # Modal tải lên bài kinh mới từ file txt/md hoặc nhập trực tiếp
├── context/
│   └── AppContext.jsx      # Global React Context quản lý dữ liệu kinh, chú thích, settings & URL hash state
├── data/
│   └── initialData.js      # Dữ liệu kinh mẫu ban đầu
├── App.jsx                 # AppShell, Topbar, Toolbar, Right Sidebar chú giải & Export logic
├── index.css               # Toàn bộ CSS theme, layout, paged mode, animations & responsive styling
└── main.jsx                # Entry point React 19
```

- **Stack kỹ thuật:** React 19, Vite 8, IndexedDB (`idb-keyval`), React-Markdown, Remark-Math, Rehype-KaTeX.
- **State Management & Persistence:** `AppContext` kết hợp lưu trữ không đồng bộ qua `idb-keyval` (IndexedDB) và đồng bộ trạng thái hai chiều qua URL Hash Parameter.

---

## 3. Các component

- `AppShell` (`src/App.jsx`): Điều phối layout tổng thể, topbar, thanh công cụ đọc (toolbar), phím tắt F11, xuất file HTML/Markdown và Right Sidebar quản lý chú giải.
- `SuttaReader` (`src/components/SuttaReader.jsx`): Trình đọc kinh điển hỗ trợ 2 chế độ (Paged Mode / Scroll Mode), `FullEditor` contentEditable kèm cơ chế bắt vùng chọn mark, `AnnotationPopup`, `AnnotationTooltip`, `FindReplaceBar` và thanh tiến trình đọc.
- `Sidebar` (`src/components/Sidebar.jsx`): Sidebar bên trái hiển thị danh sách bài kinh, tìm kiếm thời gian thực, thêm bài kinh và chuyển tới màn hình Cài đặt.
- `Settings` (`src/components/Settings.jsx`): Quản lý font, kích thước chữ, khoảng cách dòng/chữ, lề trang, màu sắc chú thích, kiểu hiển thị, backup/restore JSON và đồng bộ GitHub Gist.
- `UploadModal` (`src/components/UploadModal.jsx`): Modal nhập bài kinh mới bằng cách kéo thả file hoặc nhập trực tiếp theo cú pháp Section/Paragraph.
- `PodcastPlayer` (`src/components/PodcastPlayer.jsx`): Trình phát audio nổi tích hợp lưu trữ offline qua IndexedDB.

---

## 4. Các task đã làm

### [2026-08-29] Bổ sung tính năng điền nội dung vào khung chú giải không cần chọn nội dung ở khung kinh điển `(FAST)`
- **Mode / Type / Action / Lane:** FEATURE / FEATURE / EXECUTE / FAST
- **Tóm tắt:** Cho phép người dùng trực tiếp thêm chú giải tự do (standalone / unanchored commentary) ngay tại khung chú giải (Right Sidebar) mà không bắt buộc phải bôi đen văn bản trong khung kinh điển.
- **Thay đổi chính:**
  - Mở rộng `AppContext.jsx` hỗ trợ `addAnnotation` với tham số cờ `standalone: true`.
  - Nâng cấp `AnnotationPopup` trong `SuttaReader.jsx` hỗ trợ chế độ chú giải tự do với trường nhập tiêu đề/từ khóa (tùy chọn) và nội dung chú giải chi tiết.
  - Cập nhật cơ chế phát hiện orphan marks trong `SuttaReader.jsx` để bảo vệ các chú giải tự do, không bị cảnh báo xóa nhầm khi chỉnh sửa văn bản kinh điển.
  - Thêm nút `+ Thêm chú giải` trên Right Sidebar trong `App.jsx`, hiển thị badge phân biệt chú giải tự do (📌) và hỗ trợ thao tác Sửa ✎, Xóa ✕.
  - Bổ sung mục "📌 Chú giải chung" khi xuất bản file HTML (`handleExportHtml`) và Markdown (`handleExportMd`).
  - Migrate `README.md` sang cấu trúc chuẩn Vibecode Flow 5 mục cốt lõi.
- **Files / areas chạm:** `src/context/AppContext.jsx`, `src/components/SuttaReader.jsx`, `src/App.jsx`, `README.md`
- **Ảnh hưởng README:** §1, §3, §4
- **Verify:** `npm run build` thành công mã thoát 0; kiểm tra logic render, event dispatching và export.

---

## 5. Các task chưa làm

- [ ] Hỗ trợ phân loại / gắn thẻ tag cho các chú giải (ví dụ: Thuật ngữ Pali, Điển tích, Triết học).
- [ ] Tính năng tìm kiếm nhanh trong danh sách chú giải của bài kinh.
- [ ] Hỗ trợ xuất riêng danh mục chú giải ra định dạng PDF / Excel / Word.
