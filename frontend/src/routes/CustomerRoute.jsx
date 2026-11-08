import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleHome } from '../utils/permissions';

export default function CustomerRoute({ children, account = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status">Đang kiểm tra phiên đăng nhập…</p>;
  if (['admin', 'employee'].includes(user?.role)) {
    return <Navigate to={roleHome(user.role) + (account ? location.search : '')} replace />;
  }
  return children;
}
