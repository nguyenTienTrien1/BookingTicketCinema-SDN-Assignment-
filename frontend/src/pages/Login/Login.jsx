import React from 'react';
import LoginForm from '../../components/auth/LoginForm';

export default function Login({ onLoginSuccess, onCancelLogin }) {
  return <LoginForm onLoginSuccess={onLoginSuccess} onCancelLogin={onCancelLogin} />;
}
