import { useEffect, useState } from 'react';
import { getBookings } from '../../services/bookingService';
import { translateAccountStatus, translateFoodName } from '../../utils/uiText';

function formatDate(value) {
    if (!value) return 'Chưa có thông tin';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Chưa có thông tin' : date.toLocaleString('vi-VN');
}

function bookingStatus(booking) {
    if (booking.status === 'paid') return { label: 'Đã thanh toán', className: 'paid' };
    if (booking.status === 'cancelled') return { label: 'Đã hủy', className: 'cancelled' };
    if (!booking.expiresAt || new Date(booking.expiresAt).getTime() <= Date.now()) {
        return { label: 'Hết thời gian giữ ghế', className: 'expired' };
    }
    return { label: 'Chờ thanh toán', className: 'pending' };
}

export default function Account({ user, setTab, setPending }) {
    const [activeSection, setActiveSection] = useState('tickets');
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!user?._id) return;

        let active = true;
        setLoading(true);
        setError('');
        getBookings(user._id)
            .then((result) => {
                if (active) setBookings(Array.isArray(result) ? result : []);
            })
            .catch((requestError) => {
                if (active) setError(requestError.message || 'Không thể tải danh sách vé.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [user?._id]);

    if (!user) {
        return (
            <section className="page">
                <div className="accountEmpty">
                    <h2>Đăng nhập để xem vé của bạn</h2>
                    <p>Vé đã đặt sẽ được lưu tại đây.</p>
                    <button type="button" className="primary" onClick={() => setTab('login')}>Đăng nhập</button>
                </div>
            </section>
        );
    }

    return (
        <section className="page accountPage">
            <div className="accountPageHeading">
                <p className="bookingEyebrow">TÀI KHOẢN CINEMA+</p>
                <h2>Tài khoản của tôi</h2>
                <p>Quản lý thông tin cá nhân và vé xem phim đã đặt.</p>
            </div>

            <div className="accountTabs" role="tablist" aria-label="Mục tài khoản">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeSection === 'tickets'}
                    className={activeSection === 'tickets' ? 'active' : ''}
                    onClick={() => setActiveSection('tickets')}
                >
                    Vé của tôi <span>{bookings.length}</span>
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeSection === 'profile'}
                    className={activeSection === 'profile' ? 'active' : ''}
                    onClick={() => setActiveSection('profile')}
                >
                    Hồ sơ
                </button>
            </div>

            {activeSection === 'profile' ? (
                <div className="accountProfileCard">
                    <div className="accountAvatar">{String(user.fullName || 'U').trim().charAt(0).toUpperCase()}</div>
                    <div className="accountProfileDetails">
                        <h3>{user.fullName}</h3>
                        <p>{user.email}</p>
                        <div className="accountProfileStats">
                            <span>Điểm thành viên <strong>{Number(user.memberPoints || 0).toLocaleString()}</strong></span>
                            <span>Trạng thái <strong>{translateAccountStatus(user.status)}</strong></span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="myTicketsSection">
                    {loading && <div className="ticketNotice">Đang tải danh sách vé…</div>}
                    {error && <div className="ticketNotice ticketNoticeError" role="alert">{error}</div>}
                    {!loading && !error && bookings.length === 0 && (
                        <div className="accountEmpty">
                            <div className="emptyTicketIcon" aria-hidden="true">▤</div>
                            <h3>Bạn chưa có vé nào</h3>
                            <p>Chọn một bộ phim và đặt vé. Vé của bạn sẽ xuất hiện tại đây.</p>
                            <button type="button" className="primary" onClick={() => setTab('movies')}>Khám phá phim</button>
                        </div>
                    )}

                    {bookings.map((booking) => {
                        const status = bookingStatus(booking);
                        const showtime = booking.showtime;
                        const movie = showtime?.movie;
                        const foods = (booking.foodItems || [])
                            .map((item) => `${translateFoodName(item.food?.name || 'Đồ ăn')}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`)
                            .join(', ');

                        return (
                            <article className="myTicketCard" key={booking._id}>
                                <div className="myTicketPoster">
                                    <span>{movie?.title || 'CINEMA+'}</span>
                                </div>
                                <div className="myTicketContent">
                                    <div className="myTicketHeader">
                                        <div>
                                            <span className="ticketReference">MÃ VÉ · {String(booking._id).slice(-8).toUpperCase()}</span>
                                            <h3>{movie?.title || 'Vé xem phim'}</h3>
                                        </div>
                                        <span className={`ticketStatus ${status.className}`}>{status.label}</span>
                                    </div>
                                    <div className="myTicketDetails">
                                        <p><span>Rạp / phòng</span><strong>{showtime?.cinema || '—'}{showtime?.room ? ` · ${showtime.room}` : ''}</strong></p>
                                        <p><span>Ngày giờ</span><strong>{formatDate(showtime?.startTime)}</strong></p>
                                        <p><span>Ghế</span><strong>{booking.seats?.join(', ') || '—'}</strong></p>
                                        <p><span>Bắp nước</span><strong>{foods || 'Không gọi thêm'}</strong></p>
                                    </div>
                                    <div className="myTicketFooter">
                                        <div>
                                            <span>{booking.status === 'paid' ? 'Đã thanh toán' : 'Tổng tiền'}</span>
                                            <strong>{Number(booking.total || 0).toLocaleString()}₫</strong>
                                        </div>
                                        {booking.status === 'pending' && status.className === 'pending' && (
                                            <button
                                                type="button"
                                                className="primary"
                                                onClick={() => {
                                                    setPending(booking);
                                                    setTab('payment');
                                                }}
                                            >
                                                Thanh toán tiếp
                                            </button>
                                        )}
                                        {booking.status === 'pending' && status.className === 'expired' && (
                                            <button
                                                type="button"
                                                className="ghost"
                                                onClick={() => setTab('booking')}
                                            >
                                                Đặt lại vé
                                            </button>
                                        )}
                                    </div>
                                    {booking.status === 'paid' && (
                                        <div className="myTicketQr">
                                            <div className="myTicketQrPattern" aria-hidden="true">▦</div>
                                            <div>
                                                <strong>Vé điện tử</strong>
                                                <span>Dùng mã vé này để tra cứu và làm thủ tục vào rạp.</span>
                                                {booking.paymentRef && <small>Mã giao dịch: {booking.paymentRef}</small>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
