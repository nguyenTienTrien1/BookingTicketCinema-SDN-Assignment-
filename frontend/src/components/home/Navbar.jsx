import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../styles/home/home.css';

export default function Navbar({ tab, setTab, user, onSearch }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isAdmin = user?.role === 'admin';

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
    navigate('/');
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
      const section = document.getElementById('movies-section');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  function handleNav(targetTab, anchorId) {
    if (setTab) {
      setTab(targetTab);
    }
    if (targetTab === 'home' && anchorId) {
      const el = document.getElementById(anchorId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <header className={`cinematicNavbar ${scrolled ? 'scrolled' : ''} ${isAdmin ? 'adminNavbar' : ''}`}>
      {/* 1. Brand Logo */}
      <button
        type="button"
        className="cinematicNavBrand"
        onClick={() => {
          if (isAdmin) {
            if (setTab) setTab('account');
            navigate('/account');
          } else {
            handleNav('home', 'hero-section');
          }
        }}
        aria-label={isAdmin ? 'Trung tâm Quản trị CINEMA+' : 'Trang chủ CINEMA+'}
      >
        <span className="brandLogo">
          CINEMA<span>+</span>
        </span>
        {isAdmin && <span className="adminNavBadge">ADMIN</span>}
      </button>

      {/* 2. Center Nav Items */}
      <nav aria-label={isAdmin ? 'Điều hướng quản trị' : 'Điều hướng chính'}>
        {isAdmin ? (
          /* =========================================================
             ADMIN NAVIGATION (Replaces customer Home, Movies, etc.)
             ========================================================= */
          <ul className="cinematicNavLinks adminNavLinks">
            <li>
              <button
                type="button"
                className={`cinematicNavLink ${tab === 'account' ? 'active' : ''}`}
                onClick={() => {
                  if (setTab) setTab('account');
                  navigate('/account');
                }}
              >
                Bảng điều khiển
              </button>
            </li>
            <li>
              <button
                type="button"
                className="cinematicNavLink"
                onClick={() => navigate('/admin/movies')}
              >
                Quản lý Phim
              </button>
            </li>
            <li>
              <button
                type="button"
                className="cinematicNavLink"
                onClick={() => navigate('/admin/showtimes')}
              >
                Suất chiếu
              </button>
            </li>
            <li>
              <button
                type="button"
                className="cinematicNavLink"
                onClick={() => navigate('/admin/rooms')}
              >
                Phòng chiếu
              </button>
            </li>
            <li>
              <button
                type="button"
                className="cinematicNavLink"
                onClick={() => navigate('/admin/foods')}
              >
                Bắp nước
              </button>
            </li>
            <li>
              <button
                type="button"
                className="cinematicNavLink"
                onClick={() => navigate('/admin/promotions')}
              >
                Khuyến mãi
              </button>
            </li>
            <li>
              <button
                type="button"
                className="cinematicNavLink"
                onClick={() => navigate('/admin/revenue')}
              >
                Doanh thu
              </button>
            </li>
          </ul>
        ) : (
          /* =========================================================
             CUSTOMER NAVIGATION (For members & guests)
             ========================================================= */
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
                className={`cinematicNavLink ${tab === 'showtimes' ? 'active' : ''}`}
                onClick={() => handleNav('showtimes')}
              >
                Lịch chiếu
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`cinematicNavLink ${tab === 'cinemas' ? 'active' : ''}`}
                onClick={() => handleNav('cinemas')}
              >
                Rạp chiếu
              </button>
            </li>
          </ul>
        )}
      </nav>

      {/* 3. Right Action Items */}
      <div className="cinematicNavActions">
        {isAdmin ? (
          /* =========================================================
             ADMIN RIGHT ACTIONS (No customer search, has switch view)
             ========================================================= */
          <>
            {tab === 'account' ? (
              <button
                type="button"
                className="navViewToggleBtn"
                onClick={() => {
                  if (setTab) setTab('home');
                  navigate('/');
                }}
                title="Xem giao diện khách hàng"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>Xem trang khách</span>
              </button>
            ) : (
              <button
                type="button"
                className="navViewToggleBtn active"
                onClick={() => {
                  if (setTab) setTab('account');
                  navigate('/account');
                }}
                title="Trở về Trung tâm Quản trị"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="7" height="9" x="3" y="3" rx="1" />
                  <rect width="7" height="5" x="14" y="3" rx="1" />
                  <rect width="7" height="9" x="14" y="12" rx="1" />
                  <rect width="7" height="5" x="3" y="16" rx="1" />
                </svg>
                <span>Về Bảng Quản trị</span>
              </button>
            )}

            {/* Admin Profile Dropdown */}
            <div className="navUserWrapper" ref={dropdownRef}>
              <button
                type="button"
                className={`navUserBtn adminUserBtn ${dropdownOpen ? 'open' : ''}`}
                onClick={() => setDropdownOpen((prev) => !prev)}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
                title="Tài khoản Quản trị viên"
              >
                <span className="navUserAvatar adminAvatar">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'A'}
                </span>
                <span className="navAdminLabelWrap">
                  <span className="navAdminName">{user.fullName || 'Cinema Admin'}</span>
                  <span className="navAdminRoleTag">Quản trị viên</span>
                </span>
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
                    onClick={() => {
                      setDropdownOpen(false);
                      if (setTab) setTab('account');
                      navigate('/account');
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect width="7" height="9" x="3" y="3" rx="1" />
                      <rect width="7" height="5" x="14" y="3" rx="1" />
                      <rect width="7" height="9" x="14" y="12" rx="1" />
                      <rect width="7" height="5" x="3" y="16" rx="1" />
                    </svg>
                    <span>Bảng điều khiển quản trị</span>
                  </button>

                  <button
                    type="button"
                    className="navDropdownItem"
                    role="menuitem"
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate('/staff/tools');
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect width="20" height="14" x="2" y="5" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                    <span>Bán vé &amp; Quầy thu tiền</span>
                  </button>

                  <div className="navDropdownDivider" />

                  <button
                    type="button"
                    className="navDropdownItem logout"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* =========================================================
             CUSTOMER RIGHT ACTIONS (Search, Bell, User/Login)
             ========================================================= */
          <>
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
          </>
        )}
      </div>
    </header>
  );
}
