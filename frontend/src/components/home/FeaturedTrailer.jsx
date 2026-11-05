import { useState } from 'react';
import { translateGenre } from '../../utils/uiText';
import '../../styles/home/home.css';

export default function FeaturedTrailer({ movie }) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (!movie) return null;

  const backdrop =
    movie.banner ||
    movie.poster ||
    '/images/backdrops/jurassic_world.jpg';

  const year = movie.releaseDate
    ? new Date(movie.releaseDate).getFullYear()
    : '2018';

  const genreText = (movie.genre || ['Hành động', 'Phiêu lưu'])
    .slice(0, 3)
    .map(translateGenre)
    .join(' • ');

  // Extract clean YouTube embed URL
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

  const embedUrl = getEmbedUrl(movie.trailer);

  function handlePlayClick() {
    if (!embedUrl) return;
    setIsPlaying(true);
  }

  function handleCloseTrailer() {
    setIsPlaying(false);
  }

  return (
    <section
      id="featured-trailer-section"
      className="featuredTrailerSection"
      aria-label="Trailer phim tiêu điểm"
    >
      <div
        className="trailerPlayerContainer"
        style={{
          backgroundImage: !isPlaying ? `url('${backdrop}')` : 'none'
        }}
      >
        {isPlaying && embedUrl ? (
          /* 1. Embedded YouTube Player on Play */
          <div className="trailerIframeWrapper">
            <button
              type="button"
              className="trailerCloseBtn"
              onClick={handleCloseTrailer}
              aria-label="Đóng trailer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Đóng trailer</span>
            </button>

            <iframe
              src={embedUrl}
              title={`Trailer phim ${movie.title}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          /* 2. Initial Preview State (Before Play) */
          <div className="trailerBackdropOverlay">
            {/* Top Info */}
            <div className="trailerHeaderInfo">
              <div>
                <h3 className="trailerMovieTitle">
                  {movie.title} ({year})
                </h3>
                <div className="trailerMovieMeta">
                  {movie.rating > 0 && (
                    <span style={{ color: '#fbbf24', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="#fbbf24">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      {movie.rating.toFixed(1)}
                    </span>
                  )}
                  <span>•</span>
                  <span>{genreText}</span>
                  {movie.duration && (
                    <>
                      <span>•</span>
                      <span>{movie.duration} phút</span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Icons Top Right */}
              <div className="trailerActionIconGroup">
                <button
                  type="button"
                  className="trailerActionCircleBtn"
                  title="Yêu thích"
                  aria-label="Lưu phim yêu thích"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="trailerActionCircleBtn"
                  title="Thêm danh sách"
                  aria-label="Thêm vào danh sách xem"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Center Big Play Trigger */}
            <div
              className="trailerCenterPlayTrigger"
              onClick={handlePlayClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handlePlayClick();
              }}
              aria-label={embedUrl ? `Phát trailer ${movie.title}` : 'Trailer đang được cập nhật'}
            >
              {embedUrl ? (
                <>
                  <button
                    type="button"
                    className="trailerPlayBigBtn"
                    aria-hidden="true"
                    tabIndex={-1}
                  >
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </button>
                  <span className="trailerPlayPrompt">Xem Trailer Chính Thức</span>
                </>
              ) : (
                <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.6)', padding: '12px 24px', borderRadius: '30px' }}>
                  <span style={{ fontSize: '14px', color: '#cbd5e1' }}>Trailer đang được cập nhật</span>
                </div>
              )}
            </div>

            {/* Bottom Row */}
            <div className="trailerBottomRow">
              <span>Trải nghiệm rạp phim CINEMA+ với công nghệ âm thanh Dolby Atmos</span>
              <span>Độ phân giải 4K Ultra HD</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
