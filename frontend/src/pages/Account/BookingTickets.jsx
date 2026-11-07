import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getBookingTickets } from '../../services/ticketService';
import { useAuth } from '../../context/AuthContext';
import '../Admin/movies.css';
import './tickets.css';

export function ticketDate(value) {
    if (!value) return 'Chưa có thông tin';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Chưa có thông tin' : date.toLocaleString('vi-VN');
}

const statusLabels = { issued: 'Chưa sử dụng', 'checked-in': 'Đã check-in', expired: 'Hết giờ nhận khách', revoked: 'Đã thu hồi' };
const bookingLabels = { pending: 'Đang chờ thanh toán', paid: 'Đơn đã ghi nhận thanh toán', cancelled: 'Đã hủy', 'refund-requested': 'Đang yêu cầu hoàn tiền', refunded: 'Đã hoàn tiền' };

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
    return <main className="movieAdmin ticketPage" aria-busy={loading}><div className="movieAdminShell">
        <Link className="movieBack" to="/bookings">← Lịch sử đặt vé</Link>
        <header className="movieAdminHeading"><div><p className="movieEyebrow">VÉ CỦA TÔI</p><h1>Vé QR theo từng ghế</h1>
            <p>Mỗi ghế có một mã riêng. Nhân viên kiểm tra trạng thái trực tiếp khi soát vé.</p></div>
            <button type="button" className="movieSecondary" disabled={loading} onClick={() => setRetry((value) => value + 1)}>Làm mới trạng thái</button></header>
        {loading && <p className="moviePanel movieState" role="status">Đang tải vé…</p>}
        {error && <div className="movieError" role="alert"><p>{error}</p><button type="button" className="movieSecondary" onClick={() => setRetry((value) => value + 1)}>Thử lại</button></div>}
        {data && <>
            <p className="ticketCode">Mã đặt vé: {data.bookingId}</p>
            {data.mode === 'demo' && <p className="ticketNoticeBanner ticketDemo" role="status">VÉ MÔ PHỎNG — chỉ dùng thử chức năng, không dùng để vào rạp.</p>}
            {data.message && <div className="moviePanel movieState" role="status"><strong>{bookingLabels[data.bookingStatus] || 'Đơn không khả dụng'}</strong><p>{data.message}</p></div>}
            {data.showtime && <section className="moviePanel ticketSummary" aria-label="Thông tin suất chiếu">
                <h2>{data.showtime.movieTitle}</h2><p>{data.showtime.cinema} · {data.showtime.room}</p>
                <p>Giờ chiếu: <strong>{ticketDate(data.showtime.startTime)}</strong></p>
                {data.window && <p>Nhận khách: {ticketDate(data.window.opensAt)} — {ticketDate(data.window.closesAt)}</p>}
            </section>}
            <div className="ticketGrid">{data.tickets.map((ticket) => <article className="moviePanel issuedTicket" key={ticket.reference}>
                <div className="issuedTicketHeading"><h2>Ghế {ticket.seat}</h2><span>{statusLabels[ticket.status] || 'Không khả dụng'}</span></div>
                {ticket.qrDataUrl ? <img className="issuedTicketQr" src={ticket.qrDataUrl} width="264" height="264" alt={`QR vé ghế ${ticket.seat}`} />
                    : <p className="ticketNoQr">QR không còn khả dụng cho vé này.</p>}
                <p className="ticketCode">{ticket.reference}</p>
                {ticket.checkedInAt && <p>Đã check-in lúc {ticketDate(ticket.checkedInAt)}</p>}
                {ticket.qrDataUrl && <a className="movieSecondary" href={ticket.qrDataUrl} download={`ve-${ticket.seat}.png`}>Tải ảnh QR</a>}
            </article>)}</div>
        </>}
    </div></main>;
}
