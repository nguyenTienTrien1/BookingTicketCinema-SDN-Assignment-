import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getBookingTickets } from '../../services/ticketService';
import { useAuth } from '../../context/AuthContext';
import { CinemaTicketHero, MovieArtwork, SeatTicket, ticketDateTime } from '../../components/CinemaTicket';
import './tickets.css';

export function ticketDate(value) {
    return ticketDateTime(value);
}

const bookingLabels = { pending: 'Đang chờ thanh toán', paid: 'Đơn đã ghi nhận thanh toán', cancelled: 'Đã hủy', 'refund-requested': 'Đang hoàn về điểm', refunded: 'Đã hoàn về điểm' };

export default function BookingTickets() {
    const { id } = useParams();
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        let refreshing = false;
        setLoading(true); setData(null); setError('');
        async function refresh() {
            if (refreshing || controller.signal.aborted || document.visibilityState === 'hidden') return;
            refreshing = true;
            try {
                const result = await getBookingTickets(id, controller.signal);
                if (!controller.signal.aborted) { setData(result); setError(''); }
            } catch (err) {
                if (!controller.signal.aborted) { setData(null); setError(err.message); }
            } finally {
                refreshing = false;
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        refresh();
        const timer = setInterval(refresh, 15000);
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            controller.abort(); clearInterval(timer);
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [id, user?._id, retry]);
    return <main className="cinemaTicketPage ticketPage" aria-busy={loading}>
        {data?.movie && <MovieArtwork movie={data.movie} className="cinemaPageBackdrop" backdrop />}
        <div className="cinemaTicketPageShell">
        <Link className="cinemaBackLink" to="/account?section=tickets">← Vé của tôi</Link>
        <header className="cinemaTicketPageHeading"><div><p className="cinemaEyebrow">VÉ CỦA TÔI / CHI TIẾT VÉ</p><h1>Vé QR theo từng ghế</h1>
            <p>Một ghế, một mã vé. Chọn đúng QR của từng người khi vào rạp.</p></div>
            <button type="button" className="cinemaActionSecondary" disabled={loading} onClick={() => setRetry((value) => value + 1)}>↻ Làm mới trạng thái</button></header>
        {loading && <p className="cinemaInlineNotice" role="status">Đang tải vé…</p>}
        {error && <div className="cinemaInlineNotice" role="alert"><p>{error}</p><button type="button" className="cinemaActionSecondary" onClick={() => setRetry((value) => value + 1)}>Thử lại</button></div>}
        {data && <>
            {data.mode === 'demo' && <p className="ticketNoticeBanner ticketDemo" role="status">VÉ MÔ PHỎNG — chỉ dùng thử chức năng, không dùng để vào rạp.</p>}
            {data.message && <div className="cinemaInlineNotice" role="status"><strong>{bookingLabels[data.bookingStatus] || 'Đơn không khả dụng'}</strong><p>{data.message}</p></div>}
            {data.showtime && <CinemaTicketHero movie={data.movie || {}} showtime={data.showtime} seats={data.tickets.map(ticket => ticket.seat)} />}
            <div className="cinemaTicketBookingMeta"><div><span>MÃ ĐẶT VÉ</span><code>{data.bookingId}</code></div>{data.window && <div><span>THỜI GIAN NHẬN KHÁCH</span><strong>{ticketDate(data.window.opensAt)} — {ticketDate(data.window.closesAt)}</strong></div>}</div>
            {data.tickets.length > 0 && <>
                <div className="cinemaSectionHeading"><div><h2>Vé điện tử <span className="cinemaTicketCount">{data.tickets.length} ghế</span></h2><p>Giữ mã QR rõ nét, tăng độ sáng màn hình khi xuất trình vé.</p></div></div>
                <div className="cinemaSeatTickets">{data.tickets.map((ticket, index) => <SeatTicket key={ticket.reference} ticket={ticket} index={index} movieTitle={data.showtime?.movieTitle} cinema={data.showtime?.cinema} room={data.showtime?.room} startTime={data.showtime?.startTime} />)}</div>
                <aside className="cinemaTicketGuide"><span aria-hidden="true">ⓘ</span><div><strong>Lưu vé để vào rạp thuận tiện hơn</strong><p>Tải QR của từng ghế về điện thoại. Mỗi vé chỉ được check-in một lần; trạng thái được cập nhật tự động khi bạn mở trang.</p></div></aside>
            </>}
        </>}
    </div></main>;
}
