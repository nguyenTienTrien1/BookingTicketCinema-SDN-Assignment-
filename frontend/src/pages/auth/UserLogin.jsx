import React from 'react';
import LoginForm from '../../components/auth/LoginForm';

/**
 * User Login Page (Member & Employee)
 * Route: /login
 */
export default function UserLogin() {
  return <LoginForm portalType="user" />;
}

