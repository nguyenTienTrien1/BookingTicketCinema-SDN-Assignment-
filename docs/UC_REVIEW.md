# Đối chiếu 9 UC — 05/11/2026

> Đây là báo cáo **trước khi hoàn thiện**. Trạng thái triển khai mới nhất và kết quả kiểm thử nằm tại [UC_COMPLETION.md](UC_COMPLETION.md). Thanh toán được người dùng yêu cầu giữ ở chế độ giả lập, không phải VNPay thật.

Nguồn: `RDS-SWD391-Assignment.pdf`, nội dung mô tả UC và BR-2, BR-4, BR-5, BR-12, BR-13, BR-15; đối chiếu code hiện tại và các yêu cầu thay đổi của người dùng trong phiên làm việc.

## Kết luận

Có giao diện/luồng cơ bản cho cả 9 mục, nhưng chưa hoàn thành tất cả theo PDF. Thanh toán hiện là mô phỏng; VNPay chưa tích hợp. Không dùng số lượng test đạt để thay cho đánh giá độ đầy đủ yêu cầu.

| UC | Mức hiện tại | Đã có | Còn thiếu so với PDF |
| --- | --- | --- | --- |
| Book Movie Ticket / UC-6 | Một phần | Member chọn phim, suất, ghế, đồ ăn, điểm; tạo đơn và thanh toán demo; quyền sở hữu đơn | Kiểm tra tuổi/điều kiện K, T13, T16, T18 ở backend; kiểm tra suất đã bắt đầu; hủy đơn chủ động và giải phóng ghế; phát hành ticket/QR riêng cho từng ghế sau xác nhận thanh toán |
| Add Food & Drink / UC-6.1.1 | Một phần | Chọn/bỏ món trước khi tạo đơn; backend tính giá và kiểm tra số lượng nguyên dương | UI hiện gửi mỗi món quantity=1; chưa sửa đồ ăn của một đơn đang giữ ghế; chưa kiểm tra available tại backend khi nhận food ID trực tiếp; chưa có tồn kho và trừ kho khi hoàn tất; chưa lưu đơn giá từng món thành snapshot |
| Reserve Seat / UC-6.2 | Gần đủ luồng cơ bản | Giữ ghế 10 phút; chiếm đồng thời toàn bộ ghế bằng một update có điều kiện; từ chối ghế trùng hoặc đã giữ/bán; rollback khi lưu đơn lỗi | Việc dọn giữ ghế hết hạn chủ yếu chạy khi tạo đơn/thanh toán, không phải tiến trình độc lập; seat map có thể hiển thị trạng thái cũ khi xem lại; chưa có thao tác hủy/đổi lựa chọn giữ ghế đầy đủ |
| Payment Process / UC-6.3 | Mô phỏng, chưa đủ | Đánh dấu paid, bán ghế, trừ điểm, khóa chống thanh toán đồng thời, trả lại kết quả paid khi retry, bù điểm/ghế khi xử lý lỗi được kiểm soát | Chưa có bằng chứng thanh toán tin cậy, tiền tệ/giao dịch đối soát, receipt tiền mặt do nhân viên xác nhận, QR riêng từng ghế, stock/promotion finalization; nhiều collection được cập nhật bằng compensating writes, chưa phải một transaction; API pay hiện có thể được người sở hữu đơn gọi trực tiếp để tự đánh dấu paid |
| Apply Member Point / UC-6.3.1 | Đủ luồng dùng điểm đã thống nhất, chưa khớp toàn bộ PDF | Chọn/đổi/bỏ điểm; giới hạn số dư và giá trị đơn; chỉ trừ khi paid; recheck số dư, chống trừ lặp; khách vãng lai không dùng điểm | PDF yêu cầu đổi theo bội số 100, còn code chấp nhận số điểm nguyên bất kỳ. Chưa có ledger riêng cho redemption/refund; đơn 0đ vẫn đi qua mô phỏng chọn phương thức, chưa có nhánh settlement points-only riêng |
| Payment via VNPay / UC-6.3.2 | Chưa tích hợp | Nhãn phương thức vnpay và cửa sổ giả lập kết quả | Chưa có tạo URL thanh toán, chữ ký, redirect VNPay, Return/IPN, xác minh amount/currency/reference, đối soát callback lặp/muộn/không hợp lệ; truyền method=vnpay không phải xác nhận từ VNPay |
| Create Account / UC-12.1 | Một phần | Admin tạo Employee/Admin; kiểm tra email, mật khẩu; hash bcrypt; lưu createdBy; chặn role khác | PDF yêu cầu Pending Activation, lời mời kích hoạt một lần có hạn, người nhận tự đặt mật khẩu và trạng thái gửi thư. Hiện Admin nhập mật khẩu và tài khoản staff Active ngay. Đây là tạo nhân sự, khác với UC-1 đăng ký Member |
| Update Account Status / UC-12.2 | Gần đủ luồng thông thường | Admin cập nhật Active/Deactivated/Banned; chặn tự khóa; kiểm tra Admin active cuối; tăng tokenVersion khi khóa; không hủy vé đã thanh toán; lưu người cập nhật gần nhất | UI đổi dropdown là ghi ngay, chưa có bước xác nhận/hủy; API chưa nhận trạng thái cũ khách đã xem để phát hiện dữ liệu stale; chưa lưu lịch sử trước/sau đầy đủ. Kiểm tra số Admin và cập nhật nằm ở các lệnh riêng, còn nguy cơ khi nhiều Admin vô hiệu hóa lẫn nhau đồng thời |
| Adjust Member Points / UC-12.3 | Cơ bản đáp ứng | Admin-only; Member-only; delta nguyên khác 0, lý do; preview trước/sau; số dư không âm; kiểm tra balance stale; request ID chống cộng lặp; balance và audit entry cùng một atomic update; xem 20 bản ghi mới nhất | Cần tiếp tục kiểm thử nghiệm thu trên giao diện. Ledger hiện được nhúng trong User và dành cho điều chỉnh thủ công; không đại diện cho toàn bộ ledger mua hàng/đổi điểm/hoàn điểm |

## Những thay đổi đã được người dùng thống nhất

- Đăng nhập chung cho Member, Employee, Admin.
- Admin cũng bán vé tại quầy; Employee chỉ thao tác đơn của mình, Admin có quyền xử lý đơn quầy.
- Khách vãng lai không phải cung cấp tài khoản hoặc thông tin cá nhân.
- Hiện chỉ dùng điểm để giảm tiền; không thêm tích điểm tự động. Giữ quy đổi đã chọn là 1 điểm = 1.000đ. PDF BR-4 còn có tích 1 điểm/10.000đ và đổi theo bội số 100, nên cần thống nhất lại tài liệu khi nghiệm thu theo yêu cầu mới.

## Các file chứng minh

- Đặt vé/giữ ghế/điểm/thanh toán: [bookingService.js](../backend/src/services/bookingService.js).
- Trạng thái và điều chỉnh điểm: [userService.js](../backend/src/services/userService.js).
- Quầy vé và khách vãng lai: [counterController.js](../backend/src/controllers/counterController.js).
- Thanh toán mô phỏng và QR placeholder: [Payment.jsx](../frontend/src/pages/Payment/Payment.jsx).
- Tạo nhân sự: [CreateAccount.jsx](../frontend/src/pages/Admin/CreateAccount.jsx).
- Cập nhật trạng thái: [UpdateAccount.jsx](../frontend/src/pages/Admin/UpdateAccount.jsx).
- Điều chỉnh điểm: [AdjustPoints.jsx](../frontend/src/pages/Admin/AdjustPoints.jsx).

## Kiểm tra đã chạy trong lần rà soát này

- `npm test -w backend`: 59/59 đạt, dùng database test riêng.
- `npm test -w frontend`: 4/4 đạt, kiểm tra helper phân quyền và lịch chiếu Home.
- `npm run build`: thành công.

Các kiểm tra trên không bao gồm VNPay thật/sandbox hoặc nghiệm thu end-to-end toàn bộ 9 UC. Những thiếu sót trong bảng là kết quả đọc code và đối chiếu tài liệu, không phải tất cả đều đã được tái hiện bằng test mới.

## Thứ tự nên hoàn thiện

1. Xác minh thanh toán và VNPay sandbox; không cho client tự xác nhận đã thu tiền.
2. Ticket/QR riêng từng ghế, tuổi người mua, suất chiếu còn bán, hủy đơn/giải phóng giữ ghế.
3. Số lượng F&B, cập nhật món trên đơn pending, available/stock và snapshot giá.
4. Lời mời kích hoạt tài khoản staff; xác nhận và audit đầy đủ thay đổi trạng thái.
5. Thống nhất BR-4 với yêu cầu điểm đã thay đổi, hoàn thiện settlement points-only và ledger liên quan.
