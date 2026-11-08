import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getBookings } from '../../services/bookingService';
import { translateFoodName } from '../../utils/uiText';
import './bookingHistory.css';
import TicketRefund from './TicketRefund';
import { MovieArtwork } from '../../components/CinemaTicket';

function formatDate(value) {
    if (!value) return 'Chưa có thông tin';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Chưa có thông tin' : date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function bookingStatus(booking, now) {
    if (booking.status === 'refund-requested') return { label: 'Đang hoàn về điểm', className: 'pending' };
    if (booking.status === 'refunded') return { label: 'Đã hoàn về điểm', className: 'cancelled' };
    if (booking.status === 'paid') return { label: 'Đã thanh toán', className: 'paid' };
    if (booking.status === 'cancelled') return { label: 'Đã hủy', className: 'cancelled' };
    if (booking.status !== 'pending') return { label: 'Chưa xác định', className: 'expired' };
    const expiresAt = new Date(booking.expiresAt || 0).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return { label: 'Hết thời gian giữ ghế', className: 'expired' };
    return { label: 'Chờ thanh toán', className: 'pending' };
}

const paymentLabels = { unpaid: 'Chưa thanh toán', paid: 'Đã thanh toán', failed: 'Không thành công', 'refund-requested': 'Đang hoàn về điểm', refunded: 'Đã hoàn về điểm' };
const refundLabels = { 'refund-requested': 'Đang xử lý hoàn điểm', refunded: 'Đã hoàn về điểm' };
const methodLabels = { cash: 'Tiền mặt', vnpay: 'VNPay', momo: 'MoMo', 'credit-card': 'Thẻ ngân hàng', mock: 'Mô phỏng', demo: 'Mô phỏng', points: 'Không thu thêm tiền' };

export function BookingHistory({ memberId, onBrowseMovies, onContinuePayment, onBookAgain, onCountChange }) {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const [now, setNow] = useState(Date.now());
    const [refundNotice, setRefundNotice] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        setLoading(true);
        setError('');
        setBookings([]);
        onCountChange?.({ memberId, count: null });
        getBookings({ signal: controller.signal })
            .then((result) => {
                if (!Array.isArray(result)) throw new Error('Không thể đọc lịch sử đặt vé. Vui lòng thử lại.');
                if (active) {
                    setBookings(result);
                    onCountChange?.({ memberId, count: result.length });
                }
            })
            .catch((requestError) => {
                if (active) setError(requestError.message || 'Không thể tải lịch sử đặt vé.');
            })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; controller.abort(); };
    }, [memberId, retry, onCountChange]);

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
            {refundNotice && <p className="ticketNotice" role="status">{refundNotice}</p>}
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
                    const saved = booking.ticketContext || {};
                    const movieTitle = saved.movieTitle || movie?.title || 'Phim không còn trong danh mục';
                    const startTime = saved.startTime || showtime?.startTime;
                    const cinema = saved.cinema || showtime?.cinema;
                    const room = saved.room || showtime?.room;
                    const location = [cinema, room].filter(Boolean).join(' · ') || 'Suất chiếu không còn trong danh mục';
                    const foods = (booking.foodItems || []).map((item) =>
                        `${translateFoodName(item.name || item.food?.name || 'Món không còn trong danh mục')} × ${item.quantity ?? 'Chưa có số lượng'}`).join(', ');
                    const missingSnapshot = !saved.movieTitle || !saved.startTime || (booking.foodItems || []).some(item => !item.name);
                    const canContinue = booking.status === 'pending' && status.className === 'pending' && !booking.cashReceived && showtime && new Date(showtime.startTime).getTime() > now;
                    return <article className="myTicketCard" key={booking._id}>
                        <MovieArtwork movie={movie || {}} className="myTicketPoster" />
                        <div className="myTicketContent">
                            <div className="myTicketHeader">
                                <div><span className="ticketReference">MÃ ĐẶT VÉ · {booking._id}</span><h3>{movieTitle}</h3></div>
                                <span className={`ticketStatus ${status.className}`}>{status.label}</span>
                            </div>
                            {missingSnapshot && <p className="helperText">Đơn cũ chưa lưu đầy đủ thông tin gốc; các chi tiết còn thiếu được hiển thị theo dữ liệu hiện có.</p>}
                            {(booking.ticketMode === 'demo' || ['demo', 'mock'].includes(booking.paymentMethod)) && <p className="helperText">Đơn mô phỏng — không xác nhận vào rạp thật.</p>}
                            {booking.paymentIssue && <p className="helperText">Khoản thu cần đối soát: {booking.paymentIssue}</p>}
                            {booking.cinemaCancellation?.at && <p className="helperText">Rạp đã hủy suất: {booking.cinemaCancellation.reason}. Đơn Member được xử lý hoàn 100% về điểm; khách vãng lai không được hoàn vé.</p>}
                            {booking.refund?.reference && <p className="helperText" role="status">{booking.refund.status === 'completed' ? 'Đã hoàn' : 'Đang xử lý hoàn'} {Number(booking.refund.points || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 })} điểm · Mức {booking.refund.rate}% · Giá trị {Number(booking.refund.amount || 0).toLocaleString('vi-VN')}₫.</p>}
                            {booking.activePayment && booking.cashReceived > 0 && <p className="helperText">Đã ghi nhận tiền mặt, đang chờ hoàn tất. Không thanh toán lại.</p>}
                            <div className="myTicketDetails">
                                <p><span>Ngày đặt</span><strong>{formatDate(booking.createdAt)}</strong></p>
                                <p><span>Suất chiếu</span><strong>{formatDate(startTime)}</strong></p>
                                <p><span>Rạp / phòng</span><strong>{location}</strong></p>
                                <p><span>Ghế</span><strong>{booking.seats?.join(', ') || 'Chưa có thông tin'}</strong></p>
                                <p><span>Bắp nước</span><strong>{foods || 'Không gọi thêm'}</strong></p>
                            </div>
                            <details className="historyPaymentDetails"><summary>Chi tiết thanh toán</summary><div className="myTicketDetails">
                                <p><span>Trạng thái thanh toán</span><strong>{paymentLabels[booking.paymentStatus] || 'Chưa có thông tin'}</strong></p>
                                {refundLabels[booking.status] && <p><span>Trạng thái hoàn tiền</span><strong>{refundLabels[booking.status]}</strong></p>}
                                {booking.paymentStatus === 'paid' && <p><span>Phương thức thanh toán</span><strong>{methodLabels[booking.paymentMethod] || 'Chưa có thông tin'}</strong></p>}
                                {booking.paymentRef && <p><span>Mã giao dịch</span><strong>{booking.paymentRef}</strong></p>}
                                {booking.cashReceived != null && <><p><span>Tiền khách đưa</span><strong>{Number(booking.cashReceived).toLocaleString('vi-VN')}₫</strong></p><p><span>Tiền thừa đã trả</span><strong>{Number(booking.change || 0).toLocaleString('vi-VN')}₫</strong></p></>}
                                <p><span>Tạm tính</span><strong>{Number(booking.subtotal || 0).toLocaleString('vi-VN')}₫</strong></p>
                                <p><span>Giảm từ điểm ({booking.pointsUsed || 0} điểm)</span><strong>{Number(booking.discount || 0).toLocaleString('vi-VN')}₫</strong></p>
                                {booking.promotion && <p><span>Khuyến mãi ({booking.promotion.code})</span><strong>−{Number(booking.promotionDiscount || 0).toLocaleString('vi-VN')}₫</strong></p>}
                            </div></details>
                            <div className="myTicketFooter">
                                <div><span>Tổng tiền đơn</span><strong>{Number(booking.total || 0).toLocaleString('vi-VN')}₫</strong></div>
                                {booking.status === 'paid' && booking.paymentStatus === 'paid' && <Link className="historyLink ticketOpenLink" to={`/bookings/${booking._id}/tickets`}>Xem vé QR →</Link>}
                                {booking.status === 'paid' && booking.paymentStatus === 'paid' && !['demo','mock'].includes(booking.paymentMethod) && <TicketRefund booking={booking} onChanged={notice => { setRefundNotice(notice); setRetry(value => value + 1); }} />}
                                {canContinue && onContinuePayment && <button type="button" className="primary" onClick={() => onContinuePayment(booking)}>Thanh toán tiếp</button>}
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
