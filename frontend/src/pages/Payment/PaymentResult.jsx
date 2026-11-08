import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { getBookingTickets } from '../../services/ticketService';
import { useAuth } from '../../context/AuthContext';
import { CinemaTicketHero, MovieArtwork, SeatTicket, ticketMoney } from '../../components/CinemaTicket';
import './paymentResult.css';

export default function PaymentResult() {
    const [params] = useSearchParams();
    const { user } = useAuth();
    const staff = ['admin', 'employee'].includes(user?.role);
    const reference = params.get('reference') || params.get('vnp_TxnRef');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [retry, setRetry] = useState(0);
    const [tickets, setTickets] = useState(null);
    const [ticketError, setTicketError] = useState('');

    useEffect(() => {
        setResult(null); setTickets(null); setError(''); setTicketError(''); setLoading(true);
        if (!reference) { setError('Thiếu mã giao dịch VNPay.'); setLoading(false); return; }
        const controller = new AbortController();
        let timer;
        async function refresh() {
            try {
                const data = await api((staff ? '/payments/results/' : '/bookings/payment-result/') + encodeURIComponent(reference), { signal: controller.signal });
                if (controller.signal.aborted) return;
                setError(''); setResult(data); setLoading(false);
                if (staff) setTickets(data.ticketDetails || null);
                if (data.status === 'succeeded' && data.booking.status === 'paid' && data.booking.paymentRef === reference && !staff) {
                    try {
                        const owned = await getBookingTickets(data.booking._id, controller.signal);
                        if (!controller.signal.aborted) { setTickets(owned); setTicketError(''); }
                    } catch (err) { if (!controller.signal.aborted) setTicketError(err.message); }
                }
                if (data.status === 'created' && data.booking.status === 'pending' && new Date(data.booking.expiresAt) > new Date()) timer = setTimeout(refresh, 3000);
            } catch (err) { if (!controller.signal.aborted) { setError(err.message); setLoading(false); } }
        }
        refresh();
        return () => { controller.abort(); clearTimeout(timer); };
    }, [reference, retry, staff, user?._id]);

    const booking = result?.booking;
    const paid = result?.status === 'succeeded' && booking?.status === 'paid' && booking.paymentRef === reference;
    const refund = result?.refund || booking?.refund;
    const refunded = refund?.status === 'completed' && refund.reference === reference;
    const refundPending = booking?.status === 'refund-requested';
    const expired = booking && (booking.status === 'cancelled' || (booking.status !== 'paid' && new Date(booking.expiresAt) <= new Date()));
    const state = error ? 'error' : refunded ? 'refunded' : refundPending ? 'pending' : paid ? 'success' : result?.status === 'unresolved' ? 'review' : expired ? 'expired' : result?.status === 'failed' ? 'failed' : 'pending';
    const titles = { error: 'Chưa tải được kết quả', success: 'Thanh toán thành công!', refunded: 'Đã hoàn về điểm thành viên', pending: refundPending ? 'Đang xử lý hoàn điểm' : 'Đang xác nhận thanh toán', review: 'Giao dịch cần đối soát', expired: 'Đã hết thời gian giữ ghế', failed: 'Thanh toán chưa hoàn tất' };
    const descriptions = {
        success: 'Vé của bạn đã sẵn sàng. Chúc bạn có những phút giây xem phim thật tuyệt!',
        refunded: `Khoản thanh toán đã hoàn về ${Number(refund?.points || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 })} điểm. ${booking?.status === 'paid' ? 'Vé thanh toán bằng giao dịch khác vẫn được giữ nguyên.' : 'Vé của giao dịch này không còn sử dụng được.'}`,
        pending: refundPending ? 'Không thanh toán lại trong khi hệ thống xử lý hoàn điểm.' : 'Đang chờ xác nhận từ VNPay. Vé sẽ xuất hiện sau khi máy chủ xác nhận.',
        review: 'Vui lòng liên hệ nhân viên để kiểm tra giao dịch. Không thanh toán lại.',
        expired: 'Nếu tài khoản đã bị trừ tiền, vui lòng liên hệ nhân viên để đối soát.',
        failed: 'Giao dịch không thành công hoặc đã hủy. Bạn có thể thanh toán lại trong thời hạn giữ ghế.'
    };
    const showtime = { ...booking?.showtime, ...booking?.ticketContext };
    const movie = booking?.showtime?.movie || {};
    const showTickets = paid && !refunded && !refundPending;

    return <main className="cinemaResultPage" aria-busy={loading}>
        {booking && <MovieArtwork movie={movie} className="cinemaPageBackdrop" backdrop />}
        <div className="cinemaResultShell">
            <Link className="cinemaBackLink" to={staff ? '/staff/tools' : '/account?section=tickets'}>← {staff ? 'Nghiệp vụ tại quầy' : 'Vé của tôi'}</Link>
            <header className={`cinemaResultHeader cinemaResultHeader--${state}`}>
                <div className="cinemaResultIcon" aria-hidden="true">{state === 'success' ? <svg viewBox="0 0 32 32" fill="none"><path d="m8 16 5.5 5.5L25 10" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : ['failed', 'error', 'expired'].includes(state) ? '!' : '◷'}</div>
                <p className="cinemaEyebrow">KẾT QUẢ THANH TOÁN · VNPAY</p>
                <h1>{loading ? 'Đang tải kết quả…' : titles[state]}</h1>
                <p role={error ? 'alert' : 'status'}>{error || (loading ? 'Vui lòng chờ trong giây lát.' : descriptions[state])}</p>
            </header>
            {booking && <>
                <CinemaTicketHero movie={movie} showtime={showtime} seats={booking.seats || []}>
                    <div className="cinemaResultReceipt">
                        <div><span>Mã đặt vé</span><strong className="cinemaOrderId">{booking._id}</strong></div>
                        <div><span>Phương thức</span><strong>VNPay</strong></div>
                        <div><span>{paid ? 'Đã thanh toán' : 'Giá trị đơn vé'}</span><strong className="cinemaPaidAmount">{ticketMoney(booking.total)}</strong></div>
                    </div>
                </CinemaTicketHero>
                {showTickets && <section className="cinemaResultTickets" aria-label="Vé QR của bạn">
                    <div className="cinemaSectionHeading"><div><p className="cinemaEyebrow">SẴN SÀNG CHO BUỔI CHIẾU</p><h2>Vé điện tử của bạn</h2><p>Mỗi ghế có một mã QR riêng. Bạn có thể tải mã về để tiện xuất trình tại rạp.</p></div>{!staff && <Link className="cinemaTextLink" to={`/bookings/${booking._id}/tickets`}>Chi tiết vé & check-in →</Link>}</div>
                    {ticketError && <p className="cinemaInlineNotice" role="alert">Chưa tải được mã QR: {ticketError}. Bạn có thể mở chi tiết vé hoặc kiểm tra lại trạng thái.</p>}
                    {!tickets && !ticketError && <p role="status" className="cinemaInlineNotice">Đang tải mã QR…</p>}
                    {tickets?.mode === 'demo' && <p className="cinemaInlineNotice">Vé mô phỏng — không dùng để vào rạp.</p>}
                    {tickets?.message && <p className="cinemaInlineNotice" role="status">{tickets.message}</p>}
                    <div className="cinemaSeatTickets">{tickets?.tickets?.map((ticket, index) => <SeatTicket key={ticket.reference} ticket={ticket} index={index} movieTitle={showtime.movieTitle || movie.title} cinema={showtime.cinema} room={showtime.room} startTime={showtime.startTime} />)}</div>
                    {tickets?.window && <p className="cinemaArrivalNote">Đến trước giờ chiếu khoảng {tickets.window.openBeforeMinutes} phút để nhận bắp nước và làm thủ tục vào rạp.</p>}
                </section>}
            </>}
            <div className="cinemaResultActions">
                <Link className="cinemaActionPrimary" to={staff ? '/staff/tools' : '/account?section=tickets'}>{staff ? 'Về nghiệp vụ quầy' : 'Về vé của tôi'} →</Link>
                <button type="button" className="cinemaActionSecondary" disabled={loading} onClick={() => setRetry(value => value + 1)}>Kiểm tra lại trạng thái</button>
                {!staff && <Link className="cinemaTextLink" to="/">Về trang chủ</Link>}
            </div>
        </div>
    </main>;
}
