# VNPay Sandbox: đã thanh toán nhưng đơn vẫn chờ xác nhận

Trong luồng chính, VNPay gọi IPN tới backend để cập nhật đơn. Return URL chuyển trình duyệt về trang kết quả. Đổi `.env` không tự đăng ký URL IPN mới trên cổng merchant, nên khi ngrok đổi địa chỉ có thể nhận Return URL mà không nhận IPN. Tham khảo [phân biệt Return và IPN của VNPay](https://sandbox.vnpayment.vn/apis/docs/faqs/).

Để thử nghiệm Sandbox với tunnel thay đổi, cấu hình:

```dotenv
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_SANDBOX_RETURN_FALLBACK=true
```

Backend có thể dùng kết quả Return đã ký làm nguồn dự phòng cho Sandbox. Nó gọi lại cùng bộ xử lý IPN, kiểm tra HMAC-SHA512, merchant, mã giao dịch, số tiền, cả mã phản hồi lẫn trạng thái giao dịch và mã giao dịch của nhà cung cấp. Chỉ dữ liệu xác minh hợp lệ mới được quyết toán; không dùng `success=true` hoặc trạng thái do frontend tự gửi. Gửi lặp Return/IPN không trừ điểm, kho, lượt mã giảm giá hoặc phát hành vé thêm lần nữa.

Nguồn dự phòng chỉ bật khi biến cấu hình bằng `true`, gateway là HTTPS với đúng hostname `sandbox.vnpayment.vn` và `NODE_ENV` khác `production`. Production vẫn dùng IPN độc lập đã đăng ký với merchant. Thanh toán xác minh được nhưng giữ ghế đã hết hạn sẽ đi qua luồng hoàn điểm hiện có, không phát hành vé hết hạn.

Khi đổi ngrok, cập nhật `VNPAY_RETURN_URL` và URL IPN tương ứng, khởi động lại backend và cập nhật IPN trên cổng merchant nếu đang dùng IPN. Giữ ngrok hoạt động trong lúc thử thanh toán. Trang kết quả chỉ hiển thị thành công khi backend đã ghi nhận `paid`; trường hợp chưa rõ kết quả cần kiểm tra giao dịch hiện tại trước khi thanh toán lại.

Kiểm thử: `npm run test:vnpay-return -w backend`. Dùng database tạm và callback có chữ ký thử nghiệm, gồm giả chữ ký, sai merchant/số tiền, thiếu mã nhà cung cấp, giới hạn Sandbox/production, thanh toán thành công không có IPN, callback lặp, callback thất bại và thanh toán sau hạn giữ ghế.
