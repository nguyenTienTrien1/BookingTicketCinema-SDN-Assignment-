import React, { useState } from 'react';
import '../../styles/home/cinemas.css';

// Curated Cinema Clusters data for CINEMA+
const CINEMA_CLUSTERS = [
  {
    id: 'cinema-city',
    name: 'Cinema City (TP.HCM)',
    matchName: 'Cinema City',
    city: 'hcm',
    cityName: 'TP. Hồ Chí Minh',
    address: 'Tầng 3, Trung tâm phức hợp Cinema City, 126 Nguyễn Trãi, Phường 3, Quận 5, TP.HCM',
    phone: '1900 6868',
    hours: '08:00 - 24:00 (Mở cửa tất cả các ngày)',
    rooms: 6,
    coverImg: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=800&q=80',
    amenities: ['Máy chiếu Laser 4K', 'Âm thanh 7.1 Dolby', 'Ghế VIP êm ái', 'Bãi đỗ xe ô tô'],
    highlightTech: 'Laser Barco 4K',
    description: 'Cụm rạp trung tâm với 6 phòng chiếu tiện nghi, hệ thống âm thanh vòm sống động và phục vụ bắp nước tươi nóng hảo hạng.'
  },
  {
    id: 'landmark-81',
    name: 'CINEMA+ Landmark 81 (TP.HCM)',
    matchName: 'CINEMA+ Landmark 81',
    city: 'hcm',
    cityName: 'TP. Hồ Chí Minh',
    address: 'Tầng B1, TTTM Vincom Center Landmark 81, 720A Điện Biên Phủ, P. 22, Q. Bình Thạnh, TP.HCM',
    phone: '1900 6019',
    hours: '08:00 - 01:00 (Mở cửa cả ngày lễ & Tết)',
    rooms: 8,
    coverImg: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80',
    amenities: ['IMAX Laser đỉnh cao', 'Âm thanh Dolby Atmos 360°', 'Ghế da Gold Class', 'Lounge VIP riêng biệt'],
    highlightTech: 'IMAX Laser & Dolby Atmos',
    description: 'Đại cảnh điện ảnh đỉnh cao tại toà nhà cao nhất Việt Nam. Trải nghiệm phòng chiếu IMAX Laser màn hình vòm khổng lồ và phòng VIP sang trọng.'
  },
  {
    id: 'vincom-ba-trieu',
    name: 'CINEMA+ Vincom Center Bà Triệu (Hà Nội)',
    matchName: 'CINEMA+ Vincom Center Bà Triệu',
    city: 'hn',
    cityName: 'Hà Nội',
    address: 'Tầng 6, Tháp B Vincom Center, 191 Bà Triệu, Q. Hai Bà Trưng, Hà Nội',
    phone: '1900 6017',
    hours: '08:30 - 24:00 (Mở cửa cả ngày)',
    rooms: 7,
    coverImg: 'https://images.unsplash.com/photo-1595769816263-9b910be24d5f?auto=format&fit=crop&w=800&q=80',
    amenities: ['IMAX Laser', 'Dolby Atmos', 'Ghế đôi Sweetbox', 'Thang máy chuyên dụng'],
    highlightTech: 'IMAX Laser Siêu Sáng',
    description: 'Điểm hẹn điện ảnh quen thuộc của giới trẻ Thủ đô với thiết kế sang trọng, màn chiếu kích thước lớn và không gian check-in đẳng cấp.'
  },
  {
    id: 'crescent-mall',
    name: 'CINEMA+ Crescent Mall (TP.HCM)',
    matchName: 'CINEMA+ Crescent Mall',
    city: 'hcm',
    cityName: 'TP. Hồ Chí Minh',
    address: 'Tầng 5, TTTM Crescent Mall, 101 Tôn Dật Tiên, P. Tân Phú, Quận 7, TP.HCM',
    phone: '1900 6020',
    hours: '08:30 - 24:00 (Mở cửa cả ngày)',
    rooms: 7,
    coverImg: 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?auto=format&fit=crop&w=800&q=80',
    amenities: ['Dolby Surround 7.1', 'Ghế VIP Sweetbox', 'Khu vui chơi gia đình', 'Bãi đỗ xe thông minh'],
    highlightTech: 'Màn Chiếu Cong Siêu Nét',
    description: 'Tọa lạc tại khu đô thị Phú Mỹ Hưng văn minh, sở hữu các phòng chiếu rộng rãi cùng hàng ghế đôi Sweetbox lãng mạn dành cho các cặp đôi.'
  },
  {
    id: 'metropolis',
    name: 'CINEMA+ Metropolis Liễu Giai (Hà Nội)',
    matchName: 'CINEMA+ Metropolis Liễu Giai',
    city: 'hn',
    cityName: 'Hà Nội',
    address: 'Tầng 3, Vincom Center Metropolis, 29 Liễu Giai, Q. Ba Đình, Hà Nội',
    phone: '1900 6018',
    hours: '08:30 - 24:00 (Mở cửa cả ngày)',
    rooms: 6,
    coverImg: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    amenities: ['Phòng chiếu ScreenX 270°', 'Ghế rung 4DX đỉnh cao', 'Quầy Gourmet Popcorn', 'Wifi tốc độ cao'],
    highlightTech: 'ScreenX 270° Toàn Cảnh',
    description: 'Trải nghiệm xem phim mở rộng ba màn hình với công nghệ ScreenX 270 độ và hệ thống chuyển động 4DX chân thực đến từng cảm giác rung chấn.'
  },
  {
    id: 'ngo-quyen-danang',
    name: 'CINEMA+ Vincom Ngô Quyền (Đà Nẵng)',
    matchName: 'CINEMA+ Vincom Ngô Quyền',
    city: 'dn',
    cityName: 'Đà Nẵng',
    address: 'Tầng 4, Vincom Plaza Ngô Quyền, 910A Ngô Quyền, P. An Hải Bắc, Q. Sơn Trà, TP. Đà Nẵng',
    phone: '1900 6022',
    hours: '08:30 - 23:30 (Mở cửa cả ngày)',
    rooms: 5,
    coverImg: 'https://images.unsplash.com/photo-1585647347384-2593bc35786b?auto=format&fit=crop&w=800&q=80',
    amenities: ['Màn chiếu bạc siêu sáng', 'Âm thanh Dolby Surround', 'Ghế bọc nhung cao cấp', 'Khu ẩm thực đa dạng'],
    highlightTech: 'Dolby Digital Sound',
    description: 'Cụm rạp tiêu chuẩn hàng đầu tại thành phố biển Đà Nẵng, không gian ấm cúng, thiết kế hiện đại và dịch vụ khách hàng tận tâm.'
  }
];

export default function Cinemas({
  setTab,
  onSelectCinemaForSchedule
}) {
  const [activeCity, setActiveCity] = useState('all');
  const [modalCinema, setModalCinema] = useState(null);

  // Filter cinemas by selected city
  const filteredCinemas = CINEMA_CLUSTERS.filter((c) => {
    if (activeCity === 'all') return true;
    return c.city === activeCity;
  });

  function handleViewSchedule(cinema) {
    if (onSelectCinemaForSchedule) {
      onSelectCinemaForSchedule(cinema.matchName);
    }
    if (setTab) {
      setTab('showtimes');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleQuickBook(cinema) {
    if (onSelectCinemaForSchedule) {
      onSelectCinemaForSchedule(cinema.matchName);
    }
    if (setTab) {
      setTab('booking');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <section className="cinemasPage" aria-label="Hệ thống rạp chiếu CINEMA+">
      {/* 1. Header */}
      <div className="cinemasHeading">
        <div>
          <p className="cinemasEyebrow">CINEMA+ · HỆ THỐNG CỤM RẠP</p>
          <h1>Hệ thống rạp chiếu toàn quốc</h1>
          <p>
            Trải nghiệm không gian điện ảnh quốc tế với công nghệ hình ảnh IMAX Laser, âm thanh vòm Dolby Atmos và dịch vụ chuyên nghiệp hàng đầu.
          </p>
        </div>
      </div>

      {/* 2. Technology Highlights Banner */}
      <div className="cinemaTechHighlights" role="region" aria-label="Công nghệ rạp chiếu">
        <div className="techHighlightCard">
          <div className="techIconBox">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="20" height="15" x="2" y="4.5" rx="2" />
              <line x1="8" y1="20" x2="16" y2="20" />
              <line x1="12" y1="16" x2="12" y2="20" />
            </svg>
          </div>
          <h4>IMAX Laser & ScreenX</h4>
          <p>Độ phân giải 4K siêu sắc nét, độ tương phản cực đại và tầm nhìn 270 độ đột phá.</p>
        </div>

        <div className="techHighlightCard">
          <div className="techIconBox">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 11l18-5v12L3 13v-2z" />
              <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
            </svg>
          </div>
          <h4>Âm thanh Dolby Atmos</h4>
          <p>Hệ thống loa vòm đa chiều 360 độ, mang đến âm thanh sống động và chi tiết từng nhịp thở.</p>
        </div>

        <div className="techHighlightCard">
          <div className="techIconBox">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 9h-4V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2z" />
            </svg>
          </div>
          <h4>Ghế VIP Sweetbox & Da</h4>
          <p>Không gian riêng tư, ghế da ngả lưng êm ái cùng hàng ghế Sweetbox dành cho cặp đôi.</p>
        </div>

        <div className="techHighlightCard">
          <div className="techIconBox">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h4>Gourmet Lounge & F&B</h4>
          <p>Bắp rang bơ nấm cao cấp, thức uống pha chế và khu sảnh chờ sang trọng hiện đại.</p>
        </div>
      </div>

      {/* 3. City Tabs */}
      <div className="cinemaCityFilter" role="tablist" aria-label="Lọc theo thành phố">
        <button
          type="button"
          role="tab"
          aria-selected={activeCity === 'all'}
          className={`cityTabBtn ${activeCity === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCity('all')}
        >
          Tất cả rạp ({CINEMA_CLUSTERS.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeCity === 'hcm'}
          className={`cityTabBtn ${activeCity === 'hcm' ? 'active' : ''}`}
          onClick={() => setActiveCity('hcm')}
        >
          TP. Hồ Chí Minh (3)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeCity === 'hn'}
          className={`cityTabBtn ${activeCity === 'hn' ? 'active' : ''}`}
          onClick={() => setActiveCity('hn')}
        >
          Hà Nội (2)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeCity === 'dn'}
          className={`cityTabBtn ${activeCity === 'dn' ? 'active' : ''}`}
          onClick={() => setActiveCity('dn')}
        >
          Đà Nẵng (1)
        </button>
      </div>

      {/* 4. Cinema Cards Grid */}
      <div className="cinemaClustersGrid">
        {filteredCinemas.map((cinema) => (
          <article key={cinema.id} className="cinemaClusterCard">
            {/* Cover image & City badge */}
            <div
              className="cinemaCardCover"
              style={{ backgroundImage: `url(${cinema.coverImg})` }}
            >
              <span className="cinemaCityBadge">{cinema.cityName}</span>
            </div>

            {/* Body */}
            <div className="cinemaCardBody">
              <h3 className="cinemaCardTitle">{cinema.name}</h3>

              <div className="cinemaInfoRows">
                <div className="cinemaInfoItem">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>{cinema.address}</span>
                </div>

                <div className="cinemaInfoItem">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>Hotline: <strong>{cinema.phone}</strong> · Giờ mở cửa: {cinema.hours}</span>
                </div>
              </div>

              {/* Amenities / Tech tags */}
              <div className="cinemaAmenitiesTags">
                <span className="amenityTag highlight">{cinema.highlightTech}</span>
                <span className="amenityTag">{cinema.rooms} phòng chiếu</span>
                {cinema.amenities.map((am) => (
                  <span key={am} className="amenityTag">{am}</span>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="cinemaCardActions">
                <button
                  type="button"
                  className="cinemaBtnSchedule"
                  onClick={() => handleViewSchedule(cinema)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>Xem lịch chiếu</span>
                </button>

                <button
                  type="button"
                  className="cinemaBtnBook"
                  onClick={() => handleQuickBook(cinema)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Đặt vé ngay</span>
                </button>

                <button
                  type="button"
                  className="cinemaBtnInfo"
                  onClick={() => setModalCinema(cinema)}
                  title="Xem bảng giá vé và thông tin chi tiết rạp"
                >
                  Bảng giá & Chi tiết
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* 5. Pricing & Details Modal */}
      {modalCinema && (
        <div
          className="cinemaModalBackdrop"
          onClick={() => setModalCinema(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modalCinemaTitle"
        >
          <div
            className="cinemaModalContent"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cinemaModalHeader">
              <div>
                <h3 id="modalCinemaTitle">{modalCinema.name}</h3>
                <p>{modalCinema.address}</p>
              </div>
              <button
                type="button"
                className="modalCloseBtn"
                onClick={() => setModalCinema(null)}
                aria-label="Đóng bảng thông tin rạp"
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.6', margin: '0 0 16px' }}>
              {modalCinema.description}
            </p>

            <h4 style={{ fontSize: '16px', color: '#ffffff', margin: '0 0 8px' }}>
              Bảng giá vé tham khảo tại rạp:
            </h4>

            <table className="priceTable">
              <thead>
                <tr>
                  <th>Loại vé / Suất chiếu</th>
                  <th>Thứ 2 - Thứ 5</th>
                  <th>Thứ 6, T7, CN & Lễ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Ghế Tiêu chuẩn (2D Standard)</td>
                  <td className="priceHighlight">75.000đ - 85.000đ</td>
                  <td className="priceHighlight">90.000đ - 105.000đ</td>
                </tr>
                <tr>
                  <td>Ghế VIP (2D VIP)</td>
                  <td className="priceHighlight">85.000đ - 95.000đ</td>
                  <td className="priceHighlight">100.000đ - 120.000đ</td>
                </tr>
                <tr>
                  <td>Ghế Đôi Sweetbox (2 người)</td>
                  <td className="priceHighlight">180.000đ</td>
                  <td className="priceHighlight">220.000đ</td>
                </tr>
                <tr>
                  <td>Phòng IMAX Laser / 3D</td>
                  <td className="priceHighlight">120.000đ - 140.000đ</td>
                  <td className="priceHighlight">150.000đ - 180.000đ</td>
                </tr>
                <tr>
                  <td>Học sinh / Sinh viên (U22)</td>
                  <td className="priceHighlight">60.000đ (đồng giá)</td>
                  <td className="priceHighlight">75.000đ</td>
                </tr>
              </tbody>
            </table>

            <div className="cinemaModalPolicies">
              <h5>Quy định & Chính sách rạp:</h5>
              <ul>
                <li>Trẻ em dưới 0.7m được miễn phí vé khi ngồi cùng người lớn.</li>
                <li>Vé học sinh - sinh viên áp dụng xuất trình thẻ HSSV hợp lệ khi vào cửa.</li>
                <li>Không mang đồ ăn, thức uống có mùi hoặc mua từ bên ngoài vào rạp.</li>
                <li>Hệ thống phòng chiếu được khử khuẩn định kỳ và phục vụ máy lạnh suốt buổi chiếu.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
              <button
                type="button"
                className="cinemaBtnSchedule"
                style={{ height: '44px' }}
                onClick={() => {
                  setModalCinema(null);
                  handleViewSchedule(modalCinema);
                }}
              >
                Xem lịch chiếu rạp này
              </button>
              <button
                type="button"
                className="cinemaBtnBook"
                style={{ height: '44px' }}
                onClick={() => {
                  setModalCinema(null);
                  handleQuickBook(modalCinema);
                }}
              >
                Đặt vé tại rạp này
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

