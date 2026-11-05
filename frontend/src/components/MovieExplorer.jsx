import { useMemo, useState } from 'react';
import MovieCard from './MovieCard';
import { translateGenre } from '../utils/uiText';

export default function MovieExplorer({ movies, setSelected, setTab, compact = false }) {
    const [search, setSearch] = useState('');
    const [genre, setGenre] = useState('');
    const [ratingFilter, setRatingFilter] = useState('');
    const [sortOrder, setSortOrder] = useState('newest');

    const genres = useMemo(
        () => [...new Set(movies.flatMap((movie) => movie.genre || []))].sort((a, b) => a.localeCompare(b)),
        [movies]
    );

    const filteredMovies = useMemo(() => {
        const normalizedSearch = search.trim().toLocaleLowerCase('vi');
        return movies
            .filter((movie) => !normalizedSearch || String(movie.title || '').toLocaleLowerCase('vi').includes(normalizedSearch))
            .filter((movie) => !genre || (movie.genre || []).includes(genre))
            .filter((movie) => {
                if (!ratingFilter) return true;
                const threshold = Number(ratingFilter);
                return Number(movie.rating || 0) >= threshold;
            })
            .sort((a, b) => {
                if (sortOrder === 'rating-desc') {
                    return (Number(b.rating) || 0) - (Number(a.rating) || 0);
                }
                if (sortOrder === 'rating-asc') {
                    return (Number(a.rating) || 0) - (Number(b.rating) || 0);
                }
                const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
                const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
                return sortOrder === 'oldest' ? dateA - dateB : dateB - dateA;
            });
    }, [movies, search, genre, ratingFilter, sortOrder]);

    function openMovie(movie, tab) {
        setSelected(movie);
        setTab(tab);
    }

    function clearFilters() {
        setSearch('');
        setGenre('');
        setRatingFilter('');
        setSortOrder('newest');
    }

    return (
        <section className={`movieExplorer${compact ? ' compact' : ''}`}>
            <div className="movieExplorerHeading">
                <div>
                    <p className="bookingEyebrow">CINEMA+ · KHÁM PHÁ</p>
                    <h2>{compact ? 'Tìm phim phù hợp' : 'Khám phá phim'}</h2>
                    <p>Tìm theo tên, thể loại hoặc lượt đánh giá.</p>
                </div>
                <span className="movieResultCount">{filteredMovies.length} phim</span>
            </div>

            <div className="movieFilters" role="search" aria-label="Tìm kiếm và lọc phim">
                <label className="movieSearchField">
                    <span>Tên phim</span>
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Nhập tên phim..."
                    />
                </label>
                <label>
                    <span>Thể loại</span>
                    <select value={genre} onChange={(event) => setGenre(event.target.value)}>
                        <option value="">Tất cả thể loại</option>
                        {genres.map((item) => <option value={item} key={item}>{translateGenre(item)}</option>)}
                    </select>
                </label>
                <label>
                    <span>Lượt đánh giá</span>
                    <select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)}>
                        <option value="">Tất cả đánh giá</option>
                        <option value="9">Từ 9.0 ★ trở lên (Xuất sắc)</option>
                        <option value="8.5">Từ 8.5 ★ trở lên (Rất hay)</option>
                        <option value="8">Từ 8.0 ★ trở lên (Đánh giá cao)</option>
                        <option value="7.5">Từ 7.5 ★ trở lên (Phổ biến)</option>
                        <option value="7">Từ 7.0 ★ trở lên</option>
                    </select>
                </label>
                <label>
                    <span>Sắp xếp</span>
                    <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                        <option value="newest">Mới nhất trước</option>
                        <option value="oldest">Cũ nhất trước</option>
                        <option value="rating-desc">Đánh giá cao nhất</option>
                        <option value="rating-asc">Đánh giá thấp nhất</option>
                    </select>
                </label>
                <button type="button" className="movieFilterReset" onClick={clearFilters}>Xóa lọc</button>
            </div>

            {filteredMovies.length ? (
                <div className="grid movieExplorerGrid">
                    {filteredMovies.map((movie) => (
                        <MovieCard
                            key={movie._id}
                            movie={movie}
                            onClick={() => openMovie(movie, 'booking')}
                            onDetail={() => openMovie(movie, 'movie-detail')}
                        />
                    ))}
                </div>
            ) : (
                <div className="movieExplorerEmpty">
                    <h3>Không tìm thấy phim phù hợp</h3>
                    <p>Thử đổi từ khóa hoặc bỏ bớt điều kiện lọc.</p>
                    <button type="button" className="ghost" onClick={clearFilters}>Xóa bộ lọc</button>
                </div>
            )}
        </section>
    );
}
