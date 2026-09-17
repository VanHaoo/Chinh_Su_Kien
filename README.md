# LED Controller

Web app điều khiển nội dung hiển thị trên màn hình LED / máy chiếu, lấy cảm hứng từ các phần mềm trình chiếu chuyên nghiệp (vMix, Resolume, OBS...).

Bản này gồm **đầy đủ V1 → V7** theo roadmap đã thống nhất: giao diện `/control` cho người vận hành, `/output` để đưa ra màn hình LED/máy chiếu, backend Node/Express/SQLite quản lý project, và Socket.IO đồng bộ Control ↔ Output theo thời gian thực.

## Cấu trúc thư mục

```text
led-controller/
├── client/                     # React + Vite frontend
│   ├── src/
│   │   ├── components/         # Header, MediaPanel, Canvas, Properties,
│   │   │                         Timeline, Layers, StageObjectContent
│   │   ├── pages/               Control.jsx (/control), Output.jsx (/output)
│   │   ├── state/                ProjectContext.jsx — object/project state
│   │   ├── hooks/                useLiveBroadcast.js, useLiveReceiver.js
│   │   ├── services/             api.js, socket.js, youtube.js
│   │   ├── data/                 objectFactory.js — tạo object mới đúng schema
│   │   └── index.css             design tokens dùng toàn app
│   └── package.json
├── server/                     # Node + Express + Socket.IO + SQLite backend
│   ├── routes/                   projects.js (CRUD), upload.js
│   ├── uploads/                  file ảnh/video đã upload
│   ├── database/                 database.sqlite (tạo khi chạy lần đầu)
│   ├── db.js                     schema: projects / objects / timeline
│   ├── socket.js                 live sync Control → Output
│   └── server.js
└── README.md
```

## Cách chạy

Cần chạy **2 tiến trình song song**: server (API + Socket.IO) và client (giao diện). Mở 2 terminal:

```bash
# Terminal 1 — backend
cd server
npm install
npm run dev          # http://localhost:4000

# Terminal 2 — frontend
cd client
npm install
npm run dev          # http://localhost:5173
```

- Giao diện vận hành: [http://localhost:5173/control](http://localhost:5173/control)
- Giao diện xuất hình: [http://localhost:5173/output](http://localhost:5173/output)

Client dùng proxy có sẵn trong `vite.config.js` để gọi `/api`, `/uploads` và WebSocket sang server ở cổng 4000, nên không cần cấu hình CORS thủ công khi chạy local.

### Quy trình dùng 2 màn hình (Windows Extend Displays)

1. Mở `/control` trên màn hình laptop, dựng nội dung.
2. Mở thêm một cửa sổ trình duyệt tới `/output`.
3. Kéo cửa sổ `/output` sang màn hình LED / máy chiếu (màn hình thứ 2).
4. Trên `/output`, nhấn phím `F` hoặc double-click để bật fullscreen.
5. Trên `/control`, nhấn **GO LIVE** để đẩy nội dung hiện tại ra `/output`.

## Tính năng theo từng phiên bản

### V1 — Khung giao diện

Header, Media Panel, Canvas/Preview, Properties Panel, Timeline, Layers Panel, `/control` và `/output` (output không có bất kỳ UI điều khiển nào).

### V2 — Text, Image, chỉnh sửa object

Thêm Text (chỉnh nội dung, font, size, bold/italic, màu, căn lề), upload Image (PNG/JPG/WEBP). Kéo thả, resize (4 góc), xoay, xóa object ngay trên Canvas; Properties Panel chỉnh trực tiếp X/Y/Width/Height/Rotation/Opacity; Layers Panel sắp xếp thứ tự (▲▼), ẩn/hiện, xóa.

### V3 — Video

Upload video (MP4/WEBM). Timeline điều khiển Play/Pause/Stop, hiển thị current time/duration thật, kéo thanh timeline để tua — nhắm vào object video/YouTube đang "active" (object đang chọn, hoặc object media trên cùng).

### V4 — YouTube

Nhập URL hoặc video ID YouTube ở Media Panel, dùng YouTube IFrame Player API (không tải video về server). Ô nhập và mọi control chỉ tồn tại ở `/control` — `/output` chỉ hiển thị video đang phát, không có giao diện tìm kiếm.

### V5 — LIVE / Socket.IO

Nút **GO LIVE** ở Header đẩy toàn bộ trạng thái Canvas hiện tại sang `/output` qua Socket.IO. Timeline cũng gửi kèm lệnh play/pause/seek để video/YouTube trên `/output` phát đồng bộ với Control. Header hiển thị trạng thái kết nối tới `/output` theo thời gian thực.

### V6 — Project / SQLite

New / Open / Save / Save As / Rename / Delete Project — lưu trong SQLite (`server/database/database.sqlite`, bảng `projects`, `objects`, `timeline`). Menu **Project** trên Header thao tác đầy đủ các lệnh này.

### V7 — Hoàn thiện

- Fullscreen trên `/output` (phím `F` hoặc double-click).
- Hotkeys trên `/control`: `Delete`/`Backspace` xóa object đang chọn, `Esc` bỏ chọn, `Ctrl/Cmd+S` lưu project, `Space` play media đang active (chỉ hoạt động khi không gõ trong ô input/textarea).
- Hiệu ứng crossfade nhẹ trên `/output` mỗi khi nhận state LIVE mới, và transition mượt khi kéo/resize object trên Canvas.
- Socket.IO tự động reconnect (`reconnection: true`); `/output` giữ nguyên nội dung LIVE gần nhất nếu tạm mất kết nối, và có 1 chấm trạng thái rất nhỏ ở góc màn hình để debug kết nối mà không phá bố cục "chỉ hiển thị nội dung" của output.

## Ghi chú kỹ thuật / giới hạn đã biết

- **Resize khi object đang xoay**: tính toán resize hiện dùng hệ tọa độ canvas thẳng (không xoay ngược delta chuột vào hệ trục cục bộ của object). Với object chưa xoay (trường hợp phổ biến) resize hoạt động chính xác 100%; với object đã xoay, resize vẫn hoạt động và không bị lỗi nhưng hướng kéo có thể không khớp tuyệt đối theo cạnh đã xoay của object.
- **Đồng bộ phát media giữa Control và Output**: mỗi bên tự render video/YouTube độc lập; Control gửi lệnh play/pause/seek qua Socket.IO để Output áp dụng lên đúng object. Đây là đồng bộ theo lệnh (command-based), không phải đồng bộ khung hình tuyệt đối — đủ dùng cho trình chiếu thực tế nhưng có thể lệch vài trăm mili-giây ngay sau một lệnh play/seek.
- **Multi-select**: chưa làm (mục 5 trong yêu cầu ghi "nếu có thể") — mỗi lần chỉ chọn được 1 object.
- **Server cần chạy trước** khi mở `/control` để New/Open/Save Project, upload ảnh/video, và GO LIVE hoạt động. Nếu chỉ mở client mà không chạy server, `/control` sẽ báo lỗi khi tạo project mới lúc khởi động.
- **better-sqlite3** là native module — đã kiểm tra cài đặt thành công trong môi trường build (Linux x64) bằng prebuilt binary, không cần công cụ build (node-gyp) trong phần lớn trường hợp. Nếu máy bạn gặp lỗi khi `npm install` ở bước này, thường do thiếu binary phù hợp cho OS/Node version — cần cài Node LTS bản phổ biến (18/20/22) để dùng đúng prebuilt binary.