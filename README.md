# BookingTicketCinema-SDN-Assignment — CINEMA+

Hệ thống đặt vé xem phim trực tuyến CINEMA+ (SDN302 Assignment).

---

## 1. Quick Start Guide for Team Members

### Yêu cầu môi trường
- **Node.js**: v18+ trở lên.
- **MongoDB Local**: MongoDB Community Server đang chạy tại `mongodb://127.0.0.1:27017`.

### Cấu hình `.env` Backend
1. Chuyển vào thư mục backend:
   ```bash
   cd backend
   ```
2. Tạo hoặc kiểm tra file `.env` (sao chép từ `.env.example` nếu chưa có):
   ```env
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/booking_cinema
   JWT_SECRET=supersecretjwtkey_cinema_2026
   CLIENT_URL=http://localhost:5173
   ```

### Cài đặt dependencies
- Backend:
  ```bash
  cd backend
  npm install
  ```
- Frontend:
  ```bash
  cd frontend
  npm install
  ```

---

## 2. Đồng bộ dữ liệu phim (Movie Seed Command)

Để nạp hoặc đồng bộ toàn bộ 19 bộ phim chuẩn kèm đầy đủ poster, backdrop, trailer và trạng thái chiếu lên MongoDB Local:

```bash
cd backend
npm run seed:movies
```

> **Đặc tính an toàn của `npm run seed:movies`:**
> - **An toàn & Không phá hủy**: Lệnh này **không xóa** (không dùng `deleteMany`) bất kỳ User, Booking, Showtime hay Seat nào.
> - **Bảo toàn ID**: Giữ nguyên `_id` của các phim đã có sẵn để không làm đứt gãy quan hệ Showtime → Movie.
> - **Lặp lại an toàn (Idempotent)**: Chạy nhiều lần mà không sinh phim trùng lặp (duplicate).
> - **Số lượng phim chuẩn**: Đúng **19 phim** (16 phim Đang chiếu — `now-showing`, 3 phim Sắp chiếu — `coming-soon`).

*(Tùy chọn: Nếu muốn reset toàn bộ database gồm Users, Foods, Showtimes và Movies từ đầu, dùng lệnh `npm run seed`).*

---

## 3. Khởi chạy ứng dụng

### Chạy Backend
```bash
cd backend
npm run dev
```
- API chạy tại: `http://localhost:3000`

### Chạy Frontend
```bash
cd frontend
npm run dev
```
- Giao diện mở tại: `http://localhost:5173`

---

## 4. Tài khoản Demo
- **Member**: `member@cinema.com` / `123456`
- **Admin**: `admin@cinema.com` / `admin123`
- **Employee**: `employee@cinema.com` / `employee123`

---

## 5. Xử lý sự cố nếu không thấy ảnh poster / backdrop (Troubleshooting)
1. **Kiểm tra thư mục ảnh cục bộ**:
   Tất cả ảnh poster và backdrop được lưu trực tiếp trong repository tại:
   - `frontend/public/images/posters/` (19 file ảnh `.jpg`)
   - `frontend/public/images/backdrops/` (7 file ảnh `.jpg`)
2. **Kiểm tra đường dẫn**:
   Các phim trong database lưu đường dẫn tĩnh chuẩn:
   - Poster: `/images/posters/<ten_phim>.jpg`
   - Backdrop: `/images/backdrops/<ten_phim>.jpg`
3. **Hard Reload trình duyệt**:
   Nhấn tổ hợp phím `Ctrl + F5` (hoặc `Cmd + Shift + R` trên Mac) trên trình duyệt để xóa cache ảnh cũ.
4. **Chạy lại lệnh đồng bộ**:
   Nếu database trước đó chứa đường dẫn cũ dạng `/assets/posters/`, chỉ cần chạy lại:
   ```bash
   cd backend
   npm run seed:movies
   ```
   Lệnh sẽ tự động chuẩn hóa lại toàn bộ đường dẫn ảnh sang `/images/posters/` mà không làm thay đổi ID phim.

---

## 6. Phạm vi chức năng đã hoàn thành
- Trang chủ trải nghiệm điện ảnh chuẩn Netflix (Hero Banner, Phim Đang Chiếu, Phim Sắp Chiếu, Footer)
- Đặt vé xem phim (Chọn suất chiếu, chọn rạp, giữ ghế 10 phút)
- Chọn Combo Bắp nước (Food & Drink)
- Tích lũy và sử dụng điểm thành viên (Member Points)
- Thanh toán vé trực tuyến
- Quản lý tài khoản (Đăng ký, Đăng nhập, Quản trị viên cập nhật trạng thái, cộng trừ điểm)
