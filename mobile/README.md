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

**Suất chiếu (Admin):** vào **Tác vụ → Quản lý suất chiếu** để xem danh sách, lọc theo phim, phân trang, thêm thủ công, sửa hoặc xác nhận xóa suất chiếu. Chọn phim, phòng đang hoạt động, ngày/giờ Việt Nam (UTC+7) và giá vé; ghế lấy từ cấu hình phòng. Backend kiểm tra ngày khởi chiếu, lịch trùng và 15 phút dọn phòng. Không sửa/xóa trực tiếp suất đã bắt đầu, đã hủy, đang giữ ghế hoặc có tham chiếu đặt vé. Khi dữ liệu thay đổi, tải lại và kiểm tra trước khi lưu tiếp. Đề xuất lịch tự động và hủy suất/hoàn điểm tiếp tục dùng website.

Nhân viên không tự sửa đơn tại quầy của người khác; API tiếp tục kiểm tra quyền. Đơn online có thể được nhân viên tra cứu và thu tiền qua màn tác vụ. Các màn quản trị ngoài phạm vi này (phòng chiếu, doanh thu, quản lý nhân sự) tiếp tục dùng website.

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

| File | Chức năng |
|---|---|
| `src/app/` | Route, tab và kiểm tra quyền giao diện |
| `src/session.tsx`, `src/api.ts` | Phiên, token, HTTP, upload và khôi phục đơn F&B |
| `src/screens/AuthScreen.tsx`, `ProfileScreen.tsx` | Tài khoản |
| `src/BookingFlow.tsx`, `RefundPanel.tsx` | Đặt vé, thanh toán, QR, hoàn vé |
| `src/screens/AdminCatalogue.tsx` | Movies/F&B/Promotion CRUD |
| `src/screens/StaffScreens.tsx`, `Reconciliation.tsx` | Quầy, camera và đối soát |

- `npm run check:mobile` từ root: TypeScript.
- `npm --prefix mobile run lint`: lint.
- `cd mobile` rồi `npx expo install --check`: kiểm tra phiên bản dependency.
- `cd mobile` rồi `npx expo export --platform android`: kiểm tra bundle Android, không tạo APK.
- Sau khi chạy Expo, từ `backend` chạy `node tests/ui/test-mobile-showtimes-ui.js`: kiểm tra giao diện suất chiếu ở kích thước điện thoại qua browser preview, dùng database tạm riêng và không sửa dữ liệu app đang chạy. Có thể đặt `MOBILE_UI_URL` nếu Expo không chạy tại `http://localhost:8081`.

Các kiểm tra tự động dùng database tạm, email/Google giả lập để không gửi email hoặc sửa dữ liệu demo của nhóm. Cần kiểm tra cuối trên điện thoại: cấp/từ chối quyền camera và thư viện ảnh, giữ phiên sau đóng app, ngắt mạng khi tạo/thu tiền, VNPay thực tế và trình duyệt mở lại Expo Go. Google thực tế chờ nhóm cấu hình Client ID.
