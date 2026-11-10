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

**Tài khoản:** đăng nhập member hoặc nhân viên/Admin; đăng ký; bấm liên kết trong email để tự xác minh và gửi lại email; yêu cầu đặt lại mật khẩu; bấm email để mở form đặt mật khẩu mới trong app; chỉnh hồ sơ; đổi mật khẩu và đăng nhập lại; xem điểm; đăng xuất. Token native được lưu SecureStore; browser preview chỉ giữ token trong bộ nhớ.

**Member:** xem/tìm phim, lịch chiếu, chọn ghế, thêm F&B, giữ ghế, nhập hoặc chọn mã từ danh sách, dùng điểm, thanh toán VNPay, xem lại đơn pending, hủy đơn chưa thanh toán, lịch sử, QR vé; xem báo giá hoàn toàn bộ đơn và xác nhận hoàn về điểm theo chính sách backend.

**Admin:** danh sách/tìm kiếm/lọc/phân trang và thêm/sửa/xóa phim, F&B, khuyến mãi; chọn ảnh thư viện điện thoại hoặc URL cho poster/banner/F&B; thời hạn khuyến mãi theo ngày trọn vẹn hoặc giờ cụ thể. Backend vẫn chặn sửa phim đã có lịch, thay đổi F&B đang có đơn và thay đổi điều kiện mã đã dùng.

**Nhân viên:** tìm thành viên, bán vé cho khách vãng lai/thành viên, dùng điểm và mã khi có quyền sửa đơn, thu tiền mặt hoặc mở VNPay, bán riêng F&B tiền mặt (UC-11), giữ mã đơn F&B để khôi phục khi tải lại app, tra cứu đơn vé/F&B, đối soát khoản thu, ghi chú, thử hoàn tất hoặc xác nhận trả khoản thực thu; quét QR bằng camera hoặc nhập mã để check-in theo suất và giờ vào rạp.

**Suất chiếu (Admin):** vào **Tác vụ → Quản lý suất chiếu** để xem danh sách, lọc theo phim, phân trang, thêm thủ công, sửa hoặc xác nhận xóa suất chiếu. Chọn phim, phòng đang hoạt động, ngày/giờ Việt Nam (UTC+7) và giá vé; ghế lấy từ cấu hình phòng. Backend kiểm tra ngày khởi chiếu, lịch trùng và 15 phút dọn phòng. Không sửa/xóa trực tiếp suất đã bắt đầu, đã hủy, đang giữ ghế hoặc có tham chiếu đặt vé. Khi dữ liệu thay đổi, tải lại và kiểm tra trước khi lưu tiếp. Đề xuất lịch tự động và hủy suất/hoàn điểm tiếp tục dùng website.

Nhân viên không tự sửa đơn tại quầy của người khác; API tiếp tục kiểm tra quyền. Đơn online có thể được nhân viên tra cứu và thu tiền qua màn tác vụ. Các màn quản trị ngoài phạm vi này (phòng chiếu, doanh thu, quản lý nhân sự) tiếp tục dùng website.

## Google OAuth 2.0 / OpenID Connect

Mobile dùng Authorization Code với PKCE (S256), `state` và `nonce`. Google mới tự tạo tài khoản **member Active**, dựa trên email đã được Google xác minh. Lần đăng nhập sau dùng cùng tài khoản, giữ điểm và lịch sử. Nếu email đã thuộc một tài khoản Cinema+ chưa liên kết Google, hệ thống yêu cầu đăng nhập bằng mật khẩu rồi vào **Tài khoản → Liên kết Google**, xác nhận bằng Google cùng email và mật khẩu Cinema+ hiện tại. Google không đăng nhập vào cổng nhân viên/admin.

1. Trong [Google Auth Platform](https://console.cloud.google.com/auth/clients), tạo/chọn client loại **Web application**. Cấu hình consent screen; nếu app ở chế độ Testing, thêm email thử nghiệm vào Test users.
2. Thêm **Authorized redirect URI** đúng tuyệt đối với callback của backend:
   - Điện thoại thật: `https://<backend-hoặc-ngrok>/api/auth/mobile/google/callback`.
   - Preview trên máy tính: `http://localhost:3000/api/auth/mobile/google/callback`.
   Không dùng IP LAN hoặc URL `exp://` làm redirect URI của Google. Với điện thoại, tunnel phải trỏ tới backend cổng 3000; tunnel Metro không thay thế tunnel API.
3. Trong `backend/.env`, giữ Client ID hiện có nếu website dùng cùng client, rồi bổ sung:

   ```env
   GOOGLE_CLIENT_ID=<web-client-id>.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=<client-secret>
   GOOGLE_MOBILE_REDIRECT_URI=https://<backend-hoặc-ngrok>/api/auth/mobile/google/callback
   ```

   Secret chỉ nằm trên backend. Website GIS vẫn chỉ cần Client ID và Authorized JavaScript origins của website; mobile code flow dùng Authorized redirect URI.
4. Trong `mobile/.env`, đặt `EXPO_PUBLIC_API_URL=https://<backend-hoặc-ngrok>/api` hoặc địa chỉ LAN của backend. Trình duyệt Google luôn mở trên origin callback để cookie xác thực khớp, kể cả khi mobile gọi API qua LAN.
5. Khởi động lại backend và Expo (`npm start -- --clear` trong `mobile`), chọn tab **Thành viên → Tiếp tục với Google**. Nếu dùng ngrok, mở URL ngrok trên điện thoại và chấp nhận trang nhắc trước khi thử.

Google mở bằng system browser để hoạt động với Expo Go. Backend nhận code, đổi và xác minh ID token; app chỉ nhận phiên Cinema+. App tự kiểm tra khi quay lại từ trình duyệt, có nút kiểm tra/hủy và khôi phục phiên chờ khi đổi màn hình hoặc mở lại app. Web preview dùng popup (cần cho phép popup). Phiên chuyển giao có secret lưu SecureStore trên native, cookie HttpOnly ràng buộc browser, TTL 5 phút và chỉ đổi lấy token một lần. JWT và Google token không nằm trong URL quay lại app. Handoff lưu trong bộ nhớ một tiến trình backend; restart backend sẽ hết phiên, triển khai nhiều instance cần shared store/sticky session.

Kiểm thử API với MongoDB tạm và Google được mô phỏng: `npm run test:mobile-google -w backend`. Tài liệu: [Google OAuth code flow](https://developers.google.com/identity/protocols/oauth2/web-server), [OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Expo WebBrowser SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/webbrowser/).

## Email

Đăng ký/quên mật khẩu dùng SMTP hiện có của backend. App không chứa SMTP password.

Đăng ký mobile gửi email chứa liên kết HTTPS `/api/auth/mobile/verify-email?token=...` trên backend công khai. Người dùng chỉ cần bấm liên kết: tài khoản tự kích hoạt và trình duyệt báo kết quả, sau đó quay lại app đăng nhập. Màn chờ chỉ hiển thị email, hướng dẫn, nút gửi lại và về đăng nhập; không nhập token. Email được gửi lại sẽ chứa liên kết mới và vô hiệu hóa liên kết trước.

Đặt `PUBLIC_API_URL=https://<backend-hoặc-ngrok>` trong `backend/.env`; nếu chưa đặt, hệ thống dùng origin của `GOOGLE_MOBILE_REDIRECT_URI` hiện có. Không dùng localhost khi thử trên điện thoại. Nếu đã nhận email cũ trỏ về website/localhost, bấm **Gửi lại email xác minh** trong app để nhận liên kết mới. Backend/ngrok cần chạy khi mở email.

Kiểm thử đăng ký, gửi lại, mở liên kết và đăng nhập bằng database tạm, không gửi email thật: `npm run test:mobile-registration -w backend`.

Liên kết xác minh của website tiếp tục hoạt động như trước. Route `/verify-email?token=...` của Expo cũng tự xác minh nếu mở app qua deep link.

Quên mật khẩu mobile gọi `/api/auth/mobile/forgot-password`. Email mới chứa liên kết HTTPS `/api/auth/mobile/reset-password?token=...`; trang này kiểm tra liên kết rồi tự mở màn `/reset-password` trong app. Form chỉ hiển thị mật khẩu mới và xác nhận mật khẩu, không nhập hay dán token. Nếu Gmail chặn chuyển app tự động, bấm **Mở ứng dụng CINEMA+** trên trang email.

Backend dùng `MOBILE_PASSWORD_RESET_APP_URL` làm đích mở app tin cậy:
- Expo Go: `exp://<IP-máy-chạy-Expo>:8081/--/reset-password` (đúng URL Metro hiện tại; giữ Expo chạy và điện thoại kết nối được máy tính).
- Bản app đã cài: `cinemaplus://reset-password`.

Đổi IP/port Metro thì cập nhật biến này và khởi động lại backend. Đích mở app được đặt trên backend, không nhận URL chuyển hướng tùy ý từ request/email. Link email chỉ kiểm tra token, chưa thay đổi mật khẩu; token chỉ được dùng khi người dùng gửi form. Link có thời hạn, dùng một lần và vô hiệu sau khi đổi mật khẩu. Chỉ thành viên đang hoạt động, có mật khẩu Cinema+ mới được gửi email; Google-only tiếp tục đăng nhập Google. Mỗi tài khoản cách nhau ít nhất 60 giây giữa hai yêu cầu gửi email.

Email cũ trỏ về `localhost` không tự đổi URL: sau khi tải lại app, yêu cầu email đặt lại mật khẩu mới. Website vẫn dùng link website như trước. Kiểm thử với database tạm và email được mô phỏng: `npm run test:mobile-password-reset -w backend`; kiểm thử SMTP và quy tắc reset: `npm run test:password-reset -w backend`. Tham khảo [Expo Go deep links](https://docs.expo.dev/linking/into-your-app/#test-a-link-using-expo-go).

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
- Sau khi chạy Expo, từ `backend` chạy `node tests/ui/test-mobile-showtimes-ui.js`: kiểm tra giao diện suất chiếu ở kích thước điện thoại qua browser preview, dùng database tạm riêng và không sửa dữ liệu app đang chạy. Có thể đặt `MOBILE_UI_URL` nếu Expo không chạy tại `http://localhost:8081`.

Các kiểm tra tự động dùng database tạm, email/Google giả lập để không gửi email hoặc sửa dữ liệu demo của nhóm. Cần kiểm tra cuối trên điện thoại: cấp/từ chối quyền camera và thư viện ảnh, giữ phiên sau đóng app, ngắt mạng khi tạo/thu tiền, VNPay thực tế và trình duyệt mở lại Expo Go. Google thực tế chờ nhóm cấu hình Client ID.
