import { useEffect, useRef, useState } from 'react';
import { suggestShowtimes, confirmShowtimeSuggestions } from '../../services/showtimeService';
import './showtimeSuggestions.css';

function today() {
  return new Date(Date.now() + 7 * 60 * 60000).toISOString().slice(0, 10);
}

function displayClock(value) {
  return new Date(value).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
}

function displayDate(value) {
  return new Date(`${value}T00:00:00+07:00`).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AutoShowtimes({ movies, rooms, onCancel, onSaved, onBusyChange }) {
  const cinemas = [...new Set(rooms.map(room => room.cinema))];
  const [form, setForm] = useState(() => ({ movie: '', cinema: cinemas.length === 1 ? cinemas[0] : '',
    startDate: today(), endDate: today(), openingTime: '09:00', closingTime: '23:00', price: '80000' }));
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(Date.now());
  const [confirmed, setConfirmed] = useState(false);
  const errorRef = useRef(null);
  const previewRef = useRef(null);
  const mounted = useRef(true);
  const busy = loading || saving;
  const expired = preview?.expiresAt && clock >= new Date(preview.expiresAt).getTime();

  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setClock(Date.now()), 15000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, []);

  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => { if (preview) previewRef.current?.focus(); }, [preview]);

  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
    setPreview(null);
    setConfirmed(false);
    setError('');
  }

  async function generate(event) {
    event.preventDefault();
    if (busy) return;
    setLoading(true);
    setPreview(null);
    setConfirmed(false);
    setError('');
    try {
      const result = await suggestShowtimes({ ...form, price: Number(form.price) });
      if (mounted.current) { setPreview(result); setClock(Date.now()); }
    } catch (err) {
      if (mounted.current) setError(err.message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  async function save() {
    if (busy || !confirmed || !preview?.token || expired) return;
    setSaving(true);
    setError('');
    try {
      const result = await confirmShowtimeSuggestions(preview.token);
      if (mounted.current) onSaved(result);
    } catch (err) {
      if (mounted.current) {
        // A changed room/schedule must be reviewed again; never silently replace
        // the Admin's reviewed room/time choices with a newly generated plan.
        if ([400, 409, 410].includes(err.status)) { setPreview(null); setConfirmed(false); }
        setError(err.message);
      }
    } finally {
      onBusyChange(false);
      if (mounted.current) setSaving(false);
    }
  }

  return <section className="moviePanel autoShowtimePanel" aria-labelledby="auto-showtime-title" aria-busy={busy}>
    <header className="autoShowtimeHeader">
      <div><h2 id="auto-showtime-title">Tự động đề xuất lịch chiếu</h2><p>Chọn phim và thời gian, hệ thống tự tìm phòng trống phù hợp.</p></div>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2" /></svg>
    </header>
    {error && <p className="movieError" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
    <form className="autoShowtimeForm" onSubmit={generate}>
      <fieldset disabled={busy}>
        <div className="movieFormGrid">
          <label className="movieWide">Phim<select name="movie" required value={form.movie} onChange={change}>
            <option value="">Chọn phim</option>{movies.filter(movie => movie.classification !== 'C').map(movie => <option key={movie._id} value={movie._id}>{movie.title} — {movie.duration} phút</option>)}
          </select></label>
          <label className="movieWide">Rạp<select name="cinema" required value={form.cinema} onChange={change}>
            <option value="">Chọn rạp</option>{cinemas.map(cinema => <option key={cinema} value={cinema}>{cinema}</option>)}
          </select><small>Phòng được tự chọn theo lịch trống, không cần chọn thủ công.</small></label>
          <label>Ngày bắt đầu<input name="startDate" type="date" required min={today()} max="2099-12-31" value={form.startDate} onChange={change} /></label>
          <label>Ngày kết thúc<input name="endDate" type="date" required min={form.startDate || today()} max="2099-12-31" value={form.endDate} onChange={change} /></label>
          <label>Giờ mở cửa<input name="openingTime" type="time" required value={form.openingTime} onChange={change} /></label>
          <label>Giờ đóng cửa<input name="closingTime" type="time" required value={form.closingTime} onChange={change} /></label>
          <label className="movieWide">Giá vé mỗi suất (VND)<input name="price" type="number" required min="1" step="1" value={form.price} onChange={change} /></label>
        </div>
        <p className="movieFormHint autoShowtimeHint">Giờ Việt Nam (UTC+7). Các suất đề xuất được xếp lần lượt, cách nhau thời lượng phim và 15 phút dọn phòng. Phim kết thúc trước hoặc đúng giờ đóng cửa. Tối đa 31 ngày và 200 suất.</p>
        <div className="autoShowtimeGenerate"><button className="movieSecondary" type="submit">{loading ? 'Đang tìm phòng trống…' : preview ? 'Tạo lại đề xuất' : 'Tạo lịch đề xuất'}</button></div>
      </fieldset>
    </form>
    {preview && <div className="autoShowtimePreview">
      <div className="autoShowtimePreviewHeading"><h3 tabIndex={-1} ref={previewRef}>Lịch chiếu hệ thống đề xuất</h3><span className="autoShowtimeBadge">{preview.total} suất</span></div>
      <div className="autoShowtimeSummary"><div><span>Thời gian áp dụng</span><strong>{preview.days.length} ngày</strong></div><div><span>Số suất mỗi ngày</span><strong>{preview.days.map(day => day.slots.length).every(count => count === preview.days[0].slots.length) ? `${preview.days[0].slots.length} suất` : 'Theo lịch trống từng ngày'}</strong></div></div>
      {expired && <p className="movieWarning" role="status">Đề xuất đã hết hạn. Vui lòng tạo lại để kiểm tra phòng trống.</p>}
      {preview.total === 0 && <p className="autoShowtimeEmpty" role="status">Không tìm thấy khoảng trống đủ thời lượng phim trong giờ đã chọn. Hãy đổi ngày hoặc mở rộng giờ hoạt động.</p>}
      <div className="autoShowtimeDays" role="region" aria-label="Lịch đề xuất theo ngày" tabIndex={0}>{preview.days.map(day => <section className="autoShowtimeDay" key={day.date} aria-label={`Lịch ngày ${displayDate(day.date)}`}>
        <div className="autoShowtimeDayHeading"><h4>{displayDate(day.date)}</h4><span>{day.slots.length} suất</span></div>
        {day.slots.length === 0 ? <p className="autoShowtimeHint">Không có suất phù hợp trong ngày này.</p> : <ul className="autoShowtimeSlots">{day.slots.map(slot => <li key={`${slot.roomId}-${slot.startTime}`}>
          <strong>{displayClock(slot.startTime)} – {displayClock(slot.endTime)}</strong><span>{slot.room}</span>
        </li>)}</ul>}
      </section>)}</div>
      {preview.total > 0 && <>
        <p className="movieFormHint">Lịch chưa được lưu. Đề xuất có hiệu lực 15 phút; phòng và lịch trống được kiểm tra lại khi lưu. Nếu có thay đổi, bạn cần tạo và xem lại đề xuất.</p>
        <label className="autoShowtimeConfirm"><input type="checkbox" checked={confirmed} disabled={busy || !!expired} onChange={event => setConfirmed(event.target.checked)} />Tôi đã kiểm tra {preview.total} suất chiếu và đồng ý thêm lịch này.</label>
      </>}
    </div>}
    <footer className="autoShowtimeActions"><button className="movieSecondary" type="button" disabled={busy} onClick={onCancel}>Hủy</button>
      <button className="moviePrimary" type="button" disabled={busy || !confirmed || !preview?.token || !!expired} onClick={save}>{saving ? 'Đang lưu lịch…' : `Lưu ${preview?.total || 0} suất chiếu`}</button></footer>
  </section>;
}
