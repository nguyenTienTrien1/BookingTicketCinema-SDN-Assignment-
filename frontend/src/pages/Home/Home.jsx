import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMoviePoster } from '../../components/MovieCard';
import { translateGenre } from '../../utils/uiText';
import { upcomingShowtimes, movieIdOf, availableSeats } from '../../utils/homeMovies';
import './home.css';

function Arrow({ diagonal = false }) {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        {diagonal ? <path d="M6 18 18 6M6 6h12v12" /> : <path d="M4 12h16m-6-6 6 6-6 6" />}
    </svg>;
}
function classification(movie) {
    return movie.classification || (movie.ageLimit ? movie.ageLimit + '+' : 'P');
}
const formatTime = (value) => new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

function imageFallback(event) {
    const image = event.currentTarget;
    if (image.dataset.fallback && !image.dataset.fallbackUsed) {
        image.dataset.fallbackUsed = '1';
        image.src = image.dataset.fallback;
    } else {
        image.style.visibility = 'hidden';
    }
}

export default function Home({ movies, showtimes, user, setSelected, setTab, dataLoading, dataError, onRetryData }) {
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [movieId, setMovieId] = useState('');
    const [cinema, setCinema] = useState('');
    const [showtimeId, setShowtimeId] = useState('');
    const [clock, setClock] = useState(Date.now());
    const [bookingNotice, setBookingNotice] = useState('');
    useEffect(() => {
        const refresh = () => setClock(Date.now());
        const timer = window.setInterval(refresh, 60000);
        window.addEventListener('focus', refresh);
        return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
    }, []);
    const upcoming = useMemo(() => upcomingShowtimes(showtimes, movies, clock), [showtimes, movies, clock]);
    const scheduledIds = new Set(upcoming.map(movieIdOf));
    const featured = movies.find((movie) => movie.featured && scheduledIds.has(String(movie._id))) ||
        movies.find((movie) => scheduledIds.has(String(movie._id))) || movies.find((movie) => movie.featured) || movies[0];
    const featuredSession = featured && upcoming.find((session) => movieIdOf(session) === String(featured._id));
    const cinemas = [...new Set(upcoming.filter((session) => movieIdOf(session) === movieId).map((session) => session.cinema))];
    const sessions = upcoming.filter((session) => movieIdOf(session) === movieId && session.cinema === cinema);
    const selectedSession = sessions.find((session) => String(session._id) === showtimeId);
    const staff = ['admin', 'employee'].includes(user?.role);
    const filtered = movies.filter((movie) => {
        const matches = movie.title.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'));
        if (!matches) return false;
        if (filter === 'scheduled') return scheduledIds.has(String(movie._id));
        if (filter === 'coming') return new Date(movie.releaseDate).getTime() > clock;
        return true;
    });

    function details(movie) { setSelected(movie); setTab('movie-detail'); }
    function book(session) {
        if (new Date(session.startTime).getTime() <= Date.now() || availableSeats(session) === 0) {
            setClock(Date.now());
            setShowtimeId('');
            setBookingNotice('Suất chiếu vừa thay đổi hoặc đã qua giờ. Vui lòng chọn suất khác.');
            return;
        }
        setSelected(session);
        setTab('booking');
    }

    return <div className="cinemaHome">
        <div className="homeMasthead">
            <div><span className="homeKicker">CINEMA+ / KHÔNG GIAN ĐIỆN ẢNH</span><p>Một bộ phim. Nhiều cảm xúc.</p></div>
            <span className="homeDate">{new Date(clock).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'Asia/Bangkok' })}</span>
        </div>
        {dataError && <div className="homeNotice" role="alert"><div><strong>Chưa tải được dữ liệu rạp phim</strong><p>{dataError}</p></div><button type="button" onClick={onRetryData}>Thử lại <Arrow /></button></div>}
        <section className="homeFeature" aria-label="Phim tiêu điểm" aria-busy={dataLoading}>
            {featured && <div className="homeFeatureArt" aria-hidden="true"><img src={featured.banner?.startsWith('http') ? featured.banner : getMoviePoster(featured)} alt="" data-fallback={getMoviePoster(featured)} onError={imageFallback} /></div>}
            <div className="homeFeatureShade" />
            <div className="homeFeatureCopy">
                <span className="homeFeatureLabel"><span />{featuredSession ? 'ĐANG MỞ BÁN' : 'TIÊU ĐIỂM ĐIỆN ẢNH'}</span>
                <h1>{dataLoading && !featured ? 'Câu chuyện tiếp theo đang chờ…' : featured?.title || 'Hẹn bạn ở rạp phim.'}</h1>
                {featured && <div className="homeFilmMeta"><span className="homeAge">{classification(featured)}</span><span>{featured.duration} phút</span><span>{(featured.genre || []).slice(0, 2).map(translateGenre).join(' / ')}</span>{featured.rating > 0 && <span>★ {featured.rating}/10</span>}</div>}
                <p className="homeFeatureDescription">{featured?.description || 'Khám phá những câu chuyện mới, chọn suất chiếu phù hợp và dành một buổi tối cho màn ảnh rộng.'}</p>
                <div className="homeHeroActions">
                    <button className="homePrimary" type="button" disabled={dataLoading} onClick={() => featuredSession ? book(featuredSession) : featured ? details(featured) : setTab('movies')}>
                        {featuredSession ? (staff ? 'Bán vé tại quầy' : 'Đặt vé ngay') : featured ? 'Xem chi tiết phim' : 'Khám phá phim'} <Arrow />
                    </button>
                    <button className="homeSecondary" type="button" onClick={() => document.getElementById('home-movies')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}>Khám phá thêm</button>
                </div>
                {featuredSession && <p className="homeNextSession">Suất gần nhất · {formatTime(featuredSession.startTime)} · {featuredSession.cinema}</p>}
            </div>
            {featured && <button className="homeFeaturePoster" type="button" onClick={() => details(featured)} aria-label={'Xem chi tiết ' + featured.title}><img src={getMoviePoster(featured)} alt={featured.title} onError={imageFallback} /><span>PHIM TIÊU ĐIỂM <Arrow diagonal /></span></button>}
            <div className="homeFeatureNumber" aria-hidden="true">01 / CINEMA+</div>
        </section>

        <section className="homeQuickBooking" aria-labelledby="quick-booking-title">
            {bookingNotice && <p role="status" className="homeQuickHint">{bookingNotice}</p>}
            <div className="homeQuickHeading"><span className="homeKicker">CHỌN NHANH, XEM NGAY</span><h2 id="quick-booking-title">{staff ? 'Bán vé tại quầy' : 'Đặt vé nhanh'}</h2></div>
            <form onSubmit={(event) => { event.preventDefault(); if (selectedSession) book(selectedSession); }}>
                <label><span>01 / Phim</span><select value={movieId} onChange={(event) => { setMovieId(event.target.value); setCinema(''); setShowtimeId(''); }} disabled={dataLoading || !upcoming.length} required><option value="">Chọn bộ phim</option>{movies.filter((movie) => scheduledIds.has(String(movie._id))).map((movie) => <option key={movie._id} value={movie._id}>{movie.title}</option>)}</select></label>
                <label><span>02 / Rạp chiếu</span><select value={cinema} onChange={(event) => { setCinema(event.target.value); setShowtimeId(''); }} disabled={!movieId} required><option value="">Chọn rạp chiếu</option>{cinemas.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>03 / Suất chiếu</span><select value={showtimeId} onChange={(event) => setShowtimeId(event.target.value)} disabled={!cinema} required><option value="">Chọn ngày & giờ</option>{sessions.map((session) => <option key={session._id} value={session._id}>{formatTime(session.startTime)} · {Number(session.price).toLocaleString('vi-VN')}đ</option>)}</select></label>
                <button type="submit" className="homePrimary" disabled={!selectedSession}>Chọn ghế <Arrow /></button>
            </form>
            {!dataLoading && !upcoming.length && <p className="homeQuickHint">Hiện chưa có suất chiếu còn ghế sắp diễn ra. Bạn vẫn có thể xem thông tin phim bên dưới.</p>}
        </section>

        <section className="homeCatalogue" id="home-movies" aria-labelledby="home-catalogue-title">
            <div className="homeSectionHeading"><div><span className="homeKicker">TÌM MỘT CÂU CHUYỆN MỚI</span><h2 id="home-catalogue-title">Hôm nay, xem gì?</h2></div><button type="button" className="homeTextButton" onClick={() => setTab('movies')}>Tất cả phim <Arrow diagonal /></button></div>
            <div className="homeCatalogueTools"><div className="homeTabs" role="group" aria-label="Lọc danh sách phim">{[['all', 'Tất cả'], ['scheduled', 'Có lịch chiếu'], ['coming', 'Sắp ra mắt']].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div><input type="search" aria-label="Tìm phim trên trang chủ" placeholder="Tìm tên phim…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            {dataLoading && !movies.length ? <div className="homeEmpty" role="status">Đang tải danh sách phim…</div> : filtered.length ? <div className="homeMovieGrid">{filtered.slice(0, 8).map((movie, index) => {
                const next = upcoming.find((session) => movieIdOf(session) === String(movie._id));
                return <article className="homeMovieCard" key={movie._id}>
                    <button className="homeMovieImage" type="button" onClick={() => details(movie)} aria-label={'Chi tiết ' + movie.title}><img src={getMoviePoster(movie)} alt={movie.title} loading="lazy" onError={imageFallback} /><span className="homeCardIndex">{String(index + 1).padStart(2, '0')}</span><span className="homeCardAge">{classification(movie)}</span><span className="homeMovieImageOverlay">Xem chi tiết <Arrow diagonal /></span></button>
                    <div className="homeMovieInfo"><p>{(movie.genre || []).slice(0, 2).map(translateGenre).join(' · ') || 'Điện ảnh'} <span> / {movie.duration} phút</span></p><h3><button type="button" onClick={() => details(movie)}>{movie.title}</button></h3><div className="homeCardBottom"><span>{next ? 'Đang mở bán' : 'Chưa có suất chiếu'}</span><button type="button" onClick={() => next ? book(next) : details(movie)} aria-label={(next ? 'Đặt vé ' : 'Chi tiết ') + movie.title}>{next ? 'Đặt vé' : 'Chi tiết'} <Arrow /></button></div></div>
                </article>;
            })}</div> : <div className="homeEmpty">
                <h3>{filter === 'coming' && !query.trim() ? 'Chưa có phim sắp ra mắt' : movies.length ? 'Chưa tìm thấy bộ phim phù hợp' : 'Danh sách phim đang được cập nhật'}</h3>
                <p>{filter === 'coming' && !query.trim() ? 'Danh mục hiện chưa có phim có ngày khởi chiếu sau hôm nay. Lịch phim mới sẽ được cập nhật tại đây.' : movies.length ? 'Thử tên phim khác hoặc chọn lại bộ lọc.' : 'Quay lại sau để khám phá những bộ phim mới.'}</p>
                {filter === 'coming' && user?.role === 'admin' && <Link className="homeAdminAddMovie" to="/admin/movies/new">Thêm phim sắp ra mắt <Arrow /></Link>}
                {movies.length > 0 && <button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>Xem tất cả phim</button>}
            </div>}
            {filtered.length > 8 && <button type="button" className="homeMore" onClick={() => setTab('movies')}>Khám phá toàn bộ {filtered.length} phim <Arrow /></button>}
        </section>
        <section className="homeClosing"><div><span className="homeKicker">MÀN ẢNH LỚN. CẢM XÚC THẬT.</span><h2>Dành một buổi tối<br />cho điều bạn thích.</h2></div><p>Chọn phim, chọn ghế, tận hưởng.<br />CINEMA+ hẹn gặp bạn tại rạp.</p><button type="button" className="homeTextButton" onClick={() => setTab('movies')}>Tìm bộ phim của bạn <Arrow diagonal /></button></section>
        <footer className="homeFooter"><strong>CINEMA<span>+</span></strong><span>Không gian của những người yêu điện ảnh.</span><span>© {new Date(clock).getFullYear()} CINEMA+</span></footer>
    </div>;
}
