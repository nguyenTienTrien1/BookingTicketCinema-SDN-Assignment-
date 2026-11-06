import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getBookings } from '../../services/bookingService';
import { translateFoodName } from '../../utils/uiText';
import { ProfilePanel } from './Profile';
import EmployeeActions from './EmployeeActions';
import './employeeAccount.css';

function formatDate(value) {
    if (!value) return 'Chưa có thông tin';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Chưa có thông tin' : date.toLocaleString('vi-VN');
}

function bookingStatus(booking) {
    if (booking.status === 'paid') return { label: 'Đã thanh toán', className: 'paid' };
    if (booking.status === 'cancelled') return { label: 'Đã hủy', className: 'cancelled' };
    const expiresAt = new Date(booking.expiresAt || 0).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        return { label: 'Hết thời gian giữ ghế', className: 'expired' };
    }
    return { label: 'Chờ thanh toán', className: 'pending' };
}

export default function Account({ user, setTab, setPending, initialSection }) {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const isEmployee = user?.role === 'employee';
    const [loggingOut, setLoggingOut] = useState(false);
    const [activeSection, setActiveSection] = useState(initialSection === 'profile' || user?.role !== 'member' ? 'profile' : 'tickets');
    useEffect(() => {
        setActiveSection(initialSection === 'profile' || user?.role !== 'member' ? 'profile' : 'tickets');
    }, [initialSection, user?.role]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!user?._id || user.role !== 'member') return;

        let active = true;
        setLoading(true);
        setError('');
        getBookings()
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
    }, [user?._id, user?.role]);

    if (!user) {
        return (
            <section className="page">
                <div className="accountEmpty">
                    <h2>Đăng nhập để xem lịch sử đặt vé</h2>
                    <p>Các đơn đặt vé của bạn sẽ được lưu tại đây.</p>
                    <button type="button" className="primary" onClick={() => setTab('login')}>Đăng nhập</button>
                </div>
            </section>
        );
    }

    return (
        <section className={`page accountPage${isEmployee ? ' employeeAccount' : ''}`}>
            <div className={isEmployee ? 'employeeAccountHeader' : undefined}>
            <div className="accountPageHeading">
                <p className="bookingEyebrow">{isEmployee ? 'NHÂN VIÊN CINEMA+' : 'TÀI KHOẢN CINEMA+'}</p>
                <h2>{isEmployee ? 'Hồ sơ nhân viên' : 'Tài khoản của tôi'}</h2>
                <p>{isEmployee ? 'Quản lý hồ sơ cá nhân và truy cập các nghiệp vụ tại quầy.' : 'Quản lý thông tin cá nhân và lịch sử đặt vé.'}</p>
            </div>

            {!isEmployee && <button type="button" className="ghost" disabled={loggingOut} onClick={async () => {
                if (loggingOut) return;
                setLoggingOut(true);
                try { await logout(); navigate('/login', { replace: true }); }
                catch (err) { setError(err.message); }
                finally { setLoggingOut(false); }
            }}>{loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>}
            </div>
            {error && activeSection === 'profile' && <p role="alert">{error}</p>}
            {!isEmployee && <div className="accountTabs" role="tablist" aria-label="Mục tài khoản">
                {user.role === 'member' && (
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeSection === 'tickets'}
                    className={activeSection === 'tickets' ? 'active' : ''}
                    onClick={() => setActiveSection('tickets')}
                >
                    Vé của tôi <span>{bookings.length}</span>
                </button>
                )}
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeSection === 'profile'}
                    className={activeSection === 'profile' ? 'active' : ''}
                    onClick={() => setActiveSection('profile')}
                >
                    Hồ sơ
                </button>
            </div>}
            {activeSection === 'profile' ? (
                <div className={isEmployee ? 'employeeAccountLayout' : undefined}>
                    <ProfilePanel />
                    {isEmployee && <EmployeeActions onBookTickets={() => setTab('booking')} />}
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
                                        {booking.promotion && <p><span>Khuyến mãi ({booking.promotion.code})</span><strong>−{Number(booking.promotionDiscount || 0).toLocaleString('vi-VN')}₫</strong></p>}
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
                                            <div className="ticketGrid">{booking.tickets?.length?booking.tickets.map(ticket=><div key={ticket.code||ticket.reference}>{['valid','issued'].includes(ticket.status)&&ticket.qr?<img src={ticket.qr} alt={'QR ghế '+ticket.seat} width="150" height="150"/>:<p>{ticket.status==='checked-in'?'Đã check-in':'Xem chi tiết vé'}</p>}<p>Ghế {ticket.seat}</p><small>{ticket.code||ticket.reference}</small></div>):<p>Đơn cũ chưa có QR riêng từng ghế.</p>}</div>
                                            <div>
                                                <strong>Vé điện tử</strong>
                                                <Link to={'/bookings/'+booking._id+'/tickets'}>Xem vé QR và trạng thái check-in</Link>
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
