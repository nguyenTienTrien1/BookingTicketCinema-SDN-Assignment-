import {api} from './api';
// Gọi API lấy lịch sử đặt vé của khách đang đăng nhập.
export const getBookings=(options={})=>api('/bookings',options);
// Gửi suất chiếu, ghế, bắp nước và điểm lên server để tạo đơn giữ ghế.
export const createBooking=(data)=>api('/bookings',{method:'POST',body:JSON.stringify(data)});
// Yêu cầu server cập nhật điểm dự kiến sử dụng trên đơn.
export const applyPoints=(id,data)=>api(`/bookings/${id}/points`,{method:'PATCH',body:JSON.stringify(data)});
// Gửi phương thức thanh toán; server quyết định cách xử lý và xác nhận kết quả.
export const payBooking=(id,data)=>api(`/bookings/${id}/pay`,{method:'POST',body:JSON.stringify(data)});
