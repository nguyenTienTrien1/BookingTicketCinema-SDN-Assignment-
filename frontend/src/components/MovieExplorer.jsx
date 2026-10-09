import { useMemo, useState } from 'react';
import MovieCard from './MovieCard';
import { translateGenre } from '../utils/uiText';

export default function MovieExplorer({ movies, setSelected, setTab, compact = false }) {
    const [search, setSearch] = useState('');
    const [genre, setGenre] = useState('');
    const [releaseYear, setReleaseYear] = useState('');
    const [timeOrder, setTimeOrder] = useState('newest');

    const genres = useMemo(
        () => [...new Set(movies.flatMap((movie) => movie.genre || []))].sort((a, b) => a.localeCompare(b)),
        [movies]
    );
    const years = useMemo(
        () => [...new Set(movies
            .map((movie) => movie.releaseDate && new Date(movie.releaseDate).getFullYear())
            .filter((year) => Number.isFinite(year)))].sort((a, b) => b - a),
        [movies]
    );

    const filteredMovies = useMemo(() => {
        const normalizedSearch = search.trim().toLocaleLowerCase('vi');
        return movies
            .filter((movie) => !normalizedSearch || String(movie.title || '').toLocaleLowerCase('vi').includes(normalizedSearch))
            .filter((movie) => !genre || (movie.genre || []).includes(genre))
            .filter((movie) => !releaseYear || (
                movie.releaseDate && new Date(movie.releaseDate).getFullYear() === Number(releaseYear)
            ))
            .sort((a, b) => {
                const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
                const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
                return timeOrder === 'newest' ? dateB - dateA : dateA - dateB;
            });
    }, [movies, search, genre, releaseYear, timeOrder]);

    function openMovie(movie, tab) {
        setSelected(movie);
        setTab(tab);
    }

    function clearFilters() {
        setSearch('');
        setGenre('');
        setReleaseYear('');
        setTimeOrder('newest');
    }

    return (
        <section className={`movieExplorer${compact ? ' compact' : ''}`}>
            <div className="movieExplorerHeading">
                <div>
                    <p className="bookingEyebrow">CINEMA+ · KHÁM PHÁ</p>
                    <h2>{compact ? 'Tìm phim phù hợp' : 'Khám phá phim'}</h2>
                    <p>Tìm theo tên, thể loại hoặc năm phát hành.</p>
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
                    <span>Năm phát hành</span>
                    <select value={releaseYear} onChange={(event) => setReleaseYear(event.target.value)}>
                        <option value="">Tất cả năm</option>
                        {years.map((year) => <option value={year} key={year}>{year}</option>)}
                    </select>
                </label>
                <label>
                    <span>Sắp xếp thời gian</span>
                    <select value={timeOrder} onChange={(event) => setTimeOrder(event.target.value)}>
                        <option value="newest">Mới nhất trước</option>
                        <option value="oldest">Cũ nhất trước</option>
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
