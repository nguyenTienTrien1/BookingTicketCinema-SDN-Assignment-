import { useState, useMemo, useRef } from 'react';
import { translateGenre } from '../../utils/uiText';
import Footer from '../../components/home/Footer';
import '../../styles/movieDetail/movieDetail.css';

// Extract YouTube embed URL helper
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

export default function MovieDetail({
  selected,
  movies = [],
  showtimes = [],
  setSelected,
  setTab
}) {
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const popularScrollRef = useRef(null);

  // Resolve current active movie from selected prop
  const currentMovie = useMemo(() => {
    if (!selected) return movies[0] || null;
    if (selected.title) return selected;
    if (selected.movie) {
      const mId = selected.movie._id || selected.movie;
      return movies.find((m) => String(m._id) === String(mId)) || selected.movie;
    }
    return movies.find((m) => String(m._id) === String(selected._id || selected)) || movies[0] || null;
  }, [selected, movies]);

  // List of other movies for "POPULAR THIS WEEK" carousel
  const otherMovies = useMemo(() => {
    if (!currentMovie) return movies.slice(0, 8);
    return movies
      .filter((m) => String(m._id) !== String(currentMovie._id))
      .slice(0, 10);
  }, [movies, currentMovie]);

  // Filter showtimes for this movie
  const showtimesList = useMemo(() => {
    if (!currentMovie) return [];
    return showtimes.filter((st) => {
      const movieId = st.movie?._id || st.movie;
      return String(movieId) === String(currentMovie._id);
    });
  }, [currentMovie, showtimes]);

  // Group showtimes by cinema
  const groupedShowtimes = useMemo(() => {
    return showtimesList.reduce((acc, st) => {
      const key = st.cinema || 'CINEMA+ Cụm Rạp Landmark';
      if (!acc[key]) acc[key] = [];
      acc[key].push(st);
      return acc;
    }, {});
  }, [showtimesList]);

  if (!currentMovie) {
    return (
      <div className="cinematicDetailPage" style={{ padding: '120px 24px 80px', textAlign: 'center' }}>
        <h2>Không tìm thấy thông tin phim</h2>
        <button
          type="button"
          className="detailPrimaryBtn"
          onClick={() => setTab('home')}
          style={{ marginTop: '20px' }}
        >
          Quay lại Trang chủ
        </button>
      </div>
    );
  }

  const isComingSoon =
    currentMovie.status === 'coming-soon' ||
    (currentMovie.releaseDate && new Date(currentMovie.releaseDate).getTime() > Date.now() + 14 * 24 * 60 * 60 * 1000);

  const backdropUrl =
    currentMovie.banner ||
    currentMovie.poster ||
    '/images/backdrops/stranger_things.jpg';

  const releaseYear = currentMovie.releaseDate
    ? new Date(currentMovie.releaseDate).getFullYear()
    : '2026';

  const genresTagline = (currentMovie.genre && currentMovie.genre.length > 0)
    ? currentMovie.genre.map(translateGenre).join('  |  ').toUpperCase()
    : 'ĐIỆN ẢNH  |  HÀNH ĐỘNG  |  PHIÊU LƯU';

  // Navigation handlers
  function handleSelectOtherMovie(other) {
    if (setSelected) {
      setSelected(other);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleScrollPopular(direction) {
    if (!popularScrollRef.current) return;
    const scrollAmount = 240;
    popularScrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }

  function handleBookTickets() {
    const section = document.getElementById('detail-showtimes');
    if (section && showtimesList.length > 0) {
      section.scrollIntoView({ behavior: 'smooth' });
    } else {
      setSelected(currentMovie);
      setTab('booking');
    }
  }

  function handleShowtimeSelect(st) {
    setSelected(st);
    setTab('booking');
  }

  return (
    <div className="cinematicDetailPage">
      {/* =========================================================================
          HERO CINEMATIC BANNER (Matching Netflix Desktop Reference)
          ========================================================================= */}
      <section
        className="detailHeroSection"
        style={{ backgroundImage: `url("${backdropUrl}")` }}
      >
        <div className="detailHeroOverlay" />

        {/* Hero Content (Left-aligned prominent typography) */}
        <div className="detailHeroContent">
          {/* Back navigation pill */}
          <button
            type="button"
            className="detailBackBreadcrumb"
            onClick={() => setTab('home')}
          >
            ← Quay lại Trang chủ
          </button>

          {/* Genre breadcrumbs matching THRILLER | HORROR | TEEN PROGRAM */}
          <p className="detailGenreTagline">{genresTagline}</p>

          {/* Giant Bold Movie Title */}
          <h1 className="detailMovieTitle">{currentMovie.title}</h1>

          {/* Metadata Line matching 2019 | DIRECTOR: ... | SEASONS: ... */}
          <div className="detailMetaLine">
            <span className="metaYear">{releaseYear}</span>
            <span className="metaSep">|</span>
            <span className="metaItem">
              <strong>THỜI LƯỢNG:</strong> {currentMovie.duration || 120} PHÚT
            </span>
            <span className="metaSep">|</span>
            <span className="metaItem">
              <span className="metaRatingStar">⭐</span>
              <strong>ĐÁNH GIÁ:</strong> {currentMovie.rating ? currentMovie.rating.toFixed(1) : '8.5'}/10
            </span>
            <span className="metaSep">|</span>
            <span className="metaItem">
              <strong>TRẠNG THÁI:</strong> {isComingSoon ? 'SẮP KHỞI CHIẾU' : 'ĐANG CÔNG CHIẾU'}
            </span>
          </div>

          {/* Description Paragraph */}
          <p className="detailSynopsis">
            {currentMovie.description ||
              'Bộ phim điện ảnh đặc sắc với kỹ xảo hoành tráng, công nghệ âm thanh vòm sống động mang lại trải nghiệm rạp chiếu chuẩn quốc tế.'}
          </p>

          {/* Action Buttons Row */}
          <div className="detailActionRow">
            {!isComingSoon ? (
              <button
                type="button"
                className="detailPrimaryBtn"
                onClick={handleBookTickets}
              >
                <span className="btnPlayIcon">🎟</span>
                <span>ĐẶT VÉ NGAY</span>
              </button>
            ) : (
              <button
                type="button"
                className="detailPrimaryBtn"
                onClick={() => setIsTrailerOpen(true)}
              >
                <span className="btnPlayIcon">▶</span>
                <span>XEM TRAILER</span>
              </button>
            )}

            <button
              type="button"
              className="detailSecondaryBtn"
              onClick={() => setIsTrailerOpen(true)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>XEM TRAILER</span>
            </button>

            {showtimesList.length > 0 && (
              <button
                type="button"
                className="detailSecondaryBtn"
                onClick={() => {
                  const el = document.getElementById('detail-showtimes');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect width="18" height="18" x="3" y="4" rx="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
                <span>XEM LỊCH CHIẾU ({showtimesList.length})</span>
              </button>
            )}
          </div>

          {/* Bottom-Left: POPULAR THIS WEEK / XU HƯỚNG TUẦN NÀY */}
          <div className="detailPopularSection">
            <div className="detailPopularHeader">
              <h3 className="detailPopularTitle">XU HƯỚNG TUẦN NÀY</h3>
              <div className="popularNavArrows">
                <button
                  type="button"
                  className="popularArrowBtn"
                  onClick={() => handleScrollPopular('left')}
                  aria-label="Cuộn sang trái"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="popularArrowBtn"
                  onClick={() => handleScrollPopular('right')}
                  aria-label="Cuộn sang phải"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="popularTrack" ref={popularScrollRef}>
              {otherMovies.map((other) => (
                <button
                  key={other._id}
                  type="button"
                  className="popularMovieCard"
                  onClick={() => handleSelectOtherMovie(other)}
                  title={other.title}
                >
                  <div className="popularPosterWrapper">
                    <img
                      src={other.poster || other.banner}
                      alt={other.title}
                      className="popularPosterImg"
                      loading="lazy"
                    />
                  </div>
                  <span className="popularMovieName">{other.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Floating Right Bottom Age Rating Badge (Matching 16+ badge in reference) */}
        <div className="floatingAgeBadge">
          <div className="ageBadgeAccent" />
          <span className="ageBadgeText">
            {currentMovie.ageLimit ? `${currentMovie.ageLimit}+` : '16+'}
          </span>
        </div>
      </section>

      {/* =========================================================================
          SHOWTIMES SECTION (Suất Chiếu Tại Các Cụm Rạp)
          ========================================================================= */}
      <section id="detail-showtimes" className="detailShowtimeSection">
        <div className="showtimeSectionHeading">
          <h2 className="showtimeSectionTitle">
           
            <span>Suất Chiếu &amp; Đặt Vé Rạp</span>
          </h2>
          <span className="showtimeNotice">
            {isComingSoon
              ? 'Phim sắp khởi chiếu — Lịch chiếu mở trước 3 ngày'
              : 'Chọn suất chiếu phù hợp để tiến hành giữ chỗ và chọn ghế'}
          </span>
        </div>

        {isComingSoon ? (
          <div className="comingSoonShowtimeCard">
            <span className="comingSoonIcon">⏳</span>
            <h3 className="comingSoonCardTitle">Phim Sắp Khởi Chiếu</h3>
            <p className="comingSoonCardDesc">
              Bộ phim <strong>{currentMovie.title}</strong> dự kiến ra mắt khán giả vào ngày{' '}
              {currentMovie.releaseDate
                ? new Date(currentMovie.releaseDate).toLocaleDateString('vi-VN')
                : 'sắp tới'}.
              Hệ thống rạp CINEMA+ sẽ mở cổng đặt vé sớm trước ngày khởi chiếu 3–5 ngày.
            </p>
            <button
              type="button"
              className="detailPrimaryBtn"
              onClick={() => setIsTrailerOpen(true)}
              style={{ marginTop: '12px' }}
            >
              <span>Xem Trailer Chính Thức</span>
            </button>
          </div>
        ) : Object.keys(groupedShowtimes).length === 0 ? (
          <div className="comingSoonShowtimeCard">
            <span className="comingSoonIcon">🎟</span>
            <h3 className="comingSoonCardTitle">Chưa Có Suất Chiếu Trực Tiếp Hôm Nay</h3>
            <p className="comingSoonCardDesc">
              Hiện tại chưa có suất chiếu hôm nay cho bộ phim này hoặc tất cả các phòng chiếu đã hoàn thành lịch chiếu.
              Bạn có thể xem trước trailer hoặc quay lại đặt vé rạp khác.
            </p>
            <button
              type="button"
              className="detailSecondaryBtn"
              onClick={() => setTab('booking')}
              style={{ marginTop: '12px' }}
            >
              <span>Xem Tất Cả Lịch Chiếu Khác</span>
            </button>
          </div>
        ) : (
          <div className="cinemaShowtimesGrid">
            {Object.entries(groupedShowtimes).map(([cinemaName, slots]) => (
              <div key={cinemaName} className="cinemaShowtimeCard">
                <div className="cinemaNameHeader">
                  <h3 className="cinemaNameText">{cinemaName}</h3>
                  <span className="cinemaFormatBadge">2D Phụ Đề</span>
                </div>
                <div className="showtimeSlotList">
                  {slots.map((st) => (
                    <button
                      key={st._id}
                      type="button"
                      className="showtimeSlotBtn"
                      onClick={() => handleShowtimeSelect(st)}
                      title={`Đặt vé suất ${new Date(st.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} tại ${cinemaName}`}
                    >
                      <span className="slotTime">
                        {new Date(st.startTime).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <span className="slotPrice">
                        {(st.price || 80000).toLocaleString('vi-VN')}₫
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =========================================================================
          MODAL TRAILER POPUP (On-demand Video Preview)
          ========================================================================= */}
      {isTrailerOpen && (
        <div
          className="trailerModalOverlay"
          onClick={() => setIsTrailerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Xem trailer phim"
        >
          <div className="trailerModalContent" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="trailerModalCloseBtn"
              onClick={() => setIsTrailerOpen(false)}
              aria-label="Đóng trailer"
            >
              ✕
            </button>
            <div className="trailerModalIframeWrapper">
              {getEmbedUrl(currentMovie.trailer) ? (
                <iframe
                  src={getEmbedUrl(currentMovie.trailer)}
                  title={`Trailer ${currentMovie.title}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#fff',
                    gap: '12px'
                  }}
                >
                  <span style={{ fontSize: '32px' }}>🎬</span>
                  <p style={{ margin: 0, fontSize: '16px' }}>
                    Trailer của phim <strong>{currentMovie.title}</strong> hiện đang được cập nhật!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          FOOTER COMPONENT
          ========================================================================= */}
      <Footer setTab={setTab} />
    </div>
  );
}
