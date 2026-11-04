import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { loginUser, logout as apiLogout, getMe } from '../services/auth/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sessionRevision = useRef(0);

  // Restore authenticated session on page refresh via HttpOnly cookie
  useEffect(() => {
    let mounted = true;
    const revision = sessionRevision.current;
    getMe()
      .then((currentUser) => {
        if (mounted && revision === sessionRevision.current) {
          setUser(currentUser);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted && revision === sessionRevision.current) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function login(email, password) {
    const revision = ++sessionRevision.current;
    setError('');
    try {
      const response = await loginUser({ email, password });

      if (!response.user?._id) throw new Error('Phản hồi đăng nhập không hợp lệ.');
      if (revision === sessionRevision.current) {
        setUser(response.user);
        setLoading(false);
      }
      return response.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      if (revision === sessionRevision.current) setLoading(false);
    }
  }

  async function logout() {
    ++sessionRevision.current;
    await apiLogout();
    setUser(null);
    setLoading(false);
    setError('');
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

