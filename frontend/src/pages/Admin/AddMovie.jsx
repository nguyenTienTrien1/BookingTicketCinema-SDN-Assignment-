import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addMovie } from '../../services/movieService';
import './movies.css';

const initialForm = {
  title: '', description: '', genre: '', duration: '', classification: '',
  releaseDate: '', poster: '', banner: '', rating: '0', featured: false
};

export default function AddMovie() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const errorRef = useRef(null);

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
      const result = await addMovie(payload);
      navigate('/admin/movies', { replace: true, state: { message: `Đã thêm phim “${result.movie.title}”.` } });
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
          <h1>Thêm phim mới</h1><p>Nhập thông tin phim trước khi thiết lập suất chiếu.</p></div></header>
        <form className="moviePanel movieForm" onSubmit={handleSubmit}>
          {error && <p className="movieError" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
          <p className="movieFormHint">Các trường có dấu * là bắt buộc.</p>
          <fieldset disabled={saving}>
            <legend className="movieSrOnly">Thông tin phim mới</legend>
            <div className="movieFormGrid">
              <label className="movieWide" htmlFor="movie-title">Tên phim *
                <input id="movie-title" name="title" value={form.title} onChange={handleChange} required maxLength={200} autoFocus /></label>
              <label className="movieWide" htmlFor="movie-description">Mô tả *
                <textarea id="movie-description" name="description" value={form.description} onChange={handleChange} required maxLength={5000} rows={5} /></label>
              <label className="movieWide" htmlFor="movie-genre">Thể loại *
                <input id="movie-genre" name="genre" value={form.genre} onChange={handleChange} required maxLength={509} aria-describedby="genre-help" placeholder="Action, Adventure" />
                <small id="genre-help">Tối đa 10 thể loại, phân cách bằng dấu phẩy.</small></label>
              <label htmlFor="movie-duration">Thời lượng (phút) *
                <input id="movie-duration" type="number" name="duration" value={form.duration} onChange={handleChange} required min={1} max={1440} step={1} /></label>
              <label htmlFor="movie-classification">Phân loại phim *
                <select id="movie-classification" name="classification" value={form.classification} onChange={handleChange} required>
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
                <input id="movie-release" type="date" name="releaseDate" value={form.releaseDate} onChange={handleChange} required min="1900-01-01" max="9999-12-31" /></label>
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
        </form>
      </div>
    </main>
  );
}
