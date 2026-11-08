import React from 'react';
import LoginForm from '../../components/auth/LoginForm';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Member Login Page
 * Route: /login
 */
export default function UserLogin() {
  const location = useLocation();
  const { notice } = useAuth();
  const message = location.state?.message || notice;
  return <>{message && <p className="profileLoginNotice" role="status">{message}</p>}<LoginForm /></>;
}

