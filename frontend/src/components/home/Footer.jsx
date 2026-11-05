import React from 'react';
import '../../styles/home/home.css';

export default function Footer({ setTab }) {
  function handleNav(tabName) {
    if (setTab) {
      setTab(tabName);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <footer className="cinematicFooter" aria-label="Chân trang CINEMA+">
      <div className="footerTopContainer">
        {/* Cột 1: Thông tin thương hiệu */}
        <div className="footerBrandCol">
          <div className="footerLogo">
            CINEMA<span>+</span>
          </div>
          <p className="footerTagline">
            Hệ thống rạp chiếu phim hiện đại hàng đầu với công nghệ hình ảnh IMAX Laser, âm thanh vòm Dolby Atmos đỉnh cao và trải nghiệm đặt vé trực tuyến nhanh chóng, tiện lợi.
          </p>
          <div className="footerContactList">
            <div className="footerContactItem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span>Hotline đặt vé: <strong>1900 6868</strong> (8:00 - 22:00)</span>
            </div>
            <div className="footerContactItem">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <span>Email hỗ trợ: <strong>cskh@cinema.com.vn</strong></span>
            </div>
          </div>
        </div>

        {/* Cột 2: Khám phá phim */}
        <div className="footerNavCol">
          <h4 className="footerColTitle">Khám Phá Phim</h4>
          <ul className="footerLinksList">
            <li>
              <button type="button" onClick={() => handleNav('movies')}>
                Phim đang chiếu
              </button>
            </li>
            <li>
              <button type="button" onClick={() => handleNav('movies')}>
                Phim sắp chiếu
              </button>
            </li>
            <li>
              <button type="button" onClick={() => handleNav('movies')}>
                Suất chiếu đặc biệt (Sneak Show)
              </button>
            </li>
            <li>
              <button type="button" onClick={() => handleNav('showtimes')}>
                Lịch chiếu theo rạp
              </button>
            </li>
            <li>
              <button type="button" onClick={() => handleNav('cinemas')}>
                Hệ thống rạp chiếu
              </button>
            </li>
            <li>
              <button type="button" onClick={() => handleNav('home')}>
                Ưu đãi & Khuyến mãi thành viên
              </button>
            </li>
          </ul>
        </div>

        {/* Cột 3: Hỗ trợ & Điều khoản */}
        <div className="footerNavCol">
          <h4 className="footerColTitle">Hỗ Trợ & Điều Khoản</h4>
          <ul className="footerLinksList">
            <li><a href="#terms" onClick={(e) => e.preventDefault()}>Quy chế hoạt động rạp</a></li>
            <li><a href="#terms" onClick={(e) => e.preventDefault()}>Điều khoản sử dụng dịch vụ</a></li>
            <li><a href="#terms" onClick={(e) => e.preventDefault()}>Chính sách bảo mật thông tin</a></li>
            <li><a href="#terms" onClick={(e) => e.preventDefault()}>Chính sách hoàn hủy vé</a></li>
            <li><a href="#terms" onClick={(e) => e.preventDefault()}>Câu hỏi thường gặp (FAQ)</a></li>
          </ul>
        </div>

        {/* Cột 4: Hệ thống rạp & Kết nối */}
        <div className="footerNavCol">
          <h4 className="footerColTitle">Cụm Rạp Toàn Quốc</h4>
          <ul className="footerTheatersList">
            <li>
              <strong>CINEMA+ Landmark 81</strong>
              <span>Tầng B1, TTTM Vincom Landmark 81, TP. HCM</span>
            </li>
            <li>
              <strong>CINEMA+ Metropolis</strong>
              <span>Tầng 3, 29 Liễu Giai, Ba Đình, Hà Nội</span>
            </li>
            <li>
              <strong>CINEMA+ Riverside</strong>
              <span>74 Bạch Đằng, Hải Châu, Đà Nẵng</span>
            </li>
          </ul>

          <div className="footerSocialRow">
            <span className="footerSocialLabel">Kết nối với CINEMA+:</span>
            <div className="footerSocialIcons">
              {/* Facebook */}
              <button type="button" className="socialCircleBtn" aria-label="Facebook">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </button>
              {/* YouTube */}
              <button type="button" className="socialCircleBtn" aria-label="YouTube">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
                  <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="#08090d" />
                </svg>
              </button>
              {/* Instagram */}
              <button type="button" className="socialCircleBtn" aria-label="Instagram">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dòng bản quyền đáy trang */}
      <div className="footerBottomBar">
        <p className="footerCopyright">
          © 2026 CINEMA+. Toàn bộ bản quyền thuộc về hệ thống rạp phim CINEMA+. Đồ án môn học SDN302.
        </p>
        <div className="footerCertBadges">
          <span className="certBadge">ĐÃ ĐĂNG KÝ BỘ CÔNG THƯƠNG</span>
          <span className="certBadge age">18+ PHÂN LOẠI PHIM THEO ĐỘ TUỔI</span>
        </div>
      </div>
    </footer>
  );
}

