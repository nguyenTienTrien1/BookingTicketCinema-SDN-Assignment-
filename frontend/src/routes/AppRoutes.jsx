import { Routes, Route } from 'react-router-dom';
import UserLogin from '../pages/auth/UserLogin';
import AdminLogin from '../pages/auth/AdminLogin';
import MemberDashboard from '../pages/auth/MemberDashboard';
import EmployeeDashboard from '../pages/auth/EmployeeDashboard';
import AdminDashboard from '../pages/auth/AdminDashboard';
import ProtectedRoute from './ProtectedRoute';
import CinemaMain from '../pages/CinemaMain';

/**
 * Main application routes integrating React Router DOM
 */
export default function AppRoutes() {
  return (
    <Routes>
      {/* 1. Member & Employee Login (/login) */}
      <Route path="/login" element={<UserLogin />} />

      {/* 2. Admin Login (/admin/login) */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* 3. Protected Member Dashboard (/dashboard) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['member']}>
            <MemberDashboard />
          </ProtectedRoute>
        }
      />

      {/* 4. Protected Employee Dashboard (/employee/dashboard) */}
      <Route
        path="/employee/dashboard"
        element={
          <ProtectedRoute allowedRoles={['employee']}>
            <EmployeeDashboard />
          </ProtectedRoute>
        }
      />

      {/* 5. Protected Admin Dashboard (/admin/dashboard) */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* 6. Preserved Cinema Application */}
      <Route path="/*" element={<CinemaMain />} />
    </Routes>
  );
}

