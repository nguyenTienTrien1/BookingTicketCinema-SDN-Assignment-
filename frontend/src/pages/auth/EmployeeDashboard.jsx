import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getEmployeeDashboard } from '../../services/auth/authService';

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getEmployeeDashboard()
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
          <h1 style={{ fontSize: '24px', margin: 0 }}>Giao diện Nhân viên Quầy vé (Employee Portal)</h1>
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
          <h2 style={{ fontSize: '18px', marginTop: 0, color: '#f59e0b' }}>Thông tin nhân viên quầy</h2>
          <p><strong>Họ và tên:</strong> {user?.fullName}</p>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Vai trò (Role):</strong> <span style={{ color: '#fbbf24' }}>{user?.role?.toUpperCase()}</span></p>
          <p><strong>Quyền hạn (BR-11):</strong> Bán vé tại quầy, tìm kiếm thông tin khách hàng, soát vé check-in.</p>
          {data && <p style={{ color: '#fde68a' }}><em>{data.message}</em></p>}
        </div>

        <Link to="/employee/food-sales" style={{ display: 'inline-block', background: '#c91836', color: '#fff', padding: '12px 20px', borderRadius: '10px', textDecoration: 'none', marginRight: '12px', marginBottom: '12px' }}>
          Bán đồ ăn & thức uống
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
          ← Đến trang Quầy đặt vé
        </Link>
      </div>
    </div>
  );
}

