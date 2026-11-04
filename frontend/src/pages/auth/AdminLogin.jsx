import React from 'react';
import LoginForm from '../../components/auth/LoginForm';

/**
 * Admin Login Page
 * Route: /admin/login
 */
export default function AdminLogin() {
  return <LoginForm portalType="admin" />;
}

