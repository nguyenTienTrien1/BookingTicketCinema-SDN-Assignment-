import './cinemaTicket.css';
import { getMoviePoster } from './MovieCard';

export const ticketMoney = value => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
export function ticketDateTime(value) {
    if (!value || Number.isNaN(new Date(value).getTime())) return 'Chưa có thông tin';
    return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function MovieArtwork({ movie = {}, className = '', backdrop = false }) {
    const poster = getMoviePoster(movie);
    const source = backdrop ? movie.banner || poster : poster || movie.banner;
    return <div className={`cinemaArtwork ${className}`} aria-hidden="true">
        <span>CINEMA<span>+</span></span>
        {source && <img key={source} src={source} alt="" onError={event => {
            if (poster && event.currentTarget.getAttribute('src') !== poster) event.currentTarget.src = poster;
            else event.currentTarget.style.display = 'none';
        }} />}
    </div>;
}

export function CinemaTicketHero({ movie = {}, showtime = {}, seats = [], children }) {
    return <section className="cinemaTicketHero" aria-label="Thông tin phim đã đặt">
        <MovieArtwork movie={movie} className="cinemaHeroBackdrop" backdrop />
        <div className="cinemaHeroContent">
            <MovieArtwork movie={movie} className="cinemaHeroPoster" />
            <div className="cinemaHeroInfo">
                <div className="cinemaHeroHeading">
                <p className="cinemaEyebrow">HẸN BẠN TẠI RẠP</p>
                <h2>{showtime.movieTitle || movie.title || 'Thông tin phim chưa có'}</h2>
                <div className="cinemaMovieTags">{movie.classification && <span>{movie.classification}</span>}{movie.duration > 0 && <span>{movie.duration} phút</span>}</div>
                </div>
                <dl className="cinemaShowtimeDetails">
                    <div><dt>Rạp chiếu</dt><dd>{showtime.cinema || 'Chưa có thông tin'}</dd></div>
                    <div><dt>Suất chiếu</dt><dd>{ticketDateTime(showtime.startTime)}</dd></div>
                    <div><dt>Phòng chiếu</dt><dd>{showtime.room || 'Chưa có thông tin'}</dd></div>
                    <div><dt>Ghế của bạn</dt><dd className="cinemaSeatList">{seats.length ? seats.join(' · ') : 'Chưa có thông tin'}</dd></div>
                </dl>
            </div>
        </div>
        {children}
    </section>;
}

const statuses = { issued: 'Chưa sử dụng', valid: 'Chưa sử dụng', 'checked-in': 'Đã check-in', expired: 'Hết giờ nhận khách', revoked: 'Đã thu hồi' };

export function SeatTicket({ ticket, index, movieTitle, cinema, room, startTime }) {
    const status = ticket.status === 'valid' ? 'issued' : ticket.status;
    const qr = status === 'issued' ? ticket.qrDataUrl || ticket.qr : null;
    const reference = ticket.reference || ticket.code;
    return <article className={`cinemaSeatTicket cinemaSeatTicket--${status}`} aria-label={`Vé ghế ${ticket.seat}`}>
        <div className="cinemaTicketTop"><span>CINEMA<b>+</b> <small>VÉ ĐIỆN TỬ {String(index + 1).padStart(2, '0')}</small></span><span className="cinemaTicketBadge">{statuses[status] || 'Không khả dụng'}</span></div>
        <div className="cinemaTicketBody">
            <div className="cinemaTicketSeatInfo"><span className="cinemaEyebrow">SỐ GHẾ</span><h3>{ticket.seat}</h3><strong>{movieTitle || 'Vé xem phim'}</strong>
                <p>{cinema}{room ? ` · ${room}` : ''}</p><p>{ticketDateTime(startTime)}</p>
            </div>
            <div className="cinemaTicketQrArea">{qr ? <><img src={qr} width="264" height="264" alt={`QR vé ghế ${ticket.seat}`} /><span>Đưa mã này cho nhân viên soát vé</span></> : <div className="cinemaTicketUnavailable"><span aria-hidden="true">{status === 'checked-in' ? '✓' : '—'}</span><strong>{statuses[status] || 'QR chưa khả dụng'}</strong>{ticket.checkedInAt && <span>{ticketDateTime(ticket.checkedInAt)}</span>}</div>}</div>
        </div>
        <div className="cinemaTicketBottom"><div><span>MÃ VÉ</span><code>{reference || 'Chưa có mã vé'}</code></div>{qr && <a href={qr} download={`ve-ghe-${ticket.seat}.png`}>Tải QR ↓</a>}</div>
    </article>;
}
