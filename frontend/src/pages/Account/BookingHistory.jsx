import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getBookings } from '../../services/bookingService';
import { translateFoodName } from '../../utils/uiText';
import './bookingHistory.css';

function formatDate(value) {
    if (!value) return 'Chưa có thông tin';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Chưa có thông tin' : date.toLocaleString('vi-VN');
}

function bookingStatus(booking, now) {
    if (booking.status === 'paid') return { label: 'Đã thanh toán', className: 'paid' };
    if (booking.status === 'cancelled') return { label: 'Đã hủy', className: 'cancelled' };
    if (booking.status !== 'pending') return { label: 'Chưa xác định', className: 'expired' };
    const expiresAt = new Date(booking.expiresAt || 0).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return { label: 'Hết thời gian giữ ghế', className: 'expired' };
    return { label: 'Chờ thanh toán', className: 'pending' };
}

const paymentLabels = { unpaid: 'Chưa thanh toán', paid: 'Đã thanh toán', failed: 'Không thành công' };
const methodLabels = { cash: 'Tiền mặt', vnpay: 'VNPay', momo: 'MoMo', 'credit-card': 'Thẻ ngân hàng', mock: 'Mô phỏng', demo: 'Mô phỏng', points: 'Không thu thêm tiền' };

export function BookingHistory({ memberId, onBrowseMovies, onContinuePayment, onBookAgain }) {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        setLoading(true);
        setError('');
        setBookings([]);
        getBookings({ signal: controller.signal })
            .then((result) => {
                if (!Array.isArray(result)) throw new Error('Không thể đọc lịch sử đặt vé. Vui lòng thử lại.');
                if (active) setBookings(result);
            })
            .catch((requestError) => {
                if (active) setError(requestError.message || 'Không thể tải lịch sử đặt vé.');
            })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; controller.abort(); };
    }, [memberId, retry]);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <section className="bookingHistory" aria-label="Lịch sử đặt vé" aria-busy={loading}>
            <div className="historyHeading">
                <div><h2>Lịch sử đặt vé</h2><p>Các đơn đặt vé mới nhất được hiển thị trước, bao gồm cả đơn đã hủy.</p></div>
                <button type="button" className="ghost" disabled={loading} onClick={() => setRetry((value) => value + 1)}>Làm mới</button>
            </div>
            {loading && <p className="ticketNotice" role="status">Đang tải lịch sử đặt vé…</p>}
            {error && <div className="ticketNotice ticketNoticeError" role="alert">
                <p>{error}</p><button type="button" className="ghost" onClick={() => setRetry((value) => value + 1)}>Thử lại</button>
            </div>}
            {!loading && !error && bookings.length === 0 && <div className="accountEmpty">
                <h3>Bạn chưa có đơn đặt vé nào</h3><p>Lịch sử sẽ xuất hiện sau khi bạn tạo đơn đặt vé.</p>
                {onBrowseMovies ? <button type="button" className="primary" onClick={onBrowseMovies}>Khám phá phim</button>
                    : <Link className="historyLink" to="/">Khám phá phim</Link>}
            </div>}
            {!loading && !error && bookings.length > 0 && <p className="historyCount" role="status">{bookings.length} đơn đặt vé</p>}
            <div className="myTicketsSection">
                {bookings.map((booking) => {
                    const status = bookingStatus(booking, now);
                    const showtime = booking.showtime;
                    const movie = showtime?.movie;
                    const foods = (booking.foodItems || []).map((item) =>
                        `${translateFoodName(item.food?.name || 'Món không còn trong danh mục')} × ${item.quantity || 1}`).join(', ');
                    return <article className="myTicketCard" key={booking._id}>
                        <div className="myTicketPoster" aria-hidden="true"><span>{movie?.title || 'CINEMA+'}</span></div>
                        <div className="myTicketContent">
                            <div className="myTicketHeader">
                                <div><span className="ticketReference">MÃ ĐẶT VÉ · {booking._id}</span><h3>{movie?.title || 'Phim không còn trong danh mục'}</h3></div>
                                <span className={`ticketStatus ${status.className}`}>{status.label}</span>
                            </div>
                            <div className="myTicketDetails">
                                <p><span>Ngày đặt</span><strong>{formatDate(booking.createdAt)}</strong></p>
                                <p><span>Suất chiếu</span><strong>{formatDate(showtime?.startTime)}</strong></p>
                                <p><span>Rạp / phòng</span><strong>{showtime ? `${showtime.cinema} · ${showtime.room}` : 'Suất chiếu không còn trong danh mục'}</strong></p>
                                <p><span>Ghế</span><strong>{booking.seats?.join(', ') || 'Chưa có thông tin'}</strong></p>
                                <p><span>Bắp nước</span><strong>{foods || 'Không gọi thêm'}</strong></p>
                                <p><span>Trạng thái thanh toán</span><strong>{paymentLabels[booking.paymentStatus] || 'Chưa có thông tin'}</strong></p>
                                {booking.paymentStatus === 'paid' && <p><span>Phương thức thanh toán</span><strong>{methodLabels[booking.paymentMethod] || 'Chưa có thông tin'}</strong></p>}
                                {booking.paymentRef && <p><span>Mã giao dịch</span><strong>{booking.paymentRef}</strong></p>}
                                <p><span>Tạm tính</span><strong>{Number(booking.subtotal || 0).toLocaleString('vi-VN')}₫</strong></p>
                                <p><span>Giảm từ điểm ({booking.pointsUsed || 0} điểm)</span><strong>{Number(booking.discount || 0).toLocaleString('vi-VN')}₫</strong></p>
                                {booking.promotion && <p><span>Khuyến mãi ({booking.promotion.code})</span><strong>−{Number(booking.promotionDiscount || 0).toLocaleString('vi-VN')}₫</strong></p>}
                            </div>
                            <div className="myTicketFooter">
                                <div><span>Tổng tiền đơn</span><strong>{Number(booking.total || 0).toLocaleString('vi-VN')}₫</strong></div>
                                {booking.status === 'paid' && <Link className="historyLink" to={`/bookings/${booking._id}/tickets`}>Xem vé QR</Link>}
                                {status.className === 'pending' && onContinuePayment && <button type="button" className="primary" onClick={() => onContinuePayment(booking)}>Thanh toán tiếp</button>}
                                {status.className === 'expired' && booking.status === 'pending' && onBookAgain && <button type="button" className="ghost" onClick={onBookAgain}>Đặt lại vé</button>}
                            </div>
                        </div>
                    </article>;
                })}
            </div>
        </section>
    );
}

export default function BookingHistoryPage() {
    const { user } = useAuth();
    return <main className="page accountPage historyPage">
        <Link className="historyLink" to="/dashboard">← Bảng điều khiển thành viên</Link>
        <BookingHistory key={user._id} memberId={user._id} />
    </main>;
}
