import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMovies } from '../../services/movieService';
import { getAdminShowtimes, addShowtime, updateShowtime, deleteShowtime, getShowtime, getShowtimeRooms } from '../../services/showtimeService';
import './movies.css';
import AutoShowtimes from './AutoShowtimes';

const emptyForm = { movie: '', cinema: '', room: '', startTime: '', price: '80000' };

function displayTime(value) {
  return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export default function ManageShowtimes() {
  const [movies, setMovies] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [movieError, setMovieError] = useState('');
  const [result, setResult] = useState({ showtimes: [], total: 0, totalPages: 0 });
  const [movieFilter, setMovieFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [mode, setMode] = useState('');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const editor = useRef(null);
  const errorSummary = useRef(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([getMovies(), getShowtimeRooms()]).then(([movieData, roomData]) => {
      if (!ignore) { setMovies(movieData); setRooms(roomData); setMovieError(''); }
    })
      .catch((err) => { if (!ignore) setMovieError(err.message); });
    function refreshRooms() { getShowtimeRooms().then(data => { if (!ignore) setRooms(data); }).catch(err => { if (!ignore) setMovieError(err.message); }); }
    window.addEventListener('focus', refreshRooms);
    return () => { ignore = true; window.removeEventListener('focus', refreshRooms); };
  }, [reload]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    getAdminShowtimes(movieFilter, page)
      .then((data) => { if (!ignore) setResult(data); })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [movieFilter, page, reload]);

  useEffect(() => {
    if (mode && editor.current) editor.current.focus();
  }, [mode, selected]);

  useEffect(() => {
    if (formError && errorSummary.current) errorSummary.current.focus();
  }, [formError]);

  function openEditor(nextMode, showtime = null) {
    setMode(nextMode);
    setSelected(showtime);
    setFormError('');
    setMessage('');
    setRecoveryError('');
    if (showtime && nextMode === 'edit') {
      // datetime-local is explicitly interpreted as Vietnam time, regardless of device timezone.
      const localTime = new Date(new Date(showtime.startTime).getTime() + 7 * 60 * 60000);
      setForm({ movie: showtime.movie ? showtime.movie._id : '', cinema: showtime.cinema,
        room: showtime.room, startTime: localTime.toISOString().slice(0, 16), price: String(showtime.price) });
    } else {
      setForm(emptyForm);
    }
  }

  function closeEditor() {
    setMode('');
    setSelected(null);
    setFormError('');
  }

  function changeField(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    setFormError('');
    setSaving(true);
    try {
      let response;
      if (mode === 'delete') {
        response = await deleteShowtime(selected._id, selected.updatedAt);
      } else {
        const data = {
          movie: form.movie, cinema: form.cinema.trim(), room: form.room.trim(),
          startTime: new Date(`${form.startTime}:00+07:00`).toISOString(), price: Number(form.price)
        };
        if (mode === 'edit') {
          data.updatedAt = selected.updatedAt;
          response = await updateShowtime(selected._id, data);
        } else {
          response = await addShowtime(data);
        }
      }
      setMessage(response.message);
      closeEditor();
      setPage(1);
      setReload((value) => value + 1);
    } catch (err) {
      if (err.status === 409 && selected) {
        // Reload the server version before asking the Admin to submit again.
        try {
          const current = await getShowtime(selected._id);
          openEditor(mode, current);
          setReload((value) => value + 1);
          setFormError(`${err.message} Đã tải dữ liệu mới nhất; vui lòng kiểm tra trước khi xác nhận lại.`);
        } catch (reloadError) {
          closeEditor();
          setRecoveryError(reloadError.message);
          setReload((value) => value + 1);
        }
      } else {
        setFormError(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  function refresh() {
    closeEditor();
    setRecoveryError('');
    setReload((value) => value + 1);
  }

  let editorTitle = 'Thêm suất chiếu';
  let submitLabel = 'Lưu suất chiếu';
  if (mode === 'edit') {
    editorTitle = 'Cập nhật suất chiếu';
  } else if (mode === 'delete') {
    editorTitle = 'Xác nhận xóa suất chiếu';
    submitLabel = 'Xác nhận xóa';
  }
  if (saving) submitLabel = 'Đang xử lý…';
  const selectedRoom = rooms.find((room) => room.cinema === form.cinema && room.name === form.room);

  return (
    <main className="movieAdmin">
      <div className="movieAdminShell">
        <Link className="movieBack" to="/admin/dashboard">← Trung tâm quản trị</Link>
        <header className="movieAdminHeading">
          <div><p className="movieEyebrow">CINEMA+ / QUẢN TRỊ</p><h1>Quản lý suất chiếu</h1>
            <p>Lịch chiếu, phòng và giá vé. Thời gian hiển thị theo giờ Việt Nam (UTC+7).</p></div>
          <button className="moviePrimary" disabled={saving || !!movieError || movies.length === 0 || rooms.length === 0}
            onClick={() => openEditor('add')}>+ Thêm suất chiếu</button>
        </header>
        {message && <p className="movieSuccess" role="status">{message}</p>}
        {recoveryError && <p className="movieError" role="alert">{recoveryError}</p>}
        {movieError && <p className="movieError" role="alert">Không tải được danh mục phim/phòng: {movieError}</p>}
        {!movieError && rooms.length === 0 && <p className="movieWarning" role="status">Chưa có phòng hoạt động. Cần cấu hình phòng và sơ đồ ghế trước khi thêm suất chiếu.</p>}

        {['add', 'auto'].includes(mode) && <div className="showtimeAddModes" role="group" aria-label="Cách thêm suất chiếu">
          <button type="button" className="movieSecondary" aria-pressed={mode === 'add'} disabled={saving} onClick={() => openEditor('add')}>Thêm thủ công</button>
          <button type="button" className="movieSecondary" aria-pressed={mode === 'auto'} disabled={saving} onClick={() => openEditor('auto')}>Đề xuất tự động</button>
        </div>}
        {mode === 'auto' && <AutoShowtimes movies={movies} rooms={rooms} onCancel={closeEditor} onBusyChange={setSaving}
          onSaved={(response) => { setMessage(response.message); closeEditor(); setPage(1); setReload(value => value + 1); }} />}

        {mode && mode !== 'auto' && <section className="moviePanel" aria-labelledby="showtime-editor-title">
          <form className="movieForm" onSubmit={handleSubmit}>
            <h2 id="showtime-editor-title" tabIndex={-1} ref={editor}>
              {editorTitle}
            </h2>
            {formError && <p className="movieError" role="alert" tabIndex={-1} ref={errorSummary}>{formError}</p>}
            <fieldset disabled={saving}>
              {mode === 'delete' ? <>
                <p><strong>{selected.movie ? selected.movie.title : 'Phim không còn tồn tại'}</strong></p>
                <p>{selected.cinema} · {selected.room} · {displayTime(selected.startTime)}</p>
                <p>Giá vé: {selected.price.toLocaleString('vi-VN')} VND · {selected.seats.length} ghế</p>
                <p className="movieWarning">Chỉ xóa suất chưa bắt đầu và chưa có tham chiếu đặt vé. Thao tác này không thể hoàn tác.</p>
              </> : <>
                <p className="movieFormHint">Tất cả các trường đều bắt buộc. Lịch cùng phòng phải cách nhau đủ thời lượng phim và 15 phút dọn phòng.</p>
                <div className="movieFormGrid">
                  <label className="movieWide">Phim
                    <select name="movie" required value={form.movie} onChange={changeField}>
                      <option value="">Chọn phim</option>
                      {movies.map((movie) => <option key={movie._id} value={movie._id}>{movie.title} · {movie.duration} phút</option>)}
                    </select>
                  </label>
                  <label className="movieWide">Rạp / Phòng chiếu
                    <select required value={selectedRoom ? selectedRoom._id : ''}
                      onChange={(event) => {
                        const room = rooms.find((item) => item._id === event.target.value);
                        setForm({ ...form, cinema: room ? room.cinema : '', room: room ? room.name : '' });
                      }}>
                      <option value="">Chọn phòng đang hoạt động</option>
                      {rooms.map((room) => <option key={room._id} value={room._id}>
                        {room.cinema} · {room.name} · {room.seats.length} ghế
                      </option>)}
                    </select>
                  </label>
                  <label>Thời gian bắt đầu (UTC+7)<input name="startTime" type="datetime-local" required
                    value={form.startTime} onChange={changeField} /></label>
                  <label>Giá vé (VND)<input name="price" type="number" required min="1" step="1"
                    value={form.price} onChange={changeField} /></label>
                </div>
                <p className="movieFormHint">Ghế được lấy từ cấu hình phòng đã chọn. Chỉ suất chưa có giữ ghế hoặc đặt vé mới được thay đổi; giá vé áp dụng cho toàn bộ ghế của suất.</p>
              </>}
              <div className="movieFormActions">
                <button className="movieSecondary" type="button" onClick={closeEditor}>Hủy</button>
                <button className="moviePrimary" type="submit" disabled={mode !== 'delete' && !!movieError}>
                  {submitLabel}
                </button>
              </div>
            </fieldset>
          </form>
        </section>}

        <section className="moviePanel" aria-label="Danh sách suất chiếu" aria-busy={loading}>
          <div className="movieToolbar">
            <label htmlFor="showtime-movie-filter">Lọc theo phim</label>
            <select id="showtime-movie-filter" value={movieFilter} disabled={saving}
              onChange={(event) => { setMovieFilter(event.target.value); setPage(1); }}>
              <option value="">Tất cả phim</option>
              {movies.map((movie) => <option key={movie._id} value={movie._id}>{movie.title}</option>)}
            </select>
            <button className="movieSecondary" disabled={saving} onClick={refresh}>Tải lại</button>
          </div>
          {loading && <p className="movieState" role="status">Đang tải suất chiếu…</p>}
          {!loading && error && <p className="movieError" role="alert">{error}</p>}
          {!loading && !error && <>
            <p className="movieCount" role="status">{result.total} suất chiếu</p>
            {result.showtimes.length === 0 ? <p className="movieState">Chưa có suất chiếu phù hợp.</p> :
              <div className="movieTableWrap"><table className="movieTable">
                <caption className="movieSrOnly">Danh sách suất chiếu theo giờ Việt Nam</caption>
                <thead><tr><th scope="col">Phim / Rạp / Phòng</th><th scope="col">Bắt đầu</th>
                  <th scope="col">Giá vé</th><th scope="col">Ghế</th><th scope="col">Thao tác</th></tr></thead>
                <tbody>{result.showtimes.map((showtime) => <tr key={showtime._id}>
                  <td><strong>{showtime.movie ? showtime.movie.title : 'Phim không còn tồn tại'}</strong>
                    <div className="movieGenres">{showtime.cinema} · {showtime.room}</div>
                    {showtime.movie && <small>{showtime.movie.duration} phút</small>}</td>
                  <td>{displayTime(showtime.startTime)}</td>
                  <td>{showtime.price.toLocaleString('vi-VN')} VND</td>
                  <td>{showtime.seats.filter((seat) => seat.status === 'available' && (!seat.condition || seat.condition === 'Active')).length}/{showtime.seats.length} trống</td>
                  <td><button className="movieSecondary" disabled={saving}
                    aria-label={`Sửa suất chiếu ${displayTime(showtime.startTime)} tại ${showtime.room}`}
                    onClick={() => openEditor('edit', showtime)}>Sửa</button>{' '}
                    <button className="movieSecondary" disabled={saving}
                      aria-label={`Xóa suất chiếu ${displayTime(showtime.startTime)} tại ${showtime.room}`}
                      onClick={() => openEditor('delete', showtime)}>Xóa</button></td>
                </tr>)}</tbody>
              </table></div>}
            {result.totalPages > 1 && <nav className="moviePagination" aria-label="Phân trang suất chiếu">
              <button className="movieSecondary" disabled={saving || page === 1} onClick={() => setPage(page - 1)}>← Trang trước</button>
              <span>Trang {page} / {result.totalPages}</span>
              <button className="movieSecondary" disabled={saving || page >= result.totalPages} onClick={() => setPage(page + 1)}>Trang sau →</button>
            </nav>}
          </>}
        </section>
      </div>
    </main>
  );
}
