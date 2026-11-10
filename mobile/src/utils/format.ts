export const money = (value = 0) => value.toLocaleString('vi-VN') + ' ₫';
export const when = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
export const statusText = (value: string) => ({ pending: 'Chờ thanh toán', paid: 'Đã thanh toán', cancelled: 'Đã hủy', expired: 'Hết hạn', refunded: 'Đã hoàn tiền', 'refund-requested':'Đang xử lý hoàn điểm' }[value] || value);
