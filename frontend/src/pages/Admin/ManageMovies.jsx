import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getAdminMovies, deleteMovie, movieImageUrl } from '../../services/movieService';
import { getMoviePoster } from '../../components/MovieCard';
import AdminDetailDialog, { AdminMediaImage } from '../../components/AdminDetailDialog';
import './movies.css';
import './adminList.css';

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
  const [classification, setClassification] = useState('');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [deleting, setDeleting] = useState(null);
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState(location.state?.message || '');

  async function handleDelete(movie) {
    if (deleting || !window.confirm(`Xóa phim “${movie.title}” khỏi danh mục? Phim đã có suất chiếu sẽ không thể xóa.`)) return;
    setDeleting(movie._id);
    setActionError('');
    setMessage('');
    try {
      await deleteMovie(movie._id, movie.__v);
      setMessage(`Đã xóa phim “${movie.title}”.`);
      if (result.movies.length === 1 && page > 1) setPage(page - 1);
      else setReload(reload + 1);
    } catch (error) {
      setActionError(error.message);
    } finally { setDeleting(null); }
  }

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    getAdminMovies(search, page, classification)
      .then((data) => { if (!ignore) setResult(data); })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [search, page, reload, classification]);

  function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(keyword.trim());
  }

  return (
    <main className="movieAdmin adminListPage">
      <div className="movieAdminShell">
        <Link className="movieBack" to="/admin/dashboard">← Trung tâm quản trị</Link>
        <header className="movieAdminHeading">
          <div><p className="movieEyebrow">CINEMA+ / QUẢN TRỊ</p><h1>Quản lý phim</h1>
            <p>Danh mục phim, thông tin khởi chiếu và phân loại độ tuổi.</p></div>
          <Link className="moviePrimary" to="/admin/movies/new">+ Thêm phim</Link>
        </header>

        {message && <p className="movieSuccess" role="status">{message}</p>}
        {actionError && <p className="movieError" role="alert">{actionError}</p>}
        <section className="moviePanel" aria-label="Danh sách phim">
          <form className="movieToolbar" onSubmit={handleSearch} role="search">
            <label htmlFor="movie-search">Tìm theo tên phim</label>
            <input id="movie-search" type="search" placeholder="Nhập tên phim…" maxLength={200}
              value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            <button className="movieSecondary" type="submit">Tìm kiếm</button>
          </form>
          <div className="adminListFilters"><label htmlFor="movie-class-filter">Phân loại<select id="movie-class-filter" value={classification} onChange={event => { setClassification(event.target.value); setPage(1); }}>{[['', 'Tất cả phân loại'], ['P', 'P · Mọi độ tuổi'], ['K', 'K · Có người giám hộ'], ['T13', 'Từ 13 tuổi'], ['T16', 'Từ 16 tuổi'], ['T18', 'Từ 18 tuổi'], ['C', 'C · Không phổ biến']].map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>{(classification || search) && <button className="movieSecondary" type="button" onClick={() => { setClassification(''); setKeyword(''); setSearch(''); setPage(1); }}>Xóa bộ lọc</button>}</div>
          {loading && <p className="movieState" role="status">Đang tải danh sách phim…</p>}
          {!loading && error && <div className="movieError" role="alert"><p>{error}</p>
            <button className="movieSecondary" onClick={() => setReload(reload + 1)}>Thử lại</button></div>}
          {!loading && !error && <>
            <p className="movieCount" role="status">{result.total} phim{search ? ` phù hợp với “${search}”` : ' trong danh mục'}</p>
            {result.movies.length === 0 ? <div className="movieState">
              <h2>{search || classification ? 'Không tìm thấy phim phù hợp' : 'Chưa có phim nào'}</h2>
              <p>{search || classification ? 'Thử tên phim hoặc phân loại khác.' : 'Chọn “Thêm phim” để tạo phim đầu tiên.'}</p>
            </div> : <div className="movieTableWrap">
              <table className="movieTable">
                <caption className="movieSrOnly">Danh sách phim trong hệ thống</caption>
                <thead><tr><th scope="col">Phim</th><th scope="col">Phân loại</th>
                  <th scope="col" className="adminNumeric">Thời lượng</th><th scope="col">Khởi chiếu</th><th scope="col" className="adminNumeric">Đánh giá</th><th scope="col">Thao tác</th></tr></thead>
                <tbody>{result.movies.map((movie) => <tr key={movie._id}>
                  <td><div className="adminListIdentity"><AdminMediaImage src={movieImageUrl(getMoviePoster(movie))} alt={'Poster ' + movie.title} width="56" height="76" /><div><strong>{movie.title}</strong>{movie.featured && <span className="movieFeatured">Nổi bật</span>}
                    <div className="movieGenres">{movie.genre.join(' · ')}</div>
                    <button className="adminListDetailButton" type="button" onClick={() => setSelectedMovie(movie)} aria-label={'Xem thông tin phim ' + movie.title}>Xem thông tin →</button></div></div></td>
                  <td><span className="movieBadge">{classificationOf(movie)}</span></td>
                  <td className="adminNumeric">{movie.duration} phút</td>
                  <td className="adminNoWrap">{movie.releaseDate ? new Date(movie.releaseDate).toLocaleDateString('vi-VN', { timeZone: 'UTC' }) : 'Chưa cập nhật'}</td>
                  <td className="adminNumeric">{movie.rating ?? 0}/10</td>
                  <td><div className="adminListActions"><Link className="movieSecondary" to={`/admin/movies/${movie._id}/edit`} aria-label={`Sửa phim ${movie.title}`}>Sửa</Link>
                    <button className="movieSecondary" type="button" disabled={Boolean(deleting)} onClick={() => handleDelete(movie)} aria-label={`Xóa phim ${movie.title}`}>
                      {deleting === movie._id ? 'Đang xóa…' : 'Xóa'}
                    </button></div></td>
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
        {selectedMovie && <AdminDetailDialog title={selectedMovie.title} onClose={() => setSelectedMovie(null)}><p className="adminDetailDescription">{selectedMovie.description || 'Chưa có mô tả.'}</p><div className="adminDetailMedia"><figure><AdminMediaImage src={movieImageUrl(getMoviePoster(selectedMovie))} alt={'Poster ' + selectedMovie.title} /><figcaption><a href={movieImageUrl(getMoviePoster(selectedMovie))} target="_blank" rel="noopener noreferrer">Mở poster ↗</a></figcaption></figure>{selectedMovie.banner && <figure><AdminMediaImage src={movieImageUrl(selectedMovie.banner)} alt={'Banner ' + selectedMovie.title} /><figcaption><a href={movieImageUrl(selectedMovie.banner)} target="_blank" rel="noopener noreferrer">Mở banner ↗</a></figcaption></figure>}</div><dl className="adminDetailFacts"><div><dt>Thể loại</dt><dd>{selectedMovie.genre.join(' · ')}</dd></div><div><dt>Phân loại</dt><dd>{classificationOf(selectedMovie)}</dd></div><div><dt>Thời lượng</dt><dd>{selectedMovie.duration} phút</dd></div><div><dt>Đánh giá</dt><dd>{selectedMovie.rating ?? 0}/10</dd></div></dl></AdminDetailDialog>}
      </div>
    </main>
  );
}
