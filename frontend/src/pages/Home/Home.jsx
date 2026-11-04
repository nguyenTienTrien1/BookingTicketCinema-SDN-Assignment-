import MovieRow from '../../components/MovieRow';
import MovieExplorer from '../../components/MovieExplorer';

export default function Home({ movies, showtimes, setSelected, setTab }) {
    const hero = movies[0];
    const fallback = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1400&q=80';
    const choose = (movie) => {
        setSelected(movie);
        setTab('booking');
    };
    const showDetails = (movie) => {
        setSelected(movie);
        setTab('movie-detail');
    };

    return (
        <>
            <section className="hero" style={{ backgroundImage: `linear-gradient(90deg,#08090c 8%,rgba(8,9,12,.72) 40%,rgba(8,9,12,.15)),url('${hero?.banner || fallback}')` }}>
                <div className="heroText">
                    <span className="eyebrow">ĐANG KHỞI CHIẾU</span>
                    <h1>{hero?.title || 'Trải nghiệm điện ảnh'}</h1>
                    <p>{hero?.description || 'Khám phá phim mới và đặt chỗ chỉ trong vài giây.'}</p>
                    <div>
                        <button className="primary" onClick={() => { setSelected(showtimes[0]); setTab('booking'); }}>ĐẶT VÉ NGAY</button>
                        <button className="ghost" onClick={() => setTab('movies')}>KHÁM PHÁ PHIM</button>
                    </div>
                </div>
            </section>
            <MovieRow title="Phim nổi bật" movies={movies} onMovie={choose} onDetail={showDetails} />
            <MovieExplorer movies={movies} setSelected={setSelected} setTab={setTab} compact />
        </>
    );
}
