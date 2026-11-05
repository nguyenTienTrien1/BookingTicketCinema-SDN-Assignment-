import { useState, useEffect, useRef } from 'react';
import { translateGenre } from '../../utils/uiText';
import '../../styles/home/home.css';

export default function HeroBanner({ movies = [], showtimes = [], onBookTicket, onWatchTrailer }) {
  // Prioritize Rampage first (matching reference image), followed by other featured movies
  const rampageMovie = movies.find((m) => String(m.title || '').toLowerCase().includes('rampage'));
  const otherFeatured = movies.filter(
    (m) => (m.banner || m.featured) && m._id !== rampageMovie?._id
  );
  const heroList = rampageMovie
    ? [rampageMovie, ...otherFeatured].slice(0, 5)
    : movies.slice(0, 5);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  const currentMovie = heroList[currentIndex] || movies[0] || null;

  // Auto slide every 6 seconds, pausing on hover or if user prefers reduced motion
  useEffect(() => {
    if (heroList.length <= 1 || isPaused) return;

    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % heroList.length);
    }, 6000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [heroList.length, isPaused]);

  if (!currentMovie) return null;

  const backdropUrl =
    currentMovie.banner ||
    currentMovie.poster ||
    '/images/backdrops/rampage.jpg';

  const year = currentMovie.releaseDate
    ? new Date(currentMovie.releaseDate).getFullYear()
    : '2026';

  const genreText = (currentMovie.genre || ['Hành động'])
    .slice(0, 3)
    .map(translateGenre)
    .join(' • ');

  const durationText = currentMovie.duration ? `${currentMovie.duration} phút` : '120 phút';

  function handleWatchTrailerClick() {
    if (onWatchTrailer) {
      onWatchTrailer(currentMovie);
    } else {
      // Scroll smoothly to Section 5
      const trailerSection = document.getElementById('featured-trailer-section');
      if (trailerSection) {
        trailerSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  function handleBookTicketClick() {
    if (onBookTicket) {
      onBookTicket(currentMovie);
    }
  }

  return (
    <section
      id="hero-section"
      className="cinemaHeroBanner"
      style={{ backgroundImage: `url('${backdropUrl}')` }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Phim nổi bật"
    >
      {/* Cinematic Dual Gradient Overlays */}
      <div className="heroGradientOverlayLeft" />
      <div className="heroGradientOverlayBottom" />

      {/* Hero Movie Content */}
      <div className="heroContent">
        {/* Metadata tag */}
        <div className="heroMetaTag">
          <span>{year} • {genreText} • {durationText}</span>
          {currentMovie.rating > 0 && (
            <span className="heroRatingBadge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#ff4757">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {currentMovie.rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Large Title */}
        <h1 className="heroTitle">{currentMovie.title}</h1>

        {/* Short Description */}
        <p className="heroDescription">
          {currentMovie.description ||
            'Trải nghiệm điện ảnh đỉnh cao với chất lượng hình ảnh và âm thanh sống động tại rạp chiếu CINEMA+.'}
        </p>

        {/* Action Buttons */}
        <div className="heroActionGroup">
          <button
            type="button"
            className="heroBtnWatch"
            onClick={handleWatchTrailerClick}
            aria-label={`Xem trailer phim ${currentMovie.title}`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>Xem Trailer</span>
          </button>

          <button
            type="button"
            className="heroBtnBook"
            onClick={handleBookTicketClick}
            aria-label={`Đặt vé xem phim ${currentMovie.title}`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="15" x="2" y="5" rx="2" />
              <line x1="2" x2="22" y1="10" y2="10" />
            </svg>
            <span>Đặt Vé Ngay</span>
          </button>
        </div>
      </div>

      {/* Hero Carousel Navigation Indicators */}
      {heroList.length > 1 && (
        <div className="heroIndicators" role="tablist" aria-label="Danh sách phim nổi bật">
          {heroList.map((movie, idx) => (
            <button
              key={movie._id || idx}
              type="button"
              className={`heroIndicatorDot ${idx === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Chuyển đến phim ${movie.title}`}
              aria-selected={idx === currentIndex}
              role="tab"
            />
          ))}
        </div>
      )}
    </section>
  );
}
