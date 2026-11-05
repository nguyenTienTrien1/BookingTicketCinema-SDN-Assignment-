import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addMovie, getAdminMovie, updateMovie } from '../../services/movieService';
import './movies.css';

const initialForm = {
  title: '', description: '', genre: '', duration: '', classification: '',
  releaseDate: '', poster: '', banner: '', rating: '0', featured: false
};

export default function MovieForm({ editing = false }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(editing);
  const [hasShowtimes, setHasShowtimes] = useState(false);
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState(!editing);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const errorRef = useRef(null);

  useEffect(() => {
    if (!editing) return;
    let ignore = false;
    setLoading(true);
    setLoaded(false);
    setError('');
    getAdminMovie(id).then(({ movie, hasShowtimes }) => {
      if (ignore) return;
      setForm({
        title: movie.title, description: movie.description || '', genre: movie.genre.join(', '),
        duration: String(movie.duration), classification: movie.classification || (movie.ageLimit > 0 ? 'T' + movie.ageLimit : 'P'),
        releaseDate: movie.releaseDate ? movie.releaseDate.slice(0, 10) : '', poster: movie.poster || '',
        banner: movie.banner || '', rating: String(movie.rating ?? 0), featured: movie.featured,
        version: movie.__v
      });
      setHasShowtimes(hasShowtimes);
      setLoaded(true);
    }).catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [editing, id, reload]);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form, genre: form.genre.split(',').map((item) => item.trim()),
        duration: Number(form.duration), rating: Number(form.rating)
      };
      const result = editing ? await updateMovie(id, payload) : await addMovie(payload);
      navigate('/admin/movies', { replace: true, state: { message: `${editing ? 'Đã cập nhật' : 'Đã thêm'} phim “${result.movie.title}”.` } });
    } catch (err) {
      setError(err.message);
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <main className="movieAdmin">
      <div className="movieAdminShell movieFormShell">
        <Link className="movieBack" to="/admin/movies">← Danh sách phim</Link>
        <header className="movieAdminHeading"><div><p className="movieEyebrow">CINEMA+ / DANH MỤC PHIM</p>
          <h1>{editing ? 'Cập nhật phim' : 'Thêm phim mới'}</h1><p>{editing ? 'Chỉnh sửa thông tin phim trong danh mục.' : 'Nhập thông tin phim trước khi thiết lập suất chiếu.'}</p></div></header>
        {loading && <p role="status">Đang tải thông tin phim…</p>}
        {editing && error && !loaded && <div className="movieError" role="alert">{error}<button className="movieSecondary" onClick={() => setReload(reload + 1)}>Tải lại</button></div>}
        {!loading && loaded && <form className="moviePanel movieForm" onSubmit={handleSubmit}>
          {error && <p className="movieError" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
          {editing && <button className="movieSecondary" type="button" disabled={saving} onClick={() => {
            if (window.confirm('Tải lại sẽ bỏ các thay đổi chưa lưu. Tiếp tục?')) setReload(reload + 1);
          }}>Tải lại dữ liệu</button>}
          {hasShowtimes && <p className="movieWarning">Phim đã có suất chiếu: tên, thời lượng, phân loại và ngày khởi chiếu được khóa để bảo vệ lịch chiếu và vé.</p>}
          <p className="movieFormHint">Các trường có dấu * là bắt buộc.</p>
          <fieldset disabled={saving}>
            <legend className="movieSrOnly">{editing ? 'Thông tin phim cần cập nhật' : 'Thông tin phim mới'}</legend>
            <div className="movieFormGrid">
              <label className="movieWide" htmlFor="movie-title">Tên phim *
                <input id="movie-title" name="title" disabled={hasShowtimes} value={form.title} onChange={handleChange} required maxLength={200} autoFocus /></label>
              <label className="movieWide" htmlFor="movie-description">Mô tả *
                <textarea id="movie-description" name="description" value={form.description} onChange={handleChange} required maxLength={5000} rows={5} /></label>
              <label className="movieWide" htmlFor="movie-genre">Thể loại *
                <input id="movie-genre" name="genre" value={form.genre} onChange={handleChange} required maxLength={509} aria-describedby="genre-help" placeholder="Action, Adventure" />
                <small id="genre-help">Tối đa 10 thể loại, phân cách bằng dấu phẩy.</small></label>
              <label htmlFor="movie-duration">Thời lượng (phút) *
                <input id="movie-duration" type="number" name="duration" disabled={hasShowtimes} value={form.duration} onChange={handleChange} required min={1} max={1440} step={1} /></label>
              <label htmlFor="movie-classification">Phân loại phim *
                <select id="movie-classification" name="classification" disabled={hasShowtimes} value={form.classification} onChange={handleChange} required>
                  <option value="">Chọn phân loại</option>
                  <option value="P">P — Mọi độ tuổi</option>
                  <option value="K">K — Dưới 13 tuổi cần người giám hộ</option>
                  <option value="T13">T13 — Từ 13 tuổi</option>
                  <option value="T16">T16 — Từ 16 tuổi</option>
                  <option value="T18">T18 — Từ 18 tuổi</option>
                  <option value="C">C — Không được phép phổ biến</option>
                </select></label>
              {form.classification === 'C' && <p className="movieWide movieWarning">Phim loại C không được phép phổ biến hoặc bán vé.</p>}
              <label htmlFor="movie-release">Ngày khởi chiếu *
                <input id="movie-release" type="date" name="releaseDate" disabled={hasShowtimes} value={form.releaseDate} onChange={handleChange} required min="1900-01-01" max="9999-12-31" /></label>
              <label htmlFor="movie-rating">Điểm đánh giá (0–10)
                <input id="movie-rating" type="number" name="rating" value={form.rating} onChange={handleChange} required min={0} max={10} step="any" /></label>
              <label className="movieWide" htmlFor="movie-poster">Đường dẫn poster *
                <input id="movie-poster" name="poster" value={form.poster} onChange={handleChange} required maxLength={2048} placeholder="https://… hoặc /images/posters/…" aria-describedby="media-help" /></label>
              <label className="movieWide" htmlFor="movie-banner">Đường dẫn banner
                <input id="movie-banner" name="banner" value={form.banner} onChange={handleChange} maxLength={2048} placeholder="https://… hoặc /images/banners/…" />
                <small id="media-help">Dùng URL http/https hoặc đường dẫn ảnh có sẵn trên website.</small></label>
              <label className="movieWide movieCheckbox" htmlFor="movie-featured">
                <input id="movie-featured" type="checkbox" name="featured" checked={form.featured} onChange={handleChange} />Đánh dấu phim nổi bật</label>
            </div>
          </fieldset>
          <div className="movieFormActions">
            <button className="movieSecondary" type="button" disabled={saving} onClick={() => navigate('/admin/movies')}>Hủy</button>
            <button className="moviePrimary" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu phim'}</button>
          </div>
        </form>}
      </div>
    </main>
  );
}
