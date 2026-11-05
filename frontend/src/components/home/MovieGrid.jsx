import { useState, useMemo } from 'react';
import MovieCard from './MovieCard';
import '../../styles/home/home.css';

const GENRE_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'Action', label: 'Hành động' },
  { key: 'Adventure', label: 'Phiêu lưu' },
  { key: 'Animation', label: 'Hoạt hình' },
  { key: 'Horror', label: 'Kinh dị' },
  { key: 'Drama', label: 'Tâm lý' },
  { key: 'Comedy', label: 'Hài' },
  { key: 'Sci-Fi', label: 'Khoa học viễn tưởng' },
  { key: 'Crime', label: 'Tội phạm' },
  { key: 'Fantasy', label: 'Giả tưởng' }
];

export default function MovieGrid({
  movies = [],
  loading = false,
  error = '',
  searchFilter = '',
  onBookMovie,
  onDetailMovie
}) {
  const [subTab, setSubTab] = useState('all'); // 'all' | 'featured' | 'soon'
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'az' | 'rating'

  // Filter and sort coming soon movies for the grid
  const displayedMovies = useMemo(() => {
    // 1. Filter to only coming soon movies
    let list = movies.filter((m) => {
      return (
        m.status === 'coming-soon' ||
        (m.releaseDate && new Date(m.releaseDate).getTime() > Date.now() + 14 * 24 * 60 * 60 * 1000)
      );
    });

    // 2. Sub-tab filter
    if (subTab === 'featured') {
      list = list.filter((m) => m.featured || (m.rating || 0) >= 8.0);
    } else if (subTab === 'soon') {
      list = [...list].sort((a, b) => {
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        return dateA - dateB;
      });
    }

    // 3. Genre Filter
    if (selectedGenre !== 'all') {
      list = list.filter((m) =>
        (m.genre || []).some((g) => g.toLowerCase() === selectedGenre.toLowerCase())
      );
    }

    // 4. Search Filter (if active from Navbar)
    if (searchFilter && searchFilter.trim()) {
      const query = searchFilter.trim().toLowerCase();
      list = list.filter((m) =>
        String(m.title || '').toLowerCase().includes(query) ||
        (m.genre || []).some((g) => g.toLowerCase().includes(query))
      );
    }

    // 5. Sorting
    list.sort((a, b) => {
      if (sortBy === 'az') {
        return String(a.title || '').localeCompare(String(b.title || ''), 'vi');
      }
      if (sortBy === 'rating') {
        return (b.rating || 0) - (a.rating || 0);
      }
      // 'newest' default
      const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return dateB - dateA;
    });

    return list;
  }, [movies, subTab, selectedGenre, searchFilter, sortBy]);

  return (
    <section id="movies-section" className="cinemaSection" aria-label="Phim Sắp Chiếu">
      {/* Section Header */}
      <div className="sectionHeaderRow">
        <h2 className="sectionHeading">
          
          <span>Phim Sắp Chiếu</span>
        </h2>

        {/* Sub Tabs: Tất cả / Nổi bật / Sắp ra mắt */}
        <div className="sectionSubTabs">
          <button
            type="button"
            className={`subTabBtn ${subTab === 'all' ? 'active' : ''}`}
            onClick={() => setSubTab('all')}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`subTabBtn ${subTab === 'featured' ? 'active' : ''}`}
            onClick={() => setSubTab('featured')}
          >
            Nổi bật
          </button>
          <button
            type="button"
            className={`subTabBtn ${subTab === 'soon' ? 'active' : ''}`}
            onClick={() => setSubTab('soon')}
          >
            Sắp ra mắt
          </button>
        </div>
      </div>

      {/* Genre Filter Pill Bar */}
      <div className="filterPillBar" role="tablist" aria-label="Bộ lọc thể loại">
        {GENRE_FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`filterPill ${selectedGenre === item.key ? 'active' : ''}`}
            onClick={() => setSelectedGenre(item.key)}
            role="tab"
            aria-selected={selectedGenre === item.key}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Controls Row: Results count & Sort Dropdown */}
      <div className="movieGridControlsRow">
        <span style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
          Hiển thị <strong>{displayedMovies.length}</strong> bộ phim sắp chiếu
          {searchFilter ? ` cho "${searchFilter}"` : ''}
        </span>

        <div className="sortSelectWrapper">
          <label htmlFor="movie-sort" className="sortSelectLabel">
            Sắp xếp theo:
          </label>
          <select
            id="movie-sort"
            className="sortSelectDropdown"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Mới nhất</option>
            <option value="az">Tên A–Z</option>
            <option value="rating">Đánh giá cao</option>
          </select>
        </div>
      </div>

      {/* Grid Content or States */}
      {error ? (
        <div className="emptyMovieState">
          <p className="emptyMovieStateTitle">Không thể tải danh sách phim</p>
          <p className="emptyMovieStateDesc">{error}</p>
        </div>
      ) : loading ? (
        /* Loading Skeletons */
        <div className="movieGridContainer">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeletonCard" />
          ))}
        </div>
      ) : displayedMovies.length > 0 ? (
        /* 6-Column Responsive Movie Grid */
        <div className="movieGridContainer">
          {displayedMovies.map((movie) => (
            <MovieCard
              key={movie._id}
              movie={movie}
              onBook={onBookMovie}
              onDetail={onDetailMovie}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="emptyMovieState">
          <p className="emptyMovieStateTitle">Không tìm thấy phim sắp chiếu nào</p>
          <p className="emptyMovieStateDesc">
            Không có phim sắp chiếu phù hợp với tiêu chí lọc của bạn. Hãy thử chọn thể loại khác hoặc từ khóa tìm kiếm.
          </p>
        </div>
      )}
    </section>
  );
}
