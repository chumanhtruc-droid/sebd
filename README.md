# ⚡ Cloud Reverse Proxy + HTML Script Injector + Index Extractor

Hệ thống Cloud Reverse Proxy trung gian cho phép chuyển tiếp request tới Website kiểm thử mục tiêu, tự động bắt gói tin HTML response, giải nén và tiêm mã **Index Extractor** trước thẻ `</body>`, sau đó tự động bóc tách câu hỏi và hiển thị lên Cloud Dashboard theo thời gian thực.

Deployable trực tiếp trên **Render Web Service** (hoặc chạy local qua Node.js).

---

## 🏛️ Kiến Trúc Luồng Hoạt Động

```text
Client (Browser)
       │
       ▼
Render Cloud Reverse Proxy (https://your-service.onrender.com)
       │
       ▼
Target Test Website (Website bài thi mục tiêu)
       │
       ▼
Response Interceptor (onBeforeResponse)
       │
       ├── Content-Type Check (Chỉ nhận text/html)
       ├── Decompress (Gzip / Deflate / Brotli via zlib)
       └── Anti-Duplicate Check (data-index-extractor marker)
       │
       ▼
HTML Injector (Tiêm script Index Extractor trước </body>)
       │
       ▼
Client Browser (Nhận HTML đã tiêm script & Render)
       │
       ▼
Injected Index Extractor (Quét DOM -> Bóc Index & Đáp án -> Khử Duplicate)
       │
       ▼
Cloud Dashboard (POST /api/save -> Hiển thị thời gian thực, Copy JSON, Tải TXT)
```

---

## 🚀 Hướng Dẫn Deploy Lên Render.com (Miễn Phí)

### Cách 1: Deploy qua GitHub (Khuyên dùng)
1. Đẩy toàn bộ thư mục dự án lên một Repository GitHub của bạn.
2. Đăng nhập vào [Render.com](https://render.com) $\rightarrow$ Bấm nút **`New +`** $\rightarrow$ Chọn **`Web Service`**.
3. Kết nối với GitHub Repository vừa tạo.
4. Cấu hình cài đặt:
   * **Name**: `cloud-reverse-proxy-extractor`
   * **Runtime**: `Node`
   * **Build Command**: *(để trống)*
   * **Start Command**: `node server.js`
   * **Instance Type**: `Free`
5. (Tùy chọn) Trong mục **Environment Variables**, bạn có thể thêm:
   * `TARGET_URL`: Đường link website bài thi cố định (nếu muốn proxy toàn bộ request về trang này).
6. Bấm **`Create Web Service`**. Render sẽ tự động build và cung cấp cho bạn một domain HTTPS (ví dụ: `https://cloud-reverse-proxy-extractor.onrender.com`).

---

## 🌐 Cách Sử Dụng Sau Khi Deploy

### 1. Truy cập Cloud Dashboard:
Mở đường link Render của bạn:
👉 **`https://your-service.onrender.com/`** hoặc **`https://your-service.onrender.com/dashboard`**

### 2. Mở website bài thi qua Reverse Proxy:
* **Cách 1 (Nhập trên Dashboard)**: Dán URL website bài thi vào ô *"Mở Web Test Qua Reverse Proxy"* trên Dashboard $\rightarrow$ bấm **`Mở & Tự Động Tiêm Mã`**.
* **Cách 2 (Mở trực tiếp qua link URL)**:
  ```text
  https://your-service.onrender.com/proxy?url=https://ten-website-bai-thi.com/quiz
  ```

Ngay khi trang web bài thi tải lên:
* Mã Index Extractor đã được tự động tiêm sẵn vào mã nguồn HTML.
* Trang web sẽ tự động bóc toàn bộ câu hỏi và gửi về Cloud Dashboard của bạn!

---

## 💻 Cách Chạy & Kiểm Thử Local

```bash
# 1. Khởi động server Cloud Proxy
node server.js

# 2. Khởi động trang web test mẫu (nén Gzip)
node test/test_server.js

# 3. Mở trình duyệt kiểm thử:
# Dashboard: http://localhost:3000
# Proxy Test: http://localhost:3000/proxy?url=http://127.0.0.1:5000
```
