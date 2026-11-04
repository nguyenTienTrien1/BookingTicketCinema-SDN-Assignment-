import { Link } from 'react-router-dom';

export default function Header({ tab, setTab, user }) {
  return <header className="sidebarHeader">
    <div className="logo">CINEMA<span>+</span></div>
    <nav className="sidebarNav" aria-label="Main navigation">
      <button onClick={() => setTab('home')} aria-current={tab === 'home' ? 'page' : undefined}>Trang chủ</button>
      <button onClick={() => setTab('movies')} aria-current={tab === 'movies' ? 'page' : undefined}>Phim</button>
      <button onClick={() => setTab('booking')} aria-current={tab === 'booking' ? 'page' : undefined}>{['admin', 'employee'].includes(user?.role) ? 'Quầy vé' : 'Đặt vé'}</button>
      <Link to="/account" aria-current={tab === 'account' ? 'page' : undefined}>Tài khoản</Link>
      {['admin','employee'].includes(user?.role) && <Link to="/staff/tools">Nghiệp vụ quầy</Link>}
      {user?.role === 'admin' && <Link to="/admin/movies">Quản lý phim</Link>}
    </nav>
    <div className="right sidebarActions">
      <button type="button" className="sidebarSearch" onClick={() => setTab('movies')}>Tìm phim →</button>
      {user ? <Link className="loginBtn" to="/account?section=profile">{user.fullName}</Link> : <button className="loginBtn" onClick={() => setTab('login')}>Đăng nhập</button>}
    </div>
  </header>;
}
