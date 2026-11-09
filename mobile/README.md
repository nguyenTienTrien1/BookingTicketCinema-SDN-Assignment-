# CINEMA+ Mobile — demo bằng Expo Go

App React Native/TypeScript dùng chung Express và MongoDB với website; điều hướng bằng Expo Router trong `src/app/`. Không cần build APK hay dùng EAS để demo. Mobile giữ package-lock riêng để không đổi React/dependency của website.

## Chạy

1. Từ thư mục repo chính: `npm run db:local -w backend`, rồi `npm run dev:backend`.
2. Lần đầu: `cd mobile`, `npm ci`, sao chép `.env.example` thành `.env`.
3. Đặt `EXPO_PUBLIC_API_URL=https://<ngrok-domain>/api` hoặc `http://<IP-laptop>:3000/api`. Điện thoại thật không dùng localhost. Android emulator dùng `http://10.0.2.2:3000/api`.
4. Từ repo chính: `npm run dev:mobile`. Điện thoại và laptop cùng Wi-Fi, dùng Expo Go quét QR trong terminal. Expo Go phải tương thích SDK trong `mobile/package.json`; nếu báo SDK mismatch, gửi nguyên thông báo để đồng bộ phiên bản, không cần chuyển sang APK.
5. Nếu đổi `.env`: `npm run dev:mobile -- --clear`. Nếu Metro đang chạy trên 8081 thì dừng phiên cũ bằng Ctrl+C trước.

Ngrok backend và kết nối Expo/Metro là hai kết nối riêng. `expo start --tunnel` chỉ tunnel Metro, không tự tunnel API. Ngrok dừng thì các API và callback VNPay qua ngrok cũng ngừng.

Xem trước trình duyệt: `npm --prefix mobile run web` → http://localhost:8081. Backend development cho phép origin này; nếu đổi origin cần `MOBILE_WEB_ORIGIN` tương ứng trong backend/.env. Preview trình duyệt không thay thế kiểm tra camera/SecureStore trên điện thoại.

## Chức năng

**Tài khoản:** đăng nhập member hoặc nhân viên/Admin; đăng ký; xác minh và gửi lại email; yêu cầu đặt lại mật khẩu; dán token/liên kết email vào app để đặt lại mật khẩu; chỉnh hồ sơ; đổi mật khẩu và đăng nhập lại; xem điểm; đăng xuất. Token native được lưu SecureStore; browser preview chỉ giữ token trong bộ nhớ.

**Member:** xem/tìm phim, lịch chiếu, chọn ghế, thêm F&B, giữ ghế, nhập hoặc chọn mã từ danh sách, dùng điểm, thanh toán VNPay, xem lại đơn pending, hủy đơn chưa thanh toán, lịch sử, QR vé; xem báo giá hoàn toàn bộ đơn và xác nhận hoàn về điểm theo chính sách backend.

**Admin:** danh sách/tìm kiếm/lọc/phân trang và thêm/sửa/xóa phim, F&B, khuyến mãi; chọn ảnh thư viện điện thoại hoặc URL cho poster/banner/F&B; thời hạn khuyến mãi theo ngày trọn vẹn hoặc giờ cụ thể. Backend vẫn chặn sửa phim đã có lịch, thay đổi F&B đang có đơn và thay đổi điều kiện mã đã dùng.

**Nhân viên:** tìm thành viên, bán vé cho khách vãng lai/thành viên, dùng điểm và mã khi có quyền sửa đơn, thu tiền mặt hoặc mở VNPay, bán riêng F&B tiền mặt (UC-11), giữ mã đơn F&B để khôi phục khi tải lại app, tra cứu đơn vé/F&B, đối soát khoản thu, ghi chú, thử hoàn tất hoặc xác nhận trả khoản thực thu; quét QR bằng camera hoặc nhập mã để check-in theo suất và giờ vào rạp.

Nhân viên không tự sửa đơn tại quầy của người khác; API tiếp tục kiểm tra quyền. Đơn online có thể được nhân viên tra cứu và thu tiền qua màn tác vụ. Các màn quản trị ngoài phạm vi này (phòng chiếu, lịch chiếu, doanh thu, quản lý nhân sự) tiếp tục dùng website.

## Google — cấu hình sau theo lựa chọn của nhóm

Code đăng nhập/liên kết đã có nhưng backend hiện chưa cấu hình Client ID:

1. Trong Google Cloud tạo **OAuth Web Client ID**. Thêm origin của backend/ngrok vào Authorized JavaScript origins, ví dụ `https://<ngrok-domain>`. Với kiểm tra local có thể thêm `http://localhost:3000`. Đây là origin trang Google dành cho mobile, khác origin Vite 5173.
2. Đặt `GOOGLE_CLIENT_ID=<web-client-id>.apps.googleusercontent.com` trong `backend/.env`, khởi động lại backend. Không đưa Client Secret vào mobile. Không cần OAuth redirect scheme riêng của app cài đặt.
3. Đăng nhập member bằng mật khẩu, vào Tài khoản → Liên kết Google. Trang trình duyệt yêu cầu mật khẩu CINEMA+ hiện tại và Google cùng email. Backend kiểm tra lại mật khẩu, nonce, Google ID token và phiên tài khoản.
4. Sau liên kết, có thể đăng nhập bằng Google trên màn đăng nhập. Tài khoản Google chưa liên kết không được tự động tạo/gộp tài khoản, theo nghiệp vụ website hiện có.

Google mở bằng system browser để dùng với Expo Go. Phiên chuyển giao có secret chỉ app biết, cookie ràng buộc browser, TTL 5 phút và chỉ đổi lấy token một lần. JWT không nằm trong URL. Nếu backend restart giữa chừng, bắt đầu lại đăng nhập Google.

## Email

Đăng ký/quên mật khẩu dùng SMTP hiện có của backend. App không chứa SMTP password. Liên kết email website vẫn hoạt động; để thao tác trong app, sao chép liên kết/token vào màn xác minh hoặc Đặt lại mật khẩu. Route `/verify-email` và `/reset-password` của Expo cũng nhận tham số `token` nếu mở bằng liên kết Expo.

## VNPay và quay lại Expo Go

App tạo địa chỉ quay lại bằng `Linking.createURL('/payment-return')` và gửi cùng yêu cầu thanh toán. Backend kiểm tra protocol/path rồi lưu địa chỉ trên PaymentAttempt. Return URL/IPN của VNPay vẫn là backend đang dùng với website; không cần thay callback website.

Sau callback, trang kết quả mở lại Expo Go bằng link đã lưu. Nếu trình duyệt không cho tự mở, bấm **Mở lại Expo Go** hoặc quay lại thủ công. App đọc kết quả từ API có kiểm tra chủ đơn/quyền nhân viên; deep link không thể tự chuyển đơn thành Paid. Có nút mở lại VNPay và kiểm tra trạng thái; polling khi app foreground hỗ trợ callback chậm.

Vé demo/mô phỏng được đánh dấu riêng. Không bật `ENABLE_PAYMENT_SIMULATION` cho production. Bản thân app không có nút tự xác nhận thanh toán thành công.

## File và kiểm tra

```text
mobile/
├── App.js
├── app.json
├── babel.config.js
├── metro.config.js
├── assets/
├── src/
│   ├── app/          # Khai báo route của Expo Router
│   ├── components/   # Thành phần giao diện dùng chung
│   ├── context/      # Phiên đăng nhập và thông tin người dùng
│   ├── navigation/   # Stack, tab và điều kiện truy cập
│   ├── screens/      # Màn hình theo nhóm nghiệp vụ
│   │   ├── account/
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── booking/
│   │   ├── member/
│   │   └── staff/
│   ├── services/     # HTTP, token, lưu đơn và mở trình duyệt
│   ├── theme/        # Màu sắc và StyleSheet dùng chung
│   └── utils/        # Kiểu dữ liệu, định dạng, hook và ánh xạ ảnh
└── tests/            # Dành sẵn cho kiểm thử; hiện chưa thêm bộ test
```

`App.js` khởi động Expo Router. Giữ `src/app/` để các đường dẫn, liên kết Google, email và callback thanh toán tiếp tục hoạt động. Các layout gọi navigator trong `src/navigation/`; màn hình và phần dùng chung nằm ngoài thư mục route. `DateField.native.tsx` được Metro chọn cho Android/iOS, còn `DateField.tsx` phục vụ bản web.

| Thư mục / file | Chức năng |
|---|---|
| `src/app/`, `src/navigation/` | Đường dẫn, stack, tab và kiểm tra quyền giao diện |
| `src/context/SessionContext.tsx`, `src/services/` | Phiên, token, HTTP, upload, mở trình duyệt và khôi phục đơn |
| `src/screens/auth/`, `src/screens/account/` | Đăng nhập, đăng ký, xác minh email, mật khẩu và hồ sơ |
| `src/screens/member/`, `src/screens/booking/`, `src/components/RefundPanel.tsx` | Phim, đặt vé, lịch sử, thanh toán, QR và hoàn vé |
| `src/screens/admin/AdminCatalogue.tsx` | Movies/F&B/Promotion CRUD |
| `src/screens/staff/` | Tác vụ nhân viên, bán vé/F&B, thu tiền, tra cứu thành viên, check-in và đối soát |
| `src/components/`, `src/theme/` | Giao diện, màu sắc và kiểu hiển thị dùng chung |
| `src/utils/` | Kiểu dữ liệu, định dạng tiền/ngày/trạng thái, hook và ảnh đóng gói |

- `npm run check:mobile` từ root: TypeScript.
- `npm --prefix mobile run lint`: lint.
- `cd mobile` rồi `npx expo install --check`: kiểm tra phiên bản dependency.
- `cd mobile` rồi `npx expo export --platform android`: kiểm tra bundle Android, không tạo APK.

Các kiểm tra tự động dùng database tạm, email/Google giả lập để không gửi email hoặc sửa dữ liệu demo của nhóm. Cần kiểm tra cuối trên điện thoại: cấp/từ chối quyền camera và thư viện ảnh, giữ phiên sau đóng app, ngắt mạng khi tạo/thu tiền, VNPay thực tế và trình duyệt mở lại Expo Go. Google thực tế chờ nhóm cấu hình Client ID.
