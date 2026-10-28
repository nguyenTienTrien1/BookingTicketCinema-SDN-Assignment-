import { useState, useMemo, useRef } from 'react';
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
  { key: 'Sci-Fi', label: 'Khoa học viễn tưởng' }
];

export default function TrendingMovies({
  movies = [],
  searchFilter = '',
  onBookMovie,
  onDetailMovie
}) {
  const [activeTab, setActiveTab] = useState('popular'); // 'popular' | 'topRated' | 'latest'
  const [activeGenre, setActiveGenre] = useState('all');
  const scrollRef = useRef(null);

  // Filter & sort now-showing movies
  const nowShowingList = useMemo(() => {
    // 1. Only movies currently showing
    let result = movies.filter((m) => m.status !== 'coming-soon');

    // 2. Search query filter
    if (searchFilter && searchFilter.trim()) {
      const query = searchFilter.trim().toLowerCase();
      result = result.filter((m) =>
        String(m.title || '').toLowerCase().includes(query) ||
        (m.genre || []).some((g) => g.toLowerCase().includes(query))
      );
    }

    // 3. Filter by genre
    if (activeGenre !== 'all') {
      result = result.filter((m) =>
        (m.genre || []).some((g) => g.toLowerCase() === activeGenre.toLowerCase())
      );
    }

    // 4. Sort by tab
    if (activeTab === 'popular') {
      result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.rating || 0) - (a.rating || 0));
    } else if (activeTab === 'topRated') {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (activeTab === 'latest') {
      result.sort((a, b) => {
        const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
        const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
        return dateB - dateA;
      });
    }

    return result;
  }, [movies, searchFilter, activeGenre, activeTab]);

  function handleScroll(direction) {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }

  return (
    <section id="trending-section" className="cinemaSection" aria-label="Phim Đang Chiếu">
      {/* Header Row */}
      <div className="sectionHeaderRow">
        <h2 className="sectionHeading">
         
          <span>Phim Đang Chiếu</span>
        </h2>

        {/* Tab Filters */}
        <div className="sectionSubTabs">
          <button
            type="button"
            className={`subTabBtn ${activeTab === 'popular' ? 'active' : ''}`}
            onClick={() => setActiveTab('popular')}
          >
            Phổ biến
          </button>
          <button
            type="button"
            className={`subTabBtn ${activeTab === 'topRated' ? 'active' : ''}`}
            onClick={() => setActiveTab('topRated')}
          >
            Đánh giá cao
          </button>
          <button
            type="button"
            className={`subTabBtn ${activeTab === 'latest' ? 'active' : ''}`}
            onClick={() => setActiveTab('latest')}
          >
            Mới cập nhật
          </button>
        </div>
      </div>

      {/* Horizontal Category Pill Bar */}
      <div className="filterPillBar" role="tablist" aria-label="Thể loại phim">
        {GENRE_FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`filterPill ${activeGenre === item.key ? 'active' : ''}`}
            onClick={() => setActiveGenre(item.key)}
            role="tab"
            aria-selected={activeGenre === item.key}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Horizontal Carousel */}
      <div className="carouselWrapper">
        {/* Prev Arrow */}
        <button
          type="button"
          className="carouselNavBtn prev"
          onClick={() => handleScroll('left')}
          aria-label="Cuộn sang trái"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Track */}
        <div className="carouselTrack" ref={scrollRef}>
          {nowShowingList.length > 0 ? (
            nowShowingList.map((movie) => (
              <MovieCard
                key={movie._id}
                movie={movie}
                onBook={onBookMovie}
                onDetail={onDetailMovie}
              />
            ))
          ) : (
            <div className="emptyMovieState" style={{ width: '100%' }}>
              <p className="emptyMovieStateTitle">Không tìm thấy phim đang chiếu phù hợp</p>
              <p className="emptyMovieStateDesc">Vui lòng thử chọn thể loại khác hoặc từ khóa tìm kiếm khác.</p>
            </div>
          )}
        </div>

        {/* Next Arrow */}
        <button
          type="button"
          className="carouselNavBtn next"
          onClick={() => handleScroll('right')}
          aria-label="Cuộn sang phải"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </section>
  );
}
