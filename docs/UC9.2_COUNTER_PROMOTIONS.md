# UC9.2 — Đồ ăn, thức uống và khuyến mãi tại quầy

## Quy tắc đã được Kim Nhã xác nhận

- Mỗi đơn tại quầy dùng tối đa một mã. Áp dụng mã khác thay thế mã cũ.
- `minOrder` xét trên phần được giảm: tổng vé cho `ticket`, tổng món cho `food`, toàn bộ tạm tính cho `all`.
- Giảm phần trăm làm tròn xuống tới đồng VND; áp dụng `maxDiscount` và không vượt phần được giảm. Mã giảm số tiền cố định cũng không vượt phần được giảm.
- Tính khuyến mãi trước, sau đó trừ điểm theo chính sách điểm hiện có. Chỉ mã `stackable=true` được dùng cùng điểm.
- Giới hạn sử dụng là số đơn hoàn tất: mỗi đơn thanh toán thành công tăng `usedCount` một lần, không theo số vé. Guest và Member đều có thể dùng mã, phù hợp model chương trình hiện có.
- Áp/bỏ mã và sửa món chỉ được thực hiện khi đơn pending, còn giữ ghế, không có giao dịch cổng thanh toán đang xử lý. Không gia hạn giữ ghế khi đổi mã/món.
- Không nhận số tiền giảm tùy ý từ client.

## Luồng giao diện

Employee/Admin tạo đơn giữ ghế tại quầy như trước. Trong màn hình xác nhận thanh toán:

1. Xem bắp nước và chọn **Đổi bắp nước** nếu cần. **Hủy chỉnh sửa** giữ nguyên đơn đã lưu.
2. Nhập hoặc chọn gợi ý **Mã khuyến mãi**, chọn **Áp dụng mã**.
3. Xem tên chương trình, mức giảm, phạm vi, điều kiện tối thiểu, khả năng kết hợp điểm và tổng tiền mới.
4. **Bỏ mã khuyến mãi** loại mã khỏi đơn; **Hủy thay đổi mã** bỏ phần nhập chưa áp dụng.
5. Nhập/áp dụng điểm nếu mã cho phép; xác nhận lại số tiền khách đưa khi tổng tiền thay đổi.
6. Hoàn tất thanh toán theo luồng cũ. Đơn 0đ dùng luồng zero-amount hiện có và không yêu cầu thu tiền hoặc tự trừ thêm điểm.

Đơn đã thanh toán giữ thông tin chương trình tại thời điểm xác nhận. Member xem được mã và số tiền giảm trong tài khoản/lịch sử. Mã sau đó bị sửa/xóa không làm thay đổi lịch sử đơn đã hoàn tất.

## API và dữ liệu

- `PATCH /api/counter/bookings/:id/promotion` với JSON `{ "code": "FOOD10" }`; dùng `{ "code": "" }` để bỏ mã.
- Chỉ Employee sở hữu đơn tại quầy hoặc Admin được chỉnh mã. Member, người chưa đăng nhập và Employee khác bị từ chối. Endpoint kiểm tra JSON và Origin.
- API tạo đơn tại quầy cũng nhận `promotionCode` tùy chọn; UI hiện áp dụng mã sau khi đã tạo đơn giữ ghế.
- Mã gợi ý dùng API danh mục `GET /api/promotions` hiện có. Danh sách gợi ý không bảo đảm mã hợp lệ với mọi đơn; server kiểm tra theo giỏ hàng thực tế.
- `Booking.promotion` lưu ID/code/name, điều kiện, số tiền đủ điều kiện, số tiền giảm, chữ ký quy tắc và phiên bản chính sách `counter-v1`.
- `Booking.promotionDiscount` là tiền giảm từ chương trình. **`Booking.discount` tiếp tục là tiền giảm từ điểm**, giữ tương thích với code của nhóm.
- `total = subtotal - promotionDiscount - discount`.

## Đồng thời và hoàn tất thanh toán

- Áp mã không giữ lượt sử dụng và không trừ tồn kho. Hai đơn có thể cùng được báo giá khi mã còn một lượt.
- Trong cùng transaction với điểm/kho/ghế/vé/thanh toán, server kiểm tra lại tình trạng mã, ngày hiệu lực, giới hạn, điều kiện đơn và quy tắc đã xác nhận.
- Thanh toán tăng `Promotion.usedCount` và `__v` cùng nhau. Form quản lý mã cũ phải tải lại khi phiên bản đã thay đổi, tránh ghi đè lượt sử dụng.
- Hai đơn tranh lượt cuối chỉ có một đơn được hoàn tất. Lỗi ghi nhận thanh toán hoàn tác cả lượt dùng, kho, điểm và vé.
- Gọi lại thanh toán cho đơn đã paid trả kết quả cũ, không trừ mã/kho/điểm hoặc phát hành vé thêm.
- Nếu điều kiện chương trình đã thay đổi, không tự đổi tiền thu khi thanh toán. Nhân viên cần **Kiểm tra lại mã** hoặc bỏ mã, xem tổng tiền mới rồi xác nhận lại.
- Sửa số lượng món tính lại khuyến mãi. Nếu không còn đạt mức tối thiểu, server từ chối toàn bộ lần sửa và giữ đơn cũ.

Đây là phần tích hợp UC9.2 vào transaction thanh toán hiện có. Không đổi phương thức thanh toán, chính sách giá ghế hoặc nguồn dữ liệu báo cáo doanh thu của các UC khác. Luồng bán bắp nước riêng không tự áp mã của đơn vé tại quầy.

## Kiểm tra

Chạy với MongoDB replica set, dùng database tạm riêng cho từng bộ kiểm thử:

```powershell
npm run test:counter-promotions -w backend
npm run test:counter-promotions:ui -w backend
npm test -w backend
npm test -w frontend
npm run build
```

Kiểm thử API bao gồm phân quyền, scoped minimum, làm tròn, mức trần, kết hợp điểm, sửa món, thay đổi chương trình, lượt cuối đồng thời, retry thanh toán, lỗi lưu và đơn 0đ. Kiểm thử trình duyệt dùng UI/API/database thực cho đơn Member/Guest, giữ thông tin mã trong lịch sử, điều kiện mã hết hạn trước khi thu tiền và giao diện mobile. Ảnh nằm tại `.local/qa/uc92/`.
