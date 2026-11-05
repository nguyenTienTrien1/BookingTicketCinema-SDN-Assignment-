import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCheckInShowtimes, lookupTicket, checkInTicket } from '../../services/ticketService';
import QrScanner from '../../components/QrScanner';
import { ticketDate } from '../Account/BookingTickets';
import '../Admin/movies.css';
import '../Account/tickets.css';

export default function TicketCheckIn() {
    const [showtimes, setShowtimes] = useState([]);
    const [showtimeId, setShowtimeId] = useState('');
    const [reference, setReference] = useState('');
    const [loading, setLoading] = useState(true);
    const [lookingUp, setLookingUp] = useState(false);
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState(null);
    const [ageVerified, setAgeVerified] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [retry, setRetry] = useState(0);
    const request = useRef(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError(''); setPreview(null); setSuccess(''); setShowtimeId('');
        getCheckInShowtimes(controller.signal).then((data) => { if (!controller.signal.aborted) setShowtimes(data.showtimes); })
            .catch((err) => { if (!controller.signal.aborted) setError(err.message); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [retry]);
    useEffect(() => () => request.current?.abort(), []);

    function clearPreview() {
        request.current?.abort(); setLookingUp(false); setPreview(null); setSuccess(''); setError(''); setAgeVerified(false);
    }
    async function lookup(value = reference) {
        clearPreview();
        if (!showtimeId) { setError('Vui lòng chọn suất chiếu đang soát vé.'); return; }
        if (!value.trim()) { setError('Vui lòng nhập hoặc quét mã vé.'); return; }
        const controller = new AbortController(); request.current = controller;
        setLookingUp(true);
        try { const data = await lookupTicket(value.trim(), showtimeId, controller.signal); if (!controller.signal.aborted) setPreview(data); }
        catch (err) { if (!controller.signal.aborted) setError(err.message); }
        finally { if (!controller.signal.aborted) setLookingUp(false); }
    }
    async function confirm() {
        if (!preview?.eligible || saving) return;
        setSaving(true); setError(''); setSuccess('');
        try {
            const result = await checkInTicket(preview.reference, { showtimeId, ageVerified });
            setPreview(result); setSuccess(result.message);
        } catch (err) { setError(err.message); setPreview(null); }
        finally { setSaving(false); }
    }
    return <main className="movieAdmin ticketPage"><div className="movieAdminShell">
        <Link className="movieBack" to="/employee/dashboard">← Bảng điều khiển nhân viên</Link>
        <header className="movieAdminHeading"><div><p className="movieEyebrow">SOÁT VÉ CINEMA+</p><h1>Check-in vé</h1>
            <p>Chọn đúng suất chiếu, tra cứu vé rồi xác nhận vào rạp sau khi trạng thái đã được lưu.</p></div></header>
        {loading && <p role="status">Đang tải suất chiếu…</p>}
        {error && <p className="movieError" role="alert">{error}</p>}
        {!loading && <section className="moviePanel checkInPanel">
            <form onSubmit={(event) => { event.preventDefault(); lookup(); }}>
                <fieldset className="checkInFields" disabled={saving || loading}>
                    <label>Suất chiếu đang soát vé<select value={showtimeId} onChange={(event) => { clearPreview(); setShowtimeId(event.target.value); }} required>
                        <option value="">Chọn suất chiếu</option>
                        {showtimes.map((item) => <option key={item._id} value={item._id}>{ticketDate(item.startTime)} · {item.cinema} · {item.room} · {item.movie?.title || 'Phim'}</option>)}
                    </select></label>
                    {showtimes.length === 0 && <p className="checkInHint">Chưa có suất chiếu trong khoảng nhận khách hoặc 24 giờ tới.</p>}
                    <label>Mã vé<input value={reference} maxLength={80} autoComplete="off" spellCheck={false} onChange={(event) => { clearPreview(); setReference(event.target.value); }} placeholder="CT-… hoặc CTD-…" required /></label>
                    <button type="submit" className="moviePrimary" disabled={lookingUp || !showtimeId}>{lookingUp ? 'Đang tra cứu…' : 'Tra cứu vé'}</button>
                </fieldset>
            </form>
            <QrScanner key={showtimeId} disabled={saving || lookingUp || !showtimeId} onDecoded={(value) => { setReference(value); lookup(value); }} />
            <button type="button" className="movieSecondary" disabled={saving || lookingUp} onClick={() => setRetry((value) => value + 1)}>Tải lại suất chiếu</button>
        </section>}
        {success && <p className={preview?.mode === 'demo' ? 'ticketNoticeBanner ticketDemo' : 'movieSuccess'} role="status">{success}</p>}
        {preview && <section className="moviePanel checkInPanel" aria-label="Kết quả tra cứu vé">
            <h2>Ghế {preview.seat} · {preview.showtime.movieTitle}</h2>
            {preview.mode === 'demo' && <p className="ticketNoticeBanner ticketDemo">VÉ MÔ PHỎNG — không xác nhận vào rạp thật.</p>}
            <p className="ticketCode">{preview.reference}</p>
            <dl className="checkInDetails">
                <div><dt>Rạp / phòng</dt><dd>{preview.showtime.cinema} · {preview.showtime.room}</dd></div>
                <div><dt>Giờ chiếu</dt><dd>{ticketDate(preview.showtime.startTime)}</dd></div>
                <div><dt>Nhận khách từ</dt><dd>{ticketDate(preview.window.opensAt)}</dd></div>
                <div><dt>Nhận khách đến</dt><dd>{ticketDate(preview.window.closesAt)}</dd></div>
                <div><dt>Phân loại</dt><dd>{preview.showtime.classification || `${preview.showtime.ageLimit}+`}</dd></div>
                <div><dt>Trạng thái</dt><dd>{preview.status === 'checked-in' ? 'Đã check-in' : preview.status === 'issued' ? 'Chưa sử dụng' : 'Không khả dụng'}</dd></div>
            </dl>
            {preview.checkedInAt && <p className="checkInHint">Thời điểm check-in: {ticketDate(preview.checkedInAt)}</p>}
            {!preview.eligible && preview.reason && <p className="movieError" role="alert">{preview.reason}</p>}
            {preview.eligible && <>
                {preview.requiresAgeCheck && <label className="checkInAge"><input type="checkbox" checked={ageVerified} disabled={saving} onChange={(event) => setAgeVerified(event.target.checked)} />
                    Đã kiểm tra độ tuổi và điều kiện người giám hộ phù hợp phân loại phim (K/T13/T16/T18).</label>}
                <button type="button" className="moviePrimary" disabled={saving || (preview.requiresAgeCheck && !ageVerified)} onClick={confirm}>
                    {saving ? 'Đang lưu check-in…' : preview.mode === 'demo' ? 'Lưu check-in mô phỏng' : 'Xác nhận check-in'}
                </button>
            </>}
        </section>}
    </div></main>;
}
