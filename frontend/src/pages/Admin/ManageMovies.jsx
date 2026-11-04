import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getAdminMovies } from '../../services/movieService';
import './movies.css';

function classificationOf(movie) {
  if (movie.classification) return movie.classification;
  if (movie.ageLimit > 0) return `T${movie.ageLimit}`;
  return 'P';
}

export default function ManageMovies() {
  const location = useLocation();
  const [result, setResult] = useState({ movies: [], total: 0, totalPages: 0 });
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    getAdminMovies(search, page)
      .then((data) => { if (!ignore) setResult(data); })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [search, page, reload]);

  function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(keyword.trim());
  }

  return (
    <main className="movieAdmin">
      <div className="movieAdminShell">
        <Link className="movieBack" to="/admin/dashboard">← Trung tâm quản trị</Link>
        <header className="movieAdminHeading">
          <div><p className="movieEyebrow">CINEMA+ / QUẢN TRỊ</p><h1>Quản lý phim</h1>
            <p>Danh mục phim, thông tin khởi chiếu và phân loại độ tuổi.</p></div>
          <Link className="moviePrimary" to="/admin/movies/new">+ Thêm phim</Link>
        </header>

        {location.state?.message && <p className="movieSuccess" role="status">{location.state.message}</p>}
        <section className="moviePanel" aria-label="Danh sách phim">
          <form className="movieToolbar" onSubmit={handleSearch} role="search">
            <label htmlFor="movie-search">Tìm theo tên phim</label>
            <input id="movie-search" type="search" placeholder="Nhập tên phim…" maxLength={200}
              value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <button className="movieSecondary" type="submit">Tìm kiếm</button>
          </form>
          {loading && <p className="movieState" role="status">Đang tải danh sách phim…</p>}
          {!loading && error && <div className="movieError" role="alert"><p>{error}</p>
            <button className="movieSecondary" onClick={() => setReload(reload + 1)}>Thử lại</button></div>}
          {!loading && !error && <>
            <p className="movieCount" role="status">{result.total} phim{search ? ` phù hợp với “${search}”` : ' trong danh mục'}</p>
            {result.movies.length === 0 ? <div className="movieState">
              <h2>{search ? 'Không tìm thấy phim phù hợp' : 'Chưa có phim nào'}</h2>
              <p>{search ? 'Thử tìm bằng tên phim khác.' : 'Chọn “Thêm phim” để tạo phim đầu tiên.'}</p>
            </div> : <div className="movieTableWrap">
              <table className="movieTable">
                <caption className="movieSrOnly">Danh sách phim trong hệ thống</caption>
                <thead><tr><th scope="col">Phim</th><th scope="col">Phân loại</th>
                  <th scope="col">Thời lượng</th><th scope="col">Khởi chiếu</th><th scope="col">Đánh giá</th><th scope="col">Thao tác</th></tr></thead>
                <tbody>{result.movies.map((movie) => <tr key={movie._id}>
                  <td><strong>{movie.title}</strong>{movie.featured && <span className="movieFeatured">Nổi bật</span>}
                    <div className="movieGenres">{movie.genre.join(' · ')}</div>
                    <details><summary>Xem thông tin</summary><p className="movieDescription">{movie.description || 'Chưa có mô tả.'}</p>
                      <p className="movieMediaPath">Poster: {movie.poster || 'Chưa có'}</p>
                      {movie.banner && <p className="movieMediaPath">Banner: {movie.banner}</p>}
                    </details></td>
                  <td><span className="movieBadge">{classificationOf(movie)}</span></td>
                  <td>{movie.duration} phút</td>
                  <td>{movie.releaseDate ? new Date(movie.releaseDate).toLocaleDateString('vi-VN', { timeZone: 'UTC' }) : 'Chưa cập nhật'}</td>
                  <td>{movie.rating ?? 0}/10</td>
                  <td><Link className="movieSecondary" to={`/admin/movies/${movie._id}/edit`} aria-label={`Sửa phim ${movie.title}`}>Sửa</Link></td>
                </tr>)}</tbody>
              </table>
            </div>}
            {result.totalPages > 1 && <nav className="moviePagination" aria-label="Phân trang phim">
              <button className="movieSecondary" disabled={page === 1} onClick={() => setPage(page - 1)}>← Trang trước</button>
              <span>Trang {page} / {result.totalPages}</span>
              <button className="movieSecondary" disabled={page >= result.totalPages} onClick={() => setPage(page + 1)}>Trang sau →</button>
            </nav>}
          </>}
        </section>
      </div>
    </main>
  );
}
