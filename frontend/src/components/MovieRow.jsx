import MovieCard from './MovieCard';
export default function MovieRow({ title, movies, onMovie, onDetail }) {
    return (
        <section className="section">
            <div className="sectionTitle">
                <h2>{title}</h2>
                <span>Xem tất cả →</span>
            </div>
            <div className="row">
                {movies.map((movie) => (
                    <MovieCard
                        key={movie._id}
                        movie={movie}
                        onClick={() => onMovie(movie)}
                        onDetail={() => onDetail(movie)}
                    />
                ))}
            </div>
        </section>
    );
}
