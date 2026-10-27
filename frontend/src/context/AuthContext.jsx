import { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, loginAdmin, logout as apiLogout, getMe } from '../services/auth/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Restore authenticated session on page refresh via HttpOnly cookie
  useEffect(() => {
    let mounted = true;
    getMe()
      .then((currentUser) => {
        if (mounted) {
          setUser(currentUser);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function login(email, password, portalType = 'user') {
    setError('');
    try {
      const response = portalType === 'admin'
        ? await loginAdmin({ email, password })
        : await loginUser({ email, password });

      setUser(response.user);
      return response.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  async function logout() {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setError('');
    }
  }

  const value = {
    user,
    setUser,
    loading,
    error,
    setError,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isEmployee: user?.role === 'employee',
    isMember: user?.role === 'member'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

