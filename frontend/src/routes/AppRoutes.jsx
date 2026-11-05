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
import ManageShowtimes from '../pages/Admin/ManageShowtimes';
import AddMovie from '../pages/Admin/AddMovie';
import MovieForm from '../pages/Admin/MovieForm';
import FoodCounter from '../pages/Booking/FoodCounter';
import ManageCatalogue from '../pages/Admin/ManageCatalogue';
import Profile from '../pages/Account/Profile';
import BookingHistoryPage from '../pages/Account/BookingHistory';
import MemberSearch from '../pages/Booking/MemberSearch';

/**
 * Main application routes integrating React Router DOM
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/employee/members" element={<ProtectedRoute allowedRoles={['employee']}><MemberSearch /></ProtectedRoute>} />
      <Route path="/bookings" element={<ProtectedRoute allowedRoles={['member']}><BookingHistoryPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute allowedRoles={['member']}><Profile /></ProtectedRoute>} />
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
      <Route path="/admin/movies/new" element={
        <ProtectedRoute allowedRoles={['admin']}><AddMovie /></ProtectedRoute>
      } />
      <Route path="/admin/movies/:id/edit" element={
        <ProtectedRoute allowedRoles={['admin']}><MovieForm editing /></ProtectedRoute>
      } />
      <Route path="/employee/food-sales" element={
        <ProtectedRoute allowedRoles={['employee']}><FoodCounter /></ProtectedRoute>
      } />
      <Route path="/admin/showtimes" element={
        <ProtectedRoute allowedRoles={['admin']}><ManageShowtimes /></ProtectedRoute>
      } />

      <Route path="/admin/foods" element={<ProtectedRoute allowedRoles={['admin']}><ManageCatalogue kind="foods" /></ProtectedRoute>} />
      <Route path="/admin/foods/new" element={<ProtectedRoute allowedRoles={['admin']}><ManageCatalogue kind="foods" creating /></ProtectedRoute>} />
      <Route path="/admin/foods/:id/edit" element={<ProtectedRoute allowedRoles={['admin']}><ManageCatalogue kind="foods" editing /></ProtectedRoute>} />
      <Route path="/admin/promotions" element={<ProtectedRoute allowedRoles={['admin']}><ManageCatalogue kind="promotions" /></ProtectedRoute>} />
      <Route path="/admin/promotions/new" element={<ProtectedRoute allowedRoles={['admin']}><ManageCatalogue kind="promotions" creating /></ProtectedRoute>} />
      <Route path="/admin/promotions/:id/edit" element={<ProtectedRoute allowedRoles={['admin']}><ManageCatalogue kind="promotions" editing /></ProtectedRoute>} />

      {/* 6. Preserved Cinema Application */}
      <Route path="/*" element={<CinemaMain />} />
    </Routes>
  );
}

