import { Routes, Route } from 'react-router-dom';
import UserLogin from '../pages/auth/UserLogin';
import AdminLogin from '../pages/auth/AdminLogin';
import Register from '../pages/auth/Register';
import VerifyEmail from '../pages/auth/VerifyEmail';
import MemberDashboard from '../pages/auth/MemberDashboard';
import EmployeeDashboard from '../pages/auth/EmployeeDashboard';
import AdminDashboard from '../pages/auth/AdminDashboard';
import ProtectedRoute from './ProtectedRoute';
import CinemaMain from '../pages/CinemaMain';
import ManageMovies from '../pages/Admin/ManageMovies';

/**
 * Main application routes integrating React Router DOM
 */
export default function AppRoutes() {
  return (
    <Routes>
      {/* 1. Member Login (/login) */}
      <Route path="/login" element={<UserLogin />} />

      {/* 2. Admin & Employee Login (/admin/login) */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* 3. Member Registration (UC-1) */}
      <Route path="/register" element={<Register />} />

      {/* 4. Email Verification (UC-1, BR-8) */}
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* 5. Protected Member Dashboard (/dashboard) */}
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

      <Route path="/admin/movies" element={
        <ProtectedRoute allowedRoles={['admin']}><ManageMovies /></ProtectedRoute>
      } />

      {/* 6. Preserved Cinema Application */}
      <Route path="/*" element={<CinemaMain />} />
    </Routes>
  );
}

