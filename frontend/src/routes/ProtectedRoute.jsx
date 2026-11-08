import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginPathForRoles, roleHome } from '../utils/permissions';

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
    return <Navigate to={loginPathForRoles(allowedRoles)} state={{ from: location, allowedRoles }} replace />;
  }

  // Role not authorized
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  return children;
}

