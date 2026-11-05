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

## 6. Phạm vi chức năng & Use Cases

### UC-5: Member profile
- Sign in as a Member, then open `/profile` or **Tài khoản → Hồ sơ**.
- UC-5.1: Update full name (1–100 characters), optional phone (9–15 digits with optional `+`), optional age (0–120), and gender. Cancel discards unsaved changes.
- UC-5.2: Supply the current password and matching new password confirmation. The new password must differ, contain at least 6 characters and fit within bcrypt's 72-byte UTF-8 limit. Five incorrect current passwords lock password attempts for 15 minutes. Success signs out all existing sessions.
- UC-5.3: Read the latest profile from the database. Email, membership points, VIP tier and account status are read-only.
- These fields follow the existing User model; the supplied UC list does not include additional field-level business rules.
- APIs: `GET /api/users/me`, `PATCH /api/users/me`, `PATCH /api/users/me/password`. All require an active Member session; writes accept JSON from the configured `CORS_ORIGIN`.
- Test with `npm run test:profile -w backend` while MongoDB is running. Tests use and remove a separate temporary database without changing existing cinema data.

### Implemented CE190580 scope (Khai)
- UC-13.1: Add Movie — Admin form with server validation and creator tracking.
- UC-13.2: View Movies — Admin catalogue with title search, pagination and movie details.
- UC-13.3: Update Movie — use **Sửa** in the Admin catalogue. The editor shares validation with Add Movie, checks the loaded version to reject stale writes and records `updatedBy`. Movies with any showtime lock title, duration, classification and release date; other descriptive fields remain editable.
- UC-13.4: Delete Movie — use **Xóa** and confirm. Movies referenced by any showtime are blocked. Other movies are soft deleted with `deletedAt`/`deletedBy`; references and audit history are retained, and the movie is hidden from public/Admin catalogues and cannot be booked.
- Sign in at `/admin/login`, then choose **Quản lý phim** or open `/admin/movies`.
- Choose **Thêm phim** to open `/admin/movies/new`; Cancel returns without saving.
- Movie media uses existing local asset paths or HTTP(S) URLs; file upload is not included.
- Existing seeded movies keep their `ageLimit`; new movies also store the classification (`P`, `K`, `T13`, `T16`, `T18`, `C`). C movies are excluded from the public catalogue and rejected at booking.
- API: `GET /api/movies/admin?search=&page=1&limit=10` and `POST /api/movies` require an active Admin session. Public `GET /api/movies` keeps its array response.
- Run `npm run test:movies -w backend` with MongoDB running. Tests create and remove their own temporary database and do not change `booking_cinema`.

### UC-11: Standalone food and drink sales
- Sign in as an Employee, then open **Bán đồ ăn & thức uống** at `/employee/food-sales`.
- Select quantities, request the server-generated quote, confirm the total with the customer, enter the cash received and confirm receipt. The final receipt retains the item names, unit prices, quantities, total, employee, payment time and change.
- Only cash is implemented. This flow creates no booking, seat hold or movie ticket. VNPay, promotions, membership points and revenue dashboard integration are separate work.
- The `Food.stock` field is a non-negative integer. Existing products without stock cannot be sold at this counter until inventory is set. Optional local demo: `npm run seed:food-counter -w backend` adds three products with 30 units each **only if their names do not already exist**; it does not clear data or replenish existing items.
- API base `/api/food-sales`: Employee-only `GET /catalogue`, `POST /` (items and `requestId`), `GET /:id`, `POST /:id/cancel`, `POST /:id/pay`. An Employee can only access their own orders.
- Creating a quote snapshots server prices without deducting stock. Cancelling is allowed before cash confirmation. Request IDs and paid-order retries prevent duplicate orders or duplicate stock deductions.
- Finalization runs in a MongoDB transaction, so stock and the Paid receipt commit together. Cash receipt evidence is persisted first. If price/stock changed or finalization fails, the payment stays traceable for staff reconciliation; never collect cash again for that order. Reconciliation/refund resolution requires the cinema's operating procedure; there is no automatic second charge or manual Paid override in this screen.
- An order ID is retained in the browser session for refresh/recovery. If the response is lost, reopen the order and retry finalization of the existing payment, rather than creating a new payment.

### UC-17.1–17.4: Manage Showtimes (Admin)
- Sign in at `/admin/login`, choose **Quản lý suất chiếu**, or open `/admin/showtimes`.
- View the paginated list and filter by movie. Add a showtime, edit it, or review its details and confirm deletion. Cancel leaves the data unchanged.
- Required fields: movie, cinema, room, future start time and a positive whole-number ticket price in VND. All form times use Vietnam time (UTC+7).
- Reuses the existing Showtime model and Admin CSS. No extra classes, models, packages or schema changes. New showtimes use the seeded 40-seat layout (A1–E8); edits preserve existing seats.
- Checks room conflicts across movies, including the movie duration plus a 15-minute cleaning buffer (BR-6). C-classified movies and screenings before the release date are rejected.
- Direct edit/delete is blocked for started screenings, seat holds, sold seats and any booking reference, including cancelled bookings, preserving transaction history (BR-12, BR-17). Controlled cancellation, customer notice and refunds are outside these four use cases.
- API: `GET /api/showtimes?movie=&page=1&limit=10`, `POST /api/showtimes`, `PUT /api/showtimes/:id`, `DELETE /api/showtimes/:id`. All require an active Admin session. Writes require JSON and validate the request origin.
- POST/PUT fields: `movie`, `cinema`, `room`, `startTime` (ISO timestamp with timezone), `price`. PUT/DELETE also require the `updatedAt` value from the list; stale data returns 409. DELETE sends `{ "updatedAt": "..." }` as JSON.
- Successful writes log the acting Admin and showtime ID to the server audit log. The existing public `/api/movies/showtimes` response remains unchanged and reflects saved changes.
- Run `npm run test:showtimes -w backend` with MongoDB running. Tests create and remove a dedicated temporary database, leaving existing cinema data untouched.

### Implemented CE190006 scope
- Trang chủ trải nghiệm điện ảnh chuẩn Netflix (Hero Banner, Phim Đang Chiếu, Phim Sắp Chiếu, Footer)
- Chi tiết phim (Movie Detail) phong cách Netflix cinematic
- Book Movie Ticket
- Add Food & Drink
- Reserve Seat (10-minute hold)
- Payment Process
- Apply Member Point
- Payment via VNPay (demo flow; real merchant credentials can be plugged in later)
- Create Account
- Update Account Status
- Adjust Member Points
