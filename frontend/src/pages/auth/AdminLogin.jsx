import UserLogin from './UserLogin';

// Reuse the shared login form while keeping /admin/login and its return state.
export default function AdminLogin() {
  return <UserLogin />;
}
