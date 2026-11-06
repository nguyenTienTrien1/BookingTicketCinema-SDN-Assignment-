import React, { useState, useMemo, useEffect } from 'react';
import '../../styles/home/showtimes.css';
import { getMoviePoster } from '../../components/MovieCard';
import { translateGenre } from '../../utils/uiText';

export default function Showtimes({
  showtimes = [],
  movies = [],
  setSelected,
  setTab,
  initialCinema = ''
}) {
  const [selectedCinema, setSelectedCinema] = useState(initialCinema || '');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [searchTitle, setSearchTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState('all');

  // Update cinema if passed from external navigation (e.g. from Cinemas page)
  useEffect(() => {
    if (initialCinema) {
      setSelectedCinema(initialCinema);
    }
  }, [initialCinema]);

  // Extract all distinct cinemas from existing showtimes + standard CINEMA+ hubs
  const cinemaList = useMemo(() => {
    const fromShowtimes = showtimes.map((st) => st.cinema).filter(Boolean);
    const standardCinemas = [
      'Cinema City',
      'CINEMA+ Landmark 81',
      'CINEMA+ Vincom Center Bà Triệu',
      'CINEMA+ Crescent Mall',
      'CINEMA+ Metropolis Liễu Giai',
      'CINEMA+ Vincom Ngô Quyền'
    ];
    return [...new Set([...fromShowtimes, ...standardCinemas])];
  }, [showtimes]);

  // Extract all distinct genres
  const genreList = useMemo(() => {
    return [...new Set(movies.flatMap((m) => m.genre || []))].sort();
  }, [movies]);

  // Helper to resolve full movie data for a showtime
  function resolveMovie(st) {
    if (st.movie && typeof st.movie === 'object' && st.movie.title) return st.movie;
    const mId = String(st.movie?._id || st.movie || '');
    return movies.find((m) => String(m._id) === mId) || null;
  }

  // Extract available dates from showtimes + upcoming 7 days
  const dateOptions = useMemo(() => {
    const list = [{ dateKey: 'all', dayName: 'Tất cả', dayStr: 'Các ngày' }];

    // Dates that have showtimes in DB
    const showtimeDates = new Set();
    showtimes.forEach((st) => {
      if (st.startTime) {
        try {
          const d = new Date(st.startTime);
          if (!isNaN(d.getTime())) {
            showtimeDates.add(d.toISOString().split('T')[0]);
          }
        } catch (_) {}
      }
    });

    // Also include today + next 6 days
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      showtimeDates.add(d.toISOString().split('T')[0]);
    }

    const sortedDates = Array.from(showtimeDates).sort();
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    sortedDates.forEach((isoDate) => {
      const d = new Date(isoDate + 'T00:00:00');
      const isToday = d.toDateString() === today.toDateString();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const isTomorrow = d.toDateString() === tomorrow.toDateString();

      const dayName = isToday ? 'Hôm nay' : isTomorrow ? 'Ngày mai' : dayNames[d.getDay()];
      const dayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

      list.push({ dateKey: isoDate, dayName, dayStr, rawDate: d });
    });

    return list;
  }, [showtimes]);

  // Filter showtimes according to user selections
  const filteredShowtimes = useMemo(() => {
    const query = searchTitle.trim().toLowerCase();

    return showtimes.filter((st) => {
      const movie = resolveMovie(st);
      if (!movie) return false;

      // 1. Movie title filter
      if (query && !String(movie.title || '').toLowerCase().includes(query)) {
        return false;
      }

      // 2. Cinema filter
      if (selectedCinema && st.cinema !== selectedCinema) {
        return false;
      }

      // 3. Genre filter
      if (selectedGenre && !(movie.genre || []).includes(selectedGenre)) {
        return false;
      }

      // 4. Date filter
      if (selectedDate !== 'all' && st.startTime) {
        const stDateIso = new Date(st.startTime).toISOString().split('T')[0];
        if (stDateIso !== selectedDate) {
          return false;
        }
      }

      return true;
    });
  }, [showtimes, movies, searchTitle, selectedCinema, selectedGenre, selectedDate]);

  // Group filtered showtimes by movie
  const groupedByMovie = useMemo(() => {
    const map = new Map();

    filteredShowtimes.forEach((st) => {
      const movie = resolveMovie(st);
      if (!movie) return;

      const movieId = String(movie._id);
      if (!map.has(movieId)) {
        map.set(movieId, { movie, showtimes: [] });
      }
      map.get(movieId).showtimes.push(st);
    });

    // Sort showtimes within each movie by start time
    map.forEach((item) => {
      item.showtimes.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    });

    return Array.from(map.values());
  }, [filteredShowtimes, movies]);

  // Total count of available showtime slots
  const totalSlotsCount = filteredShowtimes.length;

  function clearAllFilters() {
    setSelectedCinema('');
    setSelectedGenre('');
    setSearchTitle('');
    setSelectedDate('all');
  }

  function handleSelectShowtime(st, movie) {
    if (setSelected) {
      setSelected({ ...st, movie });
    }
    if (setTab) {
      setTab('booking');
    }
  }

  function handleOpenDetail(movie) {
    if (setSelected) {
      setSelected(movie);
    }
    if (setTab) {
      setTab('movie-detail');
    }
  }

  function formatTime(isoString) {
    if (!isoString) return '--:--';
    const d = new Date(isoString);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString('vi-VN') + 'đ';
  }

  // Count available seats in a showtime
  function countAvailableSeats(st) {
    if (!Array.isArray(st.seats)) return 40;
    return st.seats.filter((s) => s.status === 'available' || !s.status).length;
  }

  return (
    <section className="showtimesPage" aria-label="Lịch chiếu phim CINEMA+">
      {/* 1. Header */}
      <div className="showtimesHeading">
        <div>
          <p className="showtimesEyebrow">CINEMA+ · LỊCH CHIẾU HỆ THỐNG</p>
          <h1>Lịch chiếu toàn hệ thống</h1>
          <p>
            Xem lịch chiếu mới nhất, chọn cụm rạp và suất chiếu yêu thích để giữ chỗ ngay.
          </p>
        </div>
        <div className="showtimesSummaryCount" role="status">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>{totalSlotsCount} suất chiếu · {groupedByMovie.length} phim</span>
        </div>
      </div>

      {/* 2. Date Ribbon Selector */}
      <div className="dateRibbonContainer" role="region" aria-label="Chọn ngày chiếu">
        <div className="dateRibbonHeader">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Chọn ngày xem phim:</span>
        </div>
        <div className="dateRibbonTrack">
          {dateOptions.map((opt) => (
            <button
              key={opt.dateKey}
              type="button"
              className={`datePill ${selectedDate === opt.dateKey ? 'active' : ''}`}
              onClick={() => setSelectedDate(opt.dateKey)}
              aria-pressed={selectedDate === opt.dateKey}
            >
              <span className="datePillDay">{opt.dayName}</span>
              <span className="datePillDate">{opt.dayStr}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="showtimesFilterBar" role="search" aria-label="Bộ lọc lịch chiếu">
        <label>
          <span>Tìm tên phim</span>
          <input
            type="search"
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            placeholder="Nhập tên phim cần xem..."
            aria-label="Tìm kiếm phim theo tên"
          />
        </label>

        <label>
          <span>Cụm rạp</span>
          <select
            value={selectedCinema}
            onChange={(e) => setSelectedCinema(e.target.value)}
            aria-label="Lọc theo cụm rạp"
          >
            <option value="">Tất cả cụm rạp</option>
            {cinemaList.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Thể loại</span>
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            aria-label="Lọc theo thể loại"
          >
            <option value="">Tất cả thể loại</option>
            {genreList.map((g) => (
              <option key={g} value={g}>{translateGenre(g)}</option>
            ))}
          </select>
        </label>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <button
            type="button"
            className="showtimesResetBtn"
            onClick={clearAllFilters}
          >
            Xóa bộ lọc
          </button>
        </div>
      </div>

      {/* 4. Movie Showtimes Rows */}
      {groupedByMovie.length > 0 ? (
        <div className="movieShowtimesList">
          {groupedByMovie.map(({ movie, showtimes: movieShowtimes }) => {
            const poster = getMoviePoster(movie);
            const genreText = (movie.genre || []).map(translateGenre).join(', ');

            // Group this movie's showtimes by Cinema
            const byCinema = new Map();
            movieShowtimes.forEach((st) => {
              const cName = st.cinema || 'Cinema City';
              if (!byCinema.has(cName)) byCinema.set(cName, []);
              byCinema.get(cName).push(st);
            });

            return (
              <article key={movie._id} className="movieShowtimeCard">
                {/* Poster & Quick Info */}
                <div className="moviePosterCol">
                  {movie.classification && (
                    <span className="movieAgeBadge" title={`Phân loại độ tuổi: ${movie.classification}`}>
                      {movie.classification}
                    </span>
                  )}
                  <img
                    src={poster}
                    alt={movie.title}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/images/posters/rampage.jpg';
                    }}
                  />
                  <button
                    type="button"
                    className="movieDetailBtn"
                    onClick={() => handleOpenDetail(movie)}
                  >
                    Chi tiết phim
                  </button>
                </div>

                {/* Details & Showtimes Clusters */}
                <div className="movieShowtimeInfoCol">
                  <div className="movieTitleRow">
                    <div>
                      <h2 className="movieMainHeading">{movie.title}</h2>
                      <div className="movieMetaTags">
                        <span className="movieRatingStar">★ {movie.rating || '8.5'}</span>
                        <span>·</span>
                        {movie.duration && (
                          <>
                            <span className="movieDuration">{movie.duration} phút</span>
                            <span>·</span>
                          </>
                        )}
                        <span className="movieGenres">{genreText || 'Phim rạp'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Showtimes by Cinema */}
                  <div className="cinemaShowtimeClusters">
                    {Array.from(byCinema.entries()).map(([cName, slots]) => (
                      <div key={cName} className="cinemaClusterItem">
                        <h3 className="cinemaClusterName">
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span>{cName}</span>
                        </h3>

                        <div className="cinemaTimeSlotsGrid">
                          {slots.map((st) => {
                            const timeStr = formatTime(st.startTime);
                            const priceStr = formatCurrency(st.price || 80000);
                            const roomName = st.room || 'Phòng chiếu';
                            const availableSeats = countAvailableSeats(st);

                            return (
                              <button
                                key={st._id}
                                type="button"
                                className="showtimeSlotBtn"
                                onClick={() => handleSelectShowtime(st, movie)}
                                title={`Đặt vé suất ${timeStr} tại ${cName} - ${roomName}`}
                                aria-label={`Suất chiếu ${timeStr}, ${roomName}, giá ${priceStr}, còn ${availableSeats} ghế`}
                              >
                                <span className="slotTime">{timeStr}</span>
                                <span className="slotSubtitle">{roomName} · {priceStr}</span>
                                <span className="slotSeatsLeft">Còn {availableSeats} ghế</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="showtimesEmptyState" role="alert">
          <div className="emptyIconWrapper">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h3>Không tìm thấy suất chiếu phù hợp</h3>
          <p>
            Không có suất chiếu nào thỏa mãn các điều kiện lọc hiện tại. Bạn vui lòng chọn ngày khác hoặc xóa bớt tiêu chí lọc.
          </p>
          <button
            type="button"
            className="emptyResetBtn"
            onClick={clearAllFilters}
          >
            Xem tất cả suất chiếu có sẵn
          </button>
        </div>
      )}
    </section>
  );
}

