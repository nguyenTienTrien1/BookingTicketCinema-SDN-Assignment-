import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Route Guard enforcing authenticated session and role authorization (BR-11)
 */
export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#08090c',
        color: '#8b92a2',
        fontFamily: 'Inter, sans-serif'
      }}>
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    const isTargetAdmin = allowedRoles.includes('admin') || allowedRoles.includes('employee');
    const redirectPath = isTargetAdmin ? '/admin/login' : '/login';
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  // Role not authorized
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'employee') return <Navigate to="/employee/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

