import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleHome } from '../utils/permissions';
import '../pages/Account/employeeAccount.css';

export default function StaffHeader({ onAccount, onBookTickets, activeTab }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <header className="staffWorkspaceHeader">
    <Link className="staffWorkspaceBrand" to={roleHome(user.role)}>CINEMA+ <span>{user.role === 'admin' ? 'QUẢN TRỊ' : 'NHÂN VIÊN'}</span></Link>
    <nav aria-label="Điều hướng nhân sự">
      <button type="button" className="ghost" aria-current={activeTab === 'account' ? 'page' : undefined} onClick={onAccount}>Hồ sơ & tác vụ</button>
      <button type="button" className="ghost" aria-current={activeTab === 'counter-booking' || activeTab === 'booking' ? 'page' : undefined} onClick={onBookTickets}>Quầy bán vé</button>
      {user.role === 'employee' && <><Link className="ghost" to="/employee/food-sales">Bán F&B</Link><Link className="ghost" to="/employee/check-in">Check-in vé</Link></>}
      <Link className="ghost" to="/staff/tools">Thu tiền & đối soát</Link>
      <button type="button" className="ghost" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { await logout(); navigate('/admin/login', { replace: true }); }
        catch (err) { setError(err.message); }
        finally { setBusy(false); }
      }}>{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>
    </nav>
    {error && <p role="alert">{error}</p>}
  </header>;
}
