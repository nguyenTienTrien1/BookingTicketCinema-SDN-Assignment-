import MovieExplorer from '../../components/MovieExplorer';

export default function Movies({ movies, setSelected, setTab }) {
    return (
        <section className="page">
            <MovieExplorer movies={movies} setSelected={setSelected} setTab={setTab} />
        </section>
    );
}
