import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getAdminDashboard } from '../../services/auth/authService';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminDashboard()
      .then((res) => setData(res))
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
          <h1 style={{ fontSize: '24px', margin: 0 }}>Trung tâm Quản trị Hệ thống (Admin Console)</h1>
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
            Đăng xuất Admin
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: '#7f1d1d', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <div style={{ backgroundColor: '#1a1d26', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', marginTop: 0, color: '#ec4899' }}>Thông tin Quản trị viên (Admin)</h2>
          <p><strong>Họ và tên:</strong> {user?.fullName}</p>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Vai trò (Role):</strong> <span style={{ color: '#f43f5e' }}>{user?.role?.toUpperCase()}</span></p>
          <p><strong>Quyền hạn (BR-11):</strong> Quản lý danh mục phim, suất chiếu, phòng chiếu, tài khoản nhân sự và báo cáo doanh thu.</p>
          {data && <p style={{ color: '#fbcfe8' }}><em>{data.message}</em></p>}
        </div>

        <Link to="/admin/movies" style={{ display: 'inline-block', backgroundColor: '#c91836', color: '#fff', padding: '12px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: 600, marginRight: '12px', marginBottom: '12px' }}>
          Quản lý phim
        </Link>

        <Link className="movieSecondary" to="/admin/foods" style={{ marginRight: 12, marginBottom: 12 }}>Quản lý F&B</Link>
        <Link className="movieSecondary" to="/admin/promotions" style={{ marginRight: 12, marginBottom: 12 }}>Quản lý khuyến mãi</Link>
        <Link to="/admin/revenue" className="moviePrimary" style={{ marginRight: '12px', marginBottom: '12px' }}>
          Thống kê doanh thu
        </Link>

        <Link to="/admin/rooms" className="movieSecondary" style={{ marginRight: '12px', marginBottom: '12px' }}>Quản lý phòng chiếu</Link>
        <Link to="/admin/showtimes" className="moviePrimary" style={{ marginRight: '12px', marginBottom: '12px' }}>
          Quản lý suất chiếu
        </Link>

        <Link to="/admin/members" style={{ display: 'inline-block', backgroundColor: '#222631', color: '#fff', padding: '12px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: 600, marginRight: '12px', marginBottom: '12px' }}>
          Tra cứu thành viên
        </Link>
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
          ← Xem giao diện Rạp phim
        </Link>
      </div>
    </div>
  );
}

