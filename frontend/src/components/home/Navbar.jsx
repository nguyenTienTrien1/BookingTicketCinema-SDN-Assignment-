import { useState, useEffect } from 'react';
import '../../styles/home/home.css';

export default function Navbar({ tab, setTab, user, onSearch }) {
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    function handleScroll() {
      if (window.scrollY > 40) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  function handleSearchSubmit(e) {
    if (e.key === 'Enter' || e.type === 'submit') {
      e.preventDefault();
      if (onSearch) {
        onSearch(searchQuery);
      }
      // Scroll to movies section smoothly
      const section = document.getElementById('movies-section');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  function handleNav(targetTab, anchorId) {
    if (tab !== 'home' && targetTab === 'home') {
      setTab('home');
      return;
    }
    if (targetTab === 'movies') {
      setTab('movies');
      return;
    }
    if (targetTab === 'booking') {
      setTab('booking');
      return;
    }
    if (anchorId) {
      const el = document.getElementById(anchorId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  return (
    <header className={`cinematicNavbar ${scrolled ? 'scrolled' : ''}`}>
      {/* 1. Brand Logo */}
      <button
        type="button"
        className="cinematicNavBrand"
        onClick={() => setTab('home')}
        aria-label="Trang chủ CINEMA+"
      >
        <span className="brandLogo">
          CINEMA<span>+</span>
        </span>
      </button>

      {/* 2. Center Nav Items */}
      <nav aria-label="Điều hướng chính">
        <ul className="cinematicNavLinks">
          <li>
            <button
              type="button"
              className={`cinematicNavLink ${tab === 'home' ? 'active' : ''}`}
              onClick={() => handleNav('home', 'hero-section')}
            >
              Trang chủ
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`cinematicNavLink ${tab === 'movies' ? 'active' : ''}`}
              onClick={() => handleNav('movies', 'movies-section')}
            >
              Phim
            </button>
          </li>
          <li>
            <button
              type="button"
              className="cinematicNavLink"
              onClick={() => handleNav('home', 'trending-section')}
            >
              Lịch chiếu
            </button>
          </li>
          <li>
            <button
              type="button"
              className="cinematicNavLink"
              onClick={() => handleNav('home', 'trailer-section')}
            >
              Rạp chiếu
            </button>
          </li>
        </ul>
      </nav>

      {/* 3. Right Action Items */}
      <div className="cinematicNavActions">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="navSearchWrapper">
          <svg
            className="navSearchIcon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="navSearchInput"
            placeholder="Tìm kiếm phim..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (onSearch) onSearch(e.target.value);
            }}
            onKeyDown={handleSearchSubmit}
            aria-label="Tìm kiếm phim"
          />
        </form>

        {/* Notification Bell */}
        <button
          type="button"
          className="navIconBtn"
          title="Thông báo"
          aria-label="Thông báo ưu đãi rạp phim"
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        {/* User Profile or Login Button */}
        {user ? (
          <button
            type="button"
            className="navUserBtn"
            onClick={() => setTab('account')}
            title="Tài khoản cá nhân"
          >
            <span className="navUserAvatar">
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
            </span>
            <span>{user.fullName || 'Tài khoản'}</span>
          </button>
        ) : (
          <button
            type="button"
            className="navLoginBtn"
            onClick={() => setTab('login')}
          >
            Đăng nhập
          </button>
        )}
      </div>
    </header>
  );
}

