import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMemberDashboard } from '../../services/auth/authService';

export default function MemberDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getMemberDashboard()
      .then((data) => setDashboardData(data))
      .catch((err) => setError(err.message));
  }, []);

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#08090c',
      color: '#ffffff',
      padding: '40px 20px',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: '#12141a',
        borderRadius: '20px',
        padding: '32px',
        border: '1px solid #222631'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', margin: 0 }}>Bảng điều khiển Thành viên (Member Dashboard)</h1>
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: '#e53e3e',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Đăng xuất
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: '#7f1d1d', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div style={{ backgroundColor: '#1a1d26', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', marginTop: 0, color: '#38bdf8' }}>Thông tin tài khoản đã xác thực</h2>
          <p><strong>Họ và tên:</strong> {user?.fullName}</p>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Vai trò (Role):</strong> <span style={{ color: '#4ade80' }}>{user?.role?.toUpperCase()}</span></p>
          <p><strong>Điểm tích lũy (Member Points):</strong> {user?.memberPoints || 0} điểm</p>
          <p><strong>Trạng thái:</strong> {user?.status}</p>
          {dashboardData && <p style={{ color: '#a7f3d0' }}><em>{dashboardData.message}</em></p>}
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <Link to="/profile" style={{ color: '#ff9aa2', padding: '12px 20px' }}>Hồ sơ của tôi</Link>
          <Link
            to="/"
            style={{
              display: 'inline-block',
              backgroundColor: '#2563eb',
              color: '#fff',
              padding: '12px 20px',
              borderRadius: '10px',
              textDecoration: 'none',
              fontWeight: 600
            }}
          >
            ← Xem phim &amp; Đặt vé ngay
          </Link>
        </div>
      </div>
    </div>
  );
}

