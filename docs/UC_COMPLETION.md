# Hoàn thiện 9 UC — thanh toán giả lập

## Phạm vi đã thống nhất

- Thanh toán là **giả lập**, không thu tiền thật. VNPay giả lập và tiền mặt giả lập có nhãn rõ trên giao diện.
- Chỉ dùng điểm để giảm tiền, không tự tích điểm. Một điểm giảm 1.000đ; mặc định dùng **từng điểm** (`POINT_REDEEM_STEP=1`), ví dụ 20 điểm giảm 20.000đ. Đây là thay đổi theo yêu cầu trải nghiệm dùng điểm; nếu cần chế độ BR-4 đổi theo bội số 100, đặt `POINT_REDEEM_STEP=100` rồi khởi động lại backend. Điều chỉnh thủ công không bị ràng buộc theo bước đổi.
- Admin và Employee được bán vé tại quầy. Employee xử lý đơn quầy của mình; Admin có thể hỗ trợ đơn quầy khác. Khách vãng lai không cần tài khoản hay thông tin cá nhân.
- Các thay đổi này thay thế những khác biệt tương ứng trong báo cáo rà soát ban đầu.

## Kết quả từng UC

| UC | Nội dung đã hoàn thiện |
| --- | --- |
| Book Movie Ticket | Member đặt đơn của chính mình, kiểm tra phim/suất còn bán, chặn C, kiểm tra tuổi đã được nhân viên xác minh cho T13/T16/T18, điều kiện giám hộ K, xác nhận giá, hủy đơn pending, phát hành vé sau khi hoàn tất |
| Add Food & Drink | Chọn/bỏ món và số lượng, sửa món của đơn pending không kéo dài giữ ghế, kiểm tra availability/stock, snapshot tên và đơn giá, trừ tồn kho khi thanh toán thành công |
| Reserve Seat | Giữ độc quyền toàn bộ lựa chọn trong 10 phút, chống trùng bằng conditional update, transaction rollback không để giữ một phần, hủy giải phóng ghế, worker dọn hết hạn mỗi 15 giây và refresh sơ đồ ghế khi đặt vé |
| Payment Process | Transaction nhiều collection cho điểm + kho + ghế + receipt + ticket. Chống thanh toán lặp, receipt một lần, rollback toàn bộ khi lỗi, không phát hành vé cho thất bại/hết hạn. Tiền mặt từ đơn online phải do nhân viên xác nhận số tiền đúng |
| Apply Member Point | Số nguyên theo bước cấu hình, không vượt số dư/giá trị đơn, cho sửa/bỏ khi pending, recheck khi hoàn tất, ghi redemption ledger, nhánh points-only riêng cho 0đ không tạo giao dịch gateway/cash |
| Payment via VNPay | **VNPay giả lập theo yêu cầu mới**: thử thất bại hoặc thành công, thất bại không trừ điểm/kho, thành công phát hành QR. Không yêu cầu merchant hoặc tiền thật cho luồng demo |
| Create Account | Admin tạo Employee/Admin với mật khẩu ngẫu nhiên riêng, lưu bcrypt hash, gửi thông tin qua SMTP thật. Chỉ Active sau khi SMTP chấp nhận; lỗi gửi giữ Pending Activation và có Gửi lại email. Không trả mật khẩu qua API hoặc giao diện |
| Update Account | Sửa họ tên, email, điện thoại, vai trò nhân sự và trạng thái; Lưu thay đổi trực tiếp không mở hộp xác nhận. Kiểm tra phiên bản/trạng thái gốc, email trùng, thu hồi phiên khi khóa/hạ quyền, chặn tự khóa/hạ quyền và bảo vệ Admin cuối bằng transaction |
| Adjust Member Points | Admin-only/Member-only, delta có lý do và preview, không âm, kiểm tra số dư cũ, request ID chống lặp, balance và audit cùng atomic update, xem 20 điều chỉnh mới nhất |

Mỗi ghế có một mã vé riêng và QR PNG thực, được lưu trong booking sau finalization. Vé xuất hiện trên màn hình kết quả và lịch sử Member. API quầy có thể tra cứu mã vé đã phát hành; đây không phải mở rộng toàn bộ UC Check-in/Refund.

## Chạy local

```powershell
npm ci
npm run db:local -w backend
# Chỉ khi chưa có backend/.env: sao chép backend/.env.example và đặt JWT_SECRET riêng.
npm run dev:backend
npm run dev:frontend
```

- Cần cài MongoDB Server và có `mongod` trên PATH, hoặc đặt `MONGOD_BINARY` trỏ đến binary.
- `db:local` khởi động một replica set một node `cinemaLocal`, chỉ bind `127.0.0.1`, cổng `27019`. Dữ liệu nằm trong `.local/mongodb`, được Git bỏ qua. Không xóa dữ liệu khi chạy lại.
- `MONGODB_URI=mongodb://127.0.0.1:27019/booking_cinema?replicaSet=cinemaLocal`.
- Phiên làm việc này đã sao chép dữ liệu database cũ sang replica set, giữ nguyên database gốc. Bản cấu hình trước đổi nằm trong `.local/backend.env.before-replica`, cũng được Git bỏ qua.
- `ENABLE_PAYMENT_SIMULATION=true` bật demo khi development/test. Backend từ chối giả lập nếu `NODE_ENV=production`, kể cả khi flag vẫn bật.
- Không tự bịa tồn kho: món cũ chưa có số lượng được xem là 0. Admin vào **Nghiệp vụ quầy → Tồn kho bắp nước** để nhập số lượng thực hành/thực tế.
- Member xem phim giới hạn tuổi cần nhân viên vào **Nghiệp vụ quầy → Xác minh tuổi Member**. Sửa tuổi trong hồ sơ không vượt qua điều kiện xác minh.

## Luồng dùng thử

1. Member đăng nhập, chọn phim/suất/ghế, số lượng món, điểm theo bội số 100, tạo đơn.
2. Chọn thất bại giả lập: đơn vẫn pending, giữ ghế còn hạn; điểm và tồn kho không đổi.
3. Chọn thành công giả lập: transaction tạo receipt, trừ kho/điểm, bán ghế, phát hành từng QR. Retry trả kết quả cũ.
4. Đơn 0đ xác nhận bằng điểm, không đi qua gateway/cash.
5. Hoặc Member chọn tiền mặt, đưa mã đơn cho nhân viên. Nhân viên tra cứu trên Nghiệp vụ quầy, nhập đúng số tiền và xác nhận giả lập trước hạn. Màn hình Member tự cập nhật kết quả.
6. Tại quầy có thể chọn Guest để không lưu tên/email/điện thoại, hoặc tìm Member nếu muốn dùng điểm.
7. Admin mở Tạo tài khoản, nhập thông tin nhân sự rồi chọn Tạo tài khoản và gửi email. Người nhận dùng mật khẩu ngẫu nhiên trong email để đăng nhập và đổi mật khẩu trong Hồ sơ. Nếu SMTP lỗi hoặc chưa cấu hình, UI báo rõ và cho Gửi lại email; không có mật khẩu/link kích hoạt trên UI. Cập nhật tài khoản cho sửa và lưu trực tiếp, không hiện hộp xác nhận.

## Kiểm thử lặp lại được

```powershell
npm test -w backend
npm test -w frontend
npm run build
npm run test:e2e -w backend
```

- Backend: 75 bài đạt trên MongoDB replica set thực; không mock transaction.
- Frontend: 4 bài đạt.
- Build: thành công.
- E2E chạy Edge headless, Vite test riêng tại cổng 5188, API test cổng tạm và database có tên ngẫu nhiên; chỉ xóa database test của chính nó. Không thay đổi tài khoản/đơn thực.
- E2E gồm Member login, đặt nhanh, số lượng, dùng điểm, failure/success simulation, QR trong lịch sử, Admin gửi lời mời, nhân viên kích hoạt/đăng nhập và quyền theo role. Screenshot kiểm thử ở `.local/qa/payment.png`.
- Có thể đặt `E2E_BROWSER_CHANNEL=chrome` nếu không dùng Microsoft Edge.

## Giới hạn cần hiểu đúng

- Đây là nghiệm thu **thanh toán giả lập**. Không khẳng định đã thu tiền, kết nối merchant hoặc kiểm chứng callback với máy chủ VNPay thật.
- Adapter VNPay sandbox tùy chọn được giữ riêng, chưa có credential local và chưa kiểm thử với nhà cung cấp. Nó không được dùng khi bấm VNPay giả lập. Tài liệu tham khảo chính thức: [VNPay payment API](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html).
- SMTP thật chưa được cấu hình nên không khẳng định email đã đến hộp thư. Có thể kiểm thử kích hoạt bằng link local; production cần cấu hình SMTP để gửi thư.
- Tích điểm tự động, khuyến mãi, hoàn tiền, quản lý toàn bộ phòng/suất và check-in không thuộc 9 UC đã yêu cầu hoặc đã được người dùng loại khỏi phạm vi hiện tại. Hệ thống không nhận một mã coupon để tự tạo giảm giá không được xác minh.
