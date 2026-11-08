import LoginForm from '../../components/auth/LoginForm';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Staff use their own API endpoint; Member login remains at /login.
export default function AdminLogin() {
  const location = useLocation();
  const { notice } = useAuth();
  const message = location.state?.message || notice;
  return <>{message && <p className="profileLoginNotice" role="status">{message}</p>}<LoginForm portal="staff" /></>;
}
