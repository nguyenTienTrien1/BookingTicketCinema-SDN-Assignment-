# Cinema+ — Google Sign-In và tài khoản nhiều phương thức đăng nhập

## Quy tắc và phạm vi

Đã đọc và áp dụng `SDN302_AI_Coding_Rules.md`, skill `.agents/skills/ui-ux-pro-max/SKILL.md`, source Auth/Profile và UC-18, UC-19, BR-1, BR-7, BR-11 trong `docs/extracted_text.txt`.

Giữ JavaScript, Express Route → Controller → Service → Mongoose, React/AuthContext và JWT Cinema+ trong HttpOnly Cookie. UI kế thừa Login/Profile; chỉ bổ sung nút Google chính thức và phần Bảo mật. Công cụ tìm kiếm Python của skill chưa chạy được trên máy này; áp dụng hướng dẫn trực tiếp trong SKILL.md (label, password manager/paste, focus, trạng thái tải/lỗi và bố cục responsive).

## Dữ liệu

- Giữ một collection `users`, một `_id` cho Google và mật khẩu Cinema+.
- Thêm `googleId` (ẩn khỏi truy vấn mặc định), `googleEmail` đã xác minh.
- `googleId` có partial unique index cho giá trị chuỗi; nhiều tài khoản local không có Google ID vẫn hợp lệ. Unique email và chuẩn hóa chữ thường giữ nguyên.
- Google-only không có mật khẩu ngẫu nhiên. Mật khẩu bắt buộc khi tạo tài khoản local; bcrypt hook bỏ qua mật khẩu không tồn tại.
- Không lưu mảng providers dễ bị lệch trên tài khoản cũ. API hồ sơ suy ra `loginMethods: { google, local, googleEmail }` từ dữ liệu thực tế.
- Khởi động backend chờ User indexes sẵn sàng. Không chạy `syncIndexes`, không xóa index hoặc đổi dữ liệu tài khoản cũ.

## Backend và API

File mới: `src/services/auth/googleAuthService.js`, `src/controllers/auth/googleAuthController.js`, `test_google_auth.js`, `scripts/test-google-auth-ui.js` trong `backend/`.

File sửa: `models/User.js`, `config/db.js`, `services/auth/loginService.js`, `services/auth/passwordResetService.js`, `services/profileService.js`, `controllers/auth/loginController.js`, `routes/auth/authRoutes.js`, `.env.example`, `package.json` và lockfile workspace.

| API | Quyền / nội dung |
| --- | --- |
| `POST /api/auth/google/challenge` | Public, JSON `{ purpose: "login" }`, trả nonce + Web Client ID công khai của process đang chạy và đặt cookie challenge HttpOnly 5 phút |
| `POST /api/auth/google/reauth-challenge` | Member đã đăng nhập, `{ purpose: "set-password" }` hoặc `"link-google"` |
| `POST /api/auth/google` | `{ credential }`, ID Token chứa nonce của challenge login |
| `POST /api/auth/set-password` | Member Google-only, `{ credential, newPassword, confirmPassword }`, nonce của challenge đặt mật khẩu |
| `POST /api/auth/link-google` | Member local, `{ credential, currentPassword }`, nonce của challenge liên kết |
| `GET /api/users/me` | Bổ sung `loginMethods` an toàn cho hồ sơ của chính người dùng |

Google ID Token được xác minh bằng `google-auth-library`: chữ ký, audience, issuer, expiry, subject, email đã xác minh và nonce. Token phải được cấp trong vòng 5 phút; thời điểm cấp phía Google được phép đi trước đồng hồ local tối đa 300 giây, nhất quán với dung sai của thư viện Google. Challenge có chữ ký, ràng buộc cookie trình duyệt, thao tác và Member đang đăng nhập. Google token chỉ dùng trong bộ nhớ lúc gọi API, không lưu localStorage và không dùng làm JWT Cinema+.

Tài khoản mới từ Google là Member Active vì Google đã xác minh email. Tài khoản có sẵn luôn giữ nguyên role/status; email trùng tài khoản local yêu cầu đăng nhập local rồi liên kết, không tự merge. Google login tra theo `sub` đã liên kết và kiểm tra status/BR-7. Link luôn xác minh mật khẩu local qua cùng Auth Service để tránh bỏ qua khóa sau 5 lần sai. Google email phải trùng email Cinema+ khi liên kết.

Set Password dùng bcrypt cost 10 rồi cập nhật có điều kiện trên document hiện tại, hash đúng một lần. Set Password và Link Google tăng `tokenVersion`, hết hạn mọi phiên cũ, yêu cầu đăng nhập lại. Các cập nhật kiểm tra lại trạng thái, khóa, version và provider/mật khẩu ngay tại MongoDB. Duplicate-key và các request đồng thời được xử lý an toàn. Không hỗ trợ Unlink trong phiên bản này.

Các endpoint mới có rate limit theo IP socket, JSON và kiểm tra Origin/Fetch Metadata theo cơ chế Profile hiện có; không log credential/hash/password. Rate limiter hiện dùng bộ nhớ của một Node process, theo giới hạn hạ tầng hiện tại.

Forgot Password chỉ bổ sung điều kiện tài khoản phải có local password cho cả cấp lẫn sử dụng reset token. Google-only và email không tồn tại nhận cùng generic response. Quy trình UC-19, token single-use và thu hồi JWT vẫn giữ nguyên.

## Frontend

File mới: `components/auth/GoogleSignIn.jsx`, `components/auth/AccountSecurity.jsx`, `styles/auth/googleSignIn.css`, `.env.example` trong `frontend/`.

File sửa: `components/auth/LoginForm.jsx`, `components/auth/RegisterForm.jsx` (bổ sung import `useEffect` bị thiếu), `context/AuthContext.jsx`, `services/auth/authService.js`, `pages/Account/Profile.jsx`, `pages/Account/profile.css`, `package.json`.

`@react-oauth/google` hiển thị nút Google Identity Services, không tự vẽ lại logo hoặc gọi OAuth access-token flow. Không dùng One Tap/auto-select. Challenge tự làm mới sau 4 phút. Có xử lý thiếu cấu hình, lỗi tải Google script, lỗi API, đang xác thực và thử lại. Profile dùng các trường mật khẩu có label/autocomplete; xác nhận sai không cho bắt đầu Google reauthentication.

## Cấu hình Google Cloud

1. Mở Google Cloud Console → Google Auth Platform; chọn/tạo project, thiết lập Branding, Audience và test users nếu ứng dụng đang ở Testing. Chỉ dùng thông tin danh tính cơ bản, không yêu cầu quyền Gmail/Drive.
2. Clients → Create client → **Web application**.
3. Thêm Authorized JavaScript origins: `http://localhost`, `http://localhost:5173` và origin HTTPS thật khi triển khai. Origin gồm protocol + hostname + port, không có path. Nếu Vite chạy cổng khác thì thêm đúng origin đó.
4. Luồng hiện tại dùng popup với JavaScript callback, không cần thêm redirect URI cho callback backend.
5. Điền **cùng một Web Client ID** vào hai file môi trường:

```dotenv
# backend/.env
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com

# frontend/.env.local
VITE_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

6. Khởi động lại backend và Vite. `CORS_ORIGIN` phải trùng origin frontend. Giữ JWT_SECRET riêng, không commit `.env` hoặc credentials. Luồng này không cần Google Client Secret.
7. Production dùng HTTPS và `NODE_ENV=production` để cookie có Secure. Nếu reverse proxy áp dụng CSP/COOP, cấu hình cho GIS theo tài liệu chính thức.

Tài liệu chính thức đã đối chiếu:

- [Google GIS setup và Authorized JavaScript origins](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- [Xác minh Google ID Token phía server](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- [GIS JavaScript API và nonce](https://developers.google.com/identity/gsi/web/reference/js-reference)

### Lỗi Google `401: invalid_client` / `no registered origin`

Đây là bước đăng ký origin tại Google Cloud. Thêm Client ID vào `.env` chưa tự cấp quyền cho địa chỉ website.

1. Vào [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients), chọn đúng project và OAuth Client có Client ID trùng hai file môi trường. Client phải có Application type **Web application**; nếu đã tạo loại Desktop/Android thì tạo Web client và cập nhật cả hai biến môi trường.
2. Trong **Authorized JavaScript origins**, thêm `http://localhost` và `http://localhost:5173`, rồi Save. Không thêm `/login` hoặc path khác vào origin. Ô Authorized redirect URIs là mục riêng và không thay thế mục origins trong luồng JavaScript popup này.
3. Mở ứng dụng tại `http://localhost:5173/login`, tải lại trang và thử lại Google. Nếu dùng cổng khác, hostname `127.0.0.1` hoặc một địa chỉ HTTPS public, đăng ký đúng origin đang hiển thị trên thanh địa chỉ thay vì mặc định coi đó là localhost.
4. Nếu đã tạo Web client mới, khởi động lại frontend/backend để hai phía nạp cùng Client ID mới. Không cần Client Secret cho luồng này.

Nút hiện dùng các tùy chọn GIS chính thức: theme `outline_dark`, text `signin_with`, locale `vi`, chiều rộng theo container (tối đa 400px). Container dùng `color-scheme: normal` để Chromium không vẽ nền trắng quanh iframe có trang nền trong suốt. Card đăng nhập giới hạn 480px, padding responsive để nút Google và các input/nút đăng nhập có cùng chiều rộng. Không chỉnh DOM bên trong nút hoặc vẽ nút che lên GIS.

### Google đã trả token nhưng ứng dụng báo xác thực không hợp lệ

- Sau khi đổi `GOOGLE_CLIENT_ID`, khởi động lại backend; process Node đang chạy không tự đọc lại `.env` chỉ vì file đó đã đổi. Vite cũng phải nạp lại biến `VITE_GOOGLE_CLIENT_ID` khi đổi frontend config.
- Frontend so sánh Client ID cấu hình của mình với Client ID công khai trong response challenge của backend đang chạy. Nếu không khớp, hiện một thông báo cấu hình chưa đồng bộ và không mở Google popup.
- Khi token bị từ chối, server chỉ log mã chẩn đoán cố định như `AUDIENCE_MISMATCH`, `TOKEN_EXPIRED`, `TOKEN_NOT_YET_VALID`, hoặc các cờ kiểm tra nonce/thời hạn. Không log token, payload, email hay Google subject từ lỗi Google library.
- Lỗi trong flow Google chỉ hiển thị một lần tại phần Google, cùng nút thử lại. Không lặp cùng thông báo ở AuthContext và GoogleSignIn.
- Đã tái hiện lỗi đồng hồ: lúc kiểm tra, Google đi trước máy local khoảng 39 giây; kiểm tra cũ `iat > now + 30` từ chối token dù Google library xác minh thành công. Đã sửa dung sai phía tương lai thành 300 giây, cùng chuẩn với `google-auth-library`. Bài kiểm thử RSA thực chấp nhận sai lệch +60/+240 giây và từ chối +360 giây; vẫn từ chối sai audience, signature, nonce, email chưa xác minh và token hết hạn.

## Kiểm thử và dữ liệu thật

```powershell
npm run test:google-auth -w backend
npm run test:google-auth:ui -w backend
npm run test:password-reset -w backend
npm run test:profile -w backend
npm test -w frontend
npm run build
```

- API multi-provider: **25/25** kiểm thử, dùng MongoDB thật với database test tên UUID riêng. Bao gồm concurrency (kể cả dữ liệu thay đổi giữa hai lần lookup), cùng Member ID, points/booking references, reauthentication, reset, nonce, sai password, role/status, lockout, lỗi ghi DB và migration mật khẩu local cũ.
- Bài kiểm thử cuối chạy `google-auth-library` thật với cặp RSA/certificates test để kiểm tra chữ ký, audience và expiry; các bài còn lại dùng controlled verification double.
- Sau bản sửa lệch đồng hồ: **25/25 API**, **5/5 UI**, production build thành công. Ban đầu phải chạy các database test tên riêng trên MongoDB workspace ở ổ D vì MongoDB cấu hình ở ổ C báo `OutOfDiskSpace` khi chỉ còn khoảng 257 MB. Sau khi người dùng giải phóng ổ C, đã xác nhận khoảng **2011 MB trống** và chạy lại thành công **25/25 API, 5/5 UI trên chính MongoDB qua cấu hình dự án**, vẫn dùng database test UUID riêng. Không thay đổi `.env` hoặc tài khoản thật. Backend và Google challenge trả 200; Client ID runtime khớp frontend. GIS thật hiển thị nút và không ghi nhận lỗi cấu hình Client ID/origin trong lần kiểm tra lại. Lỗi thiếu dung lượng trước đó đã được gỡ.
- Forgot Password hiện có: **22/22**, MongoDB thật và SMTP receiver local, không gửi thư đến tài khoản thật.
- Profile: **12/12**; frontend hiện có: **4/4**; production build thành công (còn cảnh báo kích thước bundle trên 500 kB).
- UI: **5/5**, Playwright Chromium, React → Express → MongoDB thật; GIS script và xác minh Google được giả lập có kiểm soát, không phải Google OAuth thật. Kiểm tra Login, Register, Forgot Password, Set Password, linking, đăng nhập local, refresh, thiếu Client ID, Client ID frontend/backend không khớp và thông báo lỗi không bị lặp; desktop 1440×900, mobile 375×812, landscape 812×375. Ảnh QA nằm ở `.local/google-auth-ui/` (không commit).
- Có kiểm thử API và trình duyệt khi cả frontend/backend không có Google Client ID: thông báo chưa cấu hình xuất hiện, đăng nhập email/mật khẩu và khôi phục phiên sau refresh vẫn hoạt động. Hai file `.env.example` để Client ID trống và hướng dẫn cấu hình, không chứa credentials giả.
- Đã xác nhận unique `email_1` và partial unique `googleId_1` trong database đang cấu hình; không chỉnh sửa tài khoản thật. Test persistence ngắt rồi kết nối lại MongoDB và đọc lại provider/hash/Member ID.
- Toàn bộ backend: **225/225**, trên replica set MongoDB tạm riêng bằng binary MongoDB có sẵn; chỉ bật payment simulation trong process test. Replica set đã tắt sau khi chạy. Cấu hình MongoDB hiện tại là standalone nên các test transaction cần môi trường replica set; không đổi cấu hình database đang sử dụng.
- `git diff --check` không có lỗi whitespace. `npm audit --omit=dev` còn báo hai dependency gián tiếp có advisory (`body-parser`: high, `qs`: moderate); chưa thay đổi các dependency Express ngoài phạm vi task này.

**Cập nhật cấu hình:** người dùng đã thêm Web Client ID vào `backend/.env`; đã cấu hình cùng giá trị vào `frontend/.env.local` (file được Git bỏ qua). Đã nạp lại backend sau khi sửa `.env`, xác nhận response challenge thật trả 200 với Client ID khớp cấu hình frontend/Vite. Nút Google Identity Services thật đã xuất hiện trên trang Login. Không ghi Client ID thật hoặc secrets vào source/tài liệu.

**Giới hạn xác minh:** chưa xác nhận end-to-end với tài khoản Google và ID Token do Google phát hành. Không coi nút Google xuất hiện hoặc token/certificates test là bằng chứng Google OAuth thật đã thành công. Refresh và kết nối DB lại đã kiểm thử; chưa thực hiện restart toàn bộ dịch vụ production.

## Demo sau khi cấu hình Client ID

1. Dùng tài khoản Google test chưa có Cinema+ → Login → Tiếp tục với Google. Mở Tài khoản → Hồ sơ, ghi lại `_id` qua Network response; Google đã liên kết, mật khẩu chưa thiết lập.
2. Bảo mật → Đặt mật khẩu → nhập/xác nhận → xác thực lại cùng Google. Sau thành công, đăng nhập bằng email/mật khẩu vừa tạo và kiểm tra cùng `_id`.
3. Đăng xuất, đăng nhập lại Google; kiểm tra profile, điểm và booking history không thay đổi.
4. Với tài khoản local có sẵn: thử Google cùng email để thấy hướng dẫn liên kết → đăng nhập local → Hồ sơ → Liên kết Google → nhập mật khẩu hiện tại → chọn Google cùng email. Sau đó thử cả hai cách đăng nhập.
5. Kiểm tra Forgot Password cho tài khoản đã có mật khẩu local; Google login vẫn hoạt động sau reset. Google-only phải đăng nhập Google rồi Đặt mật khẩu.

**Tiêu chí dữ liệu:** một Member `_id`, hai cách đăng nhập, cùng hồ sơ/điểm và lịch sử đặt vé. Không cần migration dữ liệu Member hoặc collection riêng cho Google.
