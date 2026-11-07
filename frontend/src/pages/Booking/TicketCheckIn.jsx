import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCheckInShowtimes, lookupTicket, checkInTicket } from '../../services/ticketService';
import QrScanner from '../../components/QrScanner';
import { ticketDate } from '../Account/BookingTickets';
import '../Admin/movies.css';
import '../Account/tickets.css';

export default function TicketCheckIn() {
    const navigate = useNavigate();
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
    const [needsLookup, setNeedsLookup] = useState(false);
    const [now, setNow] = useState(Date.now());
    const request = useRef(null);

    useEffect(() => {
        const controller = new AbortController();
        request.current?.abort();
        setLoading(true); setError(''); setPreview(null); setSuccess(''); setShowtimeId(''); setNeedsLookup(false);
        getCheckInShowtimes(controller.signal).then((data) => { if (!controller.signal.aborted) setShowtimes(data.showtimes); })
            .catch((err) => { if (!controller.signal.aborted) setError(err.message); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [retry]);
    useEffect(() => () => request.current?.abort(), []);
    useEffect(() => {
        if (!preview?.eligible) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [preview]);
    const inWindow = preview && now >= new Date(preview.window.opensAt).getTime() && now <= new Date(preview.window.closesAt).getTime();

    function clearPreview() {
        request.current?.abort(); setLookingUp(false); setPreview(null); setSuccess(''); setError(''); setAgeVerified(false); setNeedsLookup(false);
    }
    async function lookup(value = reference) {
        clearPreview();
        if (!showtimeId) { setError('Vui lòng chọn suất chiếu đang soát vé.'); return; }
        if (!value.trim()) { setError('Vui lòng nhập hoặc quét mã vé.'); return; }
        const controller = new AbortController(); request.current = controller;
        setLookingUp(true);
        try { const data = await lookupTicket(value.trim(), showtimeId, controller.signal); if (!controller.signal.aborted) { setPreview(data); setNow(Date.now()); } }
        catch (err) { if (!controller.signal.aborted) setError(err.message); }
        finally { if (!controller.signal.aborted) setLookingUp(false); }
    }
    async function confirm() {
        if (!preview?.eligible || !inWindow || needsLookup || saving || (preview.requiresAgeCheck && !ageVerified)) return;
        const controller = new AbortController(); request.current = controller;
        setSaving(true); setError(''); setSuccess('');
        try {
            const result = await checkInTicket(preview.reference, { showtimeId, ageVerified });
            if (controller.signal.aborted) return;
            setPreview(result); setSuccess(result.message);
        } catch (err) {
            if (controller.signal.aborted) return;
            setError(err.message); setPreview(null); setAgeVerified(false);
            if (!err.status || err.status >= 500) {
                setNeedsLookup(true);
                try {
                    const current = await lookupTicket(preview.reference, showtimeId, controller.signal);
                    if (!controller.signal.aborted) setPreview(current);
                } catch { /* Keep the uncertain result visible until a new lookup succeeds. */ }
            }
        } finally { if (!controller.signal.aborted) setSaving(false); }
    }
    return <main className="movieAdmin ticketPage"><div className="movieAdminShell">
        <button type="button" className="ghost staffBackButton" disabled={saving} onClick={() => navigate('/account?section=profile')}>← Về hồ sơ & tác vụ</button>
        <header className="movieAdminHeading"><div><p className="movieEyebrow">SOÁT VÉ CINEMA+</p><h1>Check-in vé</h1>
            <p>Chọn đúng suất chiếu, tra cứu vé rồi xác nhận vào rạp sau khi trạng thái đã được lưu.</p></div></header>
        {loading && <p role="status">Đang tải suất chiếu…</p>}
        {error && <p className="movieError" role="alert">{error}</p>}
        {needsLookup && <div className="ticketNoticeBanner" role="status">
            <p>Kết quả lưu chưa rõ. Trạng thái tra cứu lại không phải xác nhận thành công của thao tác vừa rồi. Chưa cho khách vào rạp; kiểm tra trạng thái trước khi xử lý tiếp.</p>
            <button type="button" className="movieSecondary" disabled={saving || lookingUp} onClick={() => lookup()}>Tra cứu lại trạng thái</button>
        </div>}
        {!loading && <section className="moviePanel checkInPanel">
            <form onSubmit={(event) => { event.preventDefault(); lookup(); }}>
                <fieldset className="checkInFields" disabled={saving || loading}>
                    <label>Suất chiếu đang soát vé<select value={showtimeId} onChange={(event) => { clearPreview(); setShowtimeId(event.target.value); }} required>
                        <option value="">Chọn suất chiếu</option>
                        {showtimes.map((item) => <option key={item._id} value={item._id}>{ticketDate(item.startTime)} · {item.cinema} · {item.room} · {item.movie?.title || 'Phim'}</option>)}
                    </select></label>
                    {showtimes.length === 0 && <p className="checkInHint">Chưa có suất chiếu trong khoảng nhận khách hoặc 24 giờ tới.</p>}
                    <label>Mã vé<input value={reference} maxLength={512} autoComplete="off" spellCheck={false} onChange={(event) => { clearPreview(); setReference(event.target.value); }} placeholder="Nhập mã vé hoặc quét QR" required /></label>
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
            {preview.eligible && !inWindow && <p className="movieError" role="alert">Đã ngoài giờ nhận khách. Tra cứu lại vé trước khi xử lý tiếp.</p>}
            {preview.eligible && !needsLookup && <>
                {preview.requiresAgeCheck && <label className="checkInAge"><input type="checkbox" checked={ageVerified} disabled={saving} onChange={(event) => setAgeVerified(event.target.checked)} />
                    Đã kiểm tra độ tuổi và điều kiện người giám hộ phù hợp phân loại phim (K/T13/T16/T18).</label>}
                <button type="button" className="moviePrimary" disabled={saving || !inWindow || (preview.requiresAgeCheck && !ageVerified)} onClick={confirm}>
                    {saving ? 'Đang lưu check-in…' : preview.mode === 'demo' ? 'Lưu check-in mô phỏng' : 'Xác nhận check-in'}
                </button>
            </>}
        </section>}
    </div></main>;
}
