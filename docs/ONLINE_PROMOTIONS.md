# Mã khuyến mãi cho đặt vé online

Thành viên chọn rạp, suất, ghế và bắp nước, sau đó chọn **Tạo đơn và chọn thanh toán**. Trang thanh toán có mục **Mã khuyến mãi** để nhập/chọn mã, **Áp dụng mã**, **Bỏ mã khuyến mãi** hoặc hủy nội dung chưa áp dụng. Tổng tiền và dòng giảm giá được cập nhật từ kết quả backend. Danh sách gợi ý dùng các chương trình đang hoạt động do Admin quản lý.

- Một mã trên mỗi đơn. Quy tắc được dùng chung cho đặt online và bán vé tại quầy.
- Mã giảm theo vé, bắp nước hoặc toàn đơn; mức tối thiểu áp dụng cho chính phần được giảm. Phần trăm làm tròn xuống VND; giới hạn mức giảm và không giảm quá giá trị phần đủ điều kiện.
- Khuyến mãi được tính trước điểm. Chỉ mã cho phép cộng dồn mới dùng cùng điểm. Với mã không cộng dồn và đơn đã dùng điểm, nút **Bỏ điểm và áp dụng mã** thực hiện hai thay đổi trong một transaction; mã không hợp lệ sẽ giữ nguyên điểm/mã đã áp dụng. Backend chỉ bỏ điểm khi người dùng chọn rõ thao tác này.
- Mã không tồn tại, chưa có hiệu lực, hết hạn, bị tắt/xóa hoặc hết lượt sẽ bị từ chối. Áp dụng lỗi không làm mất mã/giá đã chấp nhận trước đó.
- Thay đổi bắp nước hoặc điểm sẽ kiểm tra lại mã và tính lại tổng tiền. Có thể nhập mã và điểm độc lập: áp dụng mã giữ số điểm đang nhập, áp dụng điểm giữ mã đang nhập. Có **Hủy thay đổi điểm** và **Hủy thay đổi mã** riêng; không khóa chéo hai phần. Nội dung chưa lưu/chưa áp dụng phải được lưu hoặc hủy trước khi thanh toán. Số điểm để trống cũng được coi là nội dung chưa lưu.
- Chỉ chủ đơn online đang chờ thanh toán được sửa mã. Không sửa khi hết hạn, đã hủy/hoàn tất hoặc đang có giao dịch thanh toán. API kiểm tra quyền độc lập với giao diện.
- Áp dụng mã không trừ kho, điểm hoặc lượt sử dụng. Thanh toán thành công mới tăng lượt dùng cùng giao dịch với trừ kho/điểm và phát hành vé. Gửi lại callback không dùng mã hai lần; các đơn tranh lượt cuối chỉ có một đơn thắng.
- VNPay nhận tổng tiền sau khuyến mãi và điểm. Nếu tổng còn 0đ, chọn **Xác nhận đơn 0đ** để nhận vé, không mở cổng thanh toán.

API: `PATCH /api/bookings/:id/promotion`, body `{ "code": "SALE10" }`; gửi chuỗi rỗng để bỏ mã. Để chủ động thay điểm bằng mã, gửi `{ "code": "SALE10", "replacePoints": true }`; mã phải khác rỗng và `replacePoints` phải là boolean. Cờ tương tự được hỗ trợ ở API khuyến mãi tại quầy. Endpoint yêu cầu Member đang hoạt động, đơn online của chính Member, JSON và nguồn yêu cầu hợp lệ. `promotionCode` khi tạo đơn cũng được backend kiểm tra/tính giá; không nhận mức giảm hoặc tổng tiền do client tự tính.

Kiểm thử: `npm run test:online-promotions -w backend` và `npm run test:online-promotions:ui -w backend`. Dùng database tạm riêng; chuyển hướng VNPay được chặn trong trình duyệt và callback có chữ ký thử nghiệm. Không gửi thanh toán ra bên ngoài. Ảnh kiểm tra desktop/mobile ở `.local/qa/online-promotions/`.
