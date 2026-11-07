import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BookingHistory } from './BookingHistory';
import { ProfilePanel } from './Profile';
import EmployeeActions from './EmployeeActions';
import './employeeAccount.css';

export default function Account({ user, setTab, setPending, initialSection }) {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const isEmployee = user?.role === 'employee';
    const [loggingOut, setLoggingOut] = useState(false);
    const [activeSection, setActiveSection] = useState(initialSection === 'profile' || user?.role !== 'member' ? 'profile' : 'tickets');
    useEffect(() => {
        setActiveSection(initialSection === 'profile' || user?.role !== 'member' ? 'profile' : 'tickets');
    }, [initialSection, user?.role]);
    const [historyCount, setHistoryCount] = useState(null);
    const [error, setError] = useState('');
    const bookingCount = historyCount && historyCount.memberId === user?._id ? historyCount.count : null;

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
            {error && <p role="alert">{error}</p>}
            {!isEmployee && <div className="accountTabs" role="tablist" aria-label="Mục tài khoản">
                {user.role === 'member' && (
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeSection === 'tickets'}
                    className={activeSection === 'tickets' ? 'active' : ''}
                    onClick={() => setActiveSection('tickets')}
                >
                    Vé của tôi {bookingCount !== null && <span>{bookingCount}</span>}
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
                <BookingHistory
                    key={user._id}
                    memberId={user._id}
                    onCountChange={setHistoryCount}
                    onBrowseMovies={() => setTab('movies')}
                    onContinuePayment={booking => { setPending(booking); setTab('payment'); }}
                    onBookAgain={() => setTab('booking')}
                />
            )}
        </section>
    );
}
