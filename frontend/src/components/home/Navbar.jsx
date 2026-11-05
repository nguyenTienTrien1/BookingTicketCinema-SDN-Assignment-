import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import '../../styles/home/home.css';

export default function Navbar({ tab, setTab, user, onSearch }) {
  const { logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  function handleProfileAndBookings() {
    setDropdownOpen(false);
    if (setTab) {
      setTab('account');
    }
  }

  async function handleLogout() {
    setDropdownOpen(false);
    try {
      if (logout) {
        await logout();
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
    if (setTab) {
      setTab('home');
    }
  }

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
          <div className="navUserWrapper" ref={dropdownRef}>
            <button
              type="button"
              className={`navUserBtn ${dropdownOpen ? 'open' : ''}`}
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              title="Tài khoản cá nhân"
            >
              <span className="navUserAvatar">
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
              </span>
              <span>{user.fullName || 'Tài khoản'}</span>
              <svg
                className={`navUserChevron ${dropdownOpen ? 'open' : ''}`}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="navUserDropdown" role="menu">
                <button
                  type="button"
                  className="navDropdownItem"
                  role="menuitem"
                  onClick={handleProfileAndBookings}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>Hồ sơ &amp; lịch sử đặt vé</span>
                </button>

                <div className="navDropdownDivider" />

                <button
                  type="button"
                  className="navDropdownItem logout"
                  role="menuitem"
                  onClick={handleLogout}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
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

