import { useState } from 'react';
import { translateAccountStatus } from '../../utils/uiText';
import { ProfilePanel } from './Profile';
import { BookingHistory } from './BookingHistory';

export default function Account({ user, setTab, setPending }) {
    const [activeSection, setActiveSection] = useState('tickets');

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
        <section className="page accountPage">
            <div className="accountPageHeading">
                <p className="bookingEyebrow">TÀI KHOẢN CINEMA+</p>
                <h2>Tài khoản của tôi</h2>
                <p>Quản lý thông tin cá nhân và lịch sử đặt vé.</p>
            </div>
            <div className="accountTabs" aria-label="Mục tài khoản">
                <button type="button" aria-pressed={activeSection === 'tickets'}
                    className={activeSection === 'tickets' ? 'active' : ''} onClick={() => setActiveSection('tickets')}>
                    Lịch sử đặt vé
                </button>
                <button type="button" aria-pressed={activeSection === 'profile'}
                    className={activeSection === 'profile' ? 'active' : ''} onClick={() => setActiveSection('profile')}>
                    Hồ sơ
                </button>
            </div>
            {activeSection === 'profile' ? (
                user.role === 'member' ? <ProfilePanel /> : <div className="accountProfileCard">
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
            ) : user.role === 'member' ? (
                <BookingHistory key={user._id} memberId={user._id}
                    onBrowseMovies={() => setTab('movies')}
                    onBookAgain={() => setTab('booking')}
                    onContinuePayment={(booking) => { setPending(booking); setTab('payment'); }} />
            ) : <p className="ticketNotice">Lịch sử đặt vé dành cho tài khoản thành viên.</p>}
        </section>
    );
}
