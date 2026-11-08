import { useState } from 'react';
import HeroBanner from '../../components/home/HeroBanner';
import TrendingMovies from '../../components/home/TrendingMovies';
import MovieGrid from '../../components/home/MovieGrid';
import Footer from '../../components/home/Footer';
import '../../styles/home/home.css';

// Helper to extract clean YouTube embed URL
function getEmbedUrl(raw) {
  if (!raw) return null;
  let videoId = '';

  if (raw.includes('youtube-nocookie.com/embed/')) {
    videoId = raw.split('embed/')[1]?.split('?')[0];
  } else if (raw.includes('youtube.com/watch?v=')) {
    videoId = raw.split('watch?v=')[1]?.split('&')[0];
  } else if (raw.includes('youtu.be/')) {
    videoId = raw.split('youtu.be/')[1]?.split('?')[0];
  } else if (/^[a-zA-Z0-9_-]{11}$/.test(raw.trim())) {
    videoId = raw.trim();
  }

  if (videoId) {
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
  }
  return raw;
}

export default function Home({
  movies = [],
  showtimes = [],
  setSelected,
  setTab,
  searchFilter = ''
}) {
  const [modalTrailerMovie, setModalTrailerMovie] = useState(null);

  // Handlers for movie card actions
  const handleBookMovie = (movie) => {
    setSelected(movie);
    setTab('booking');
  };

  const handleDetailMovie = (movie) => {
    setSelected(movie);
    setTab('movie-detail');
  };

  const handleWatchTrailer = (movie) => {
    if (movie) {
      setModalTrailerMovie(movie);
    }
  };

  return (
    <div className="cinemaHomeContainer">
      {/* 2. Full-width Hero Banner */}
      <HeroBanner
        movies={movies}
        showtimes={showtimes}
        onBookTicket={handleBookMovie}
        onWatchTrailer={handleWatchTrailer}
      />

      {/* 3. Phim Đang Chiếu (Now Showing Carousel) */}
      <TrendingMovies
        movies={movies}
        searchFilter={searchFilter}
        onBookMovie={handleBookMovie}
        onDetailMovie={handleDetailMovie}
      />

      {/* 4. Phim Sắp Chiếu (Coming Soon Grid) */}
      <MovieGrid
        movies={movies}
        searchFilter={searchFilter}
        onBookMovie={handleBookMovie}
        onDetailMovie={handleDetailMovie}
      />

      {/* Footer: Comprehensive Cinema+ Booking & Support Information */}
      <Footer setTab={setTab} />

      {/* Modal on demand when user clicks "Xem Trailer" */}
      {modalTrailerMovie && (
        <div
          className="trailerModalOverlay"
          onClick={() => setModalTrailerMovie(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Xem trailer phim"
        >
          <div className="trailerModalContent" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="trailerModalCloseBtn"
              onClick={() => setModalTrailerMovie(null)}
              aria-label="Đóng trailer"
            >
              ✕
            </button>
            <div className="trailerModalIframeWrapper">
              {getEmbedUrl(modalTrailerMovie.trailer) ? (
                <iframe
                  src={getEmbedUrl(modalTrailerMovie.trailer)}
                  title={`Trailer ${modalTrailerMovie.title || ''}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#fff',
                    fontSize: '16px'
                  }}
                >
                  Trailer đang được cập nhật
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
