import React from 'react';
import LoginForm from '../../components/auth/LoginForm';
import { useLocation } from 'react-router-dom';

/**
 * User Login Page (Member & Employee)
 * Route: /login
 */
export default function UserLogin() {
  const location = useLocation();
  return <>{location.state?.message && <p className="profileLoginNotice" role="status">{location.state.message}</p>}<LoginForm /></>;
}

