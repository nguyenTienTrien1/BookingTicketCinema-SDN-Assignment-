import {api} from './api';
export const getUsers=()=>api('/users');
// Lấy lịch sử điều chỉnh thủ công và số dư hiện tại của thành viên.
export const getPointHistory=(id)=>api(`/users/${id}/points-history`);
// Gửi thông tin nhân sự tới API admin; mật khẩu được tạo ở server.
export const createAccount=(data)=>api('/users',{method:'POST',body:JSON.stringify(data)});
// Gửi thông tin đã sửa và phiên bản tài khoản tới API cập nhật của admin.
export const updateAccount=(id,data)=>api(`/users/${id}`,{method:'PATCH',body:JSON.stringify(data)});
// Yêu cầu gửi lại thông tin đăng nhập cho tài khoản đang chờ email.
export const resendCredentials=(id)=>api(`/users/${id}/credentials-email`,{method:'POST',body:'{}'});
export const updateStatus=(id,status,expectedStatus)=>api(`/users/${id}/status`,{method:'PATCH',body:JSON.stringify({status,expectedStatus})});
// Gửi số điểm cộng/trừ, lý do, số dư đã xem và mã yêu cầu tới API admin.
export const adjustPoints=(id,points,reason,expectedBalance,requestId)=>api(`/users/${id}/points`,{method:'PATCH',body:JSON.stringify({points,reason,expectedBalance,requestId})});
