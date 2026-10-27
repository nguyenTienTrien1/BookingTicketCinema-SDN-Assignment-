import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const authApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Required for HttpOnly cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Member and Employee login
 * @param {{ email: string, password: string }} credentials 
 */
export async function loginUser(credentials) {
  try {
    const res = await authApi.post('/auth/login', credentials);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Đăng nhập không thành công. Vui lòng thử lại.';
    throw new Error(message);
  }
}

/**
 * Admin login
 * @param {{ email: string, password: string }} credentials 
 */
export async function loginAdmin(credentials) {
  try {
    const res = await authApi.post('/auth/admin/login', credentials);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Đăng nhập không thành công. Vui lòng thử lại.';
    throw new Error(message);
  }
}

/**
 * Logout and clear session cookie
 */
export async function logout() {
  try {
    const res = await authApi.post('/auth/logout');
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Đăng xuất thất bại.';
    throw new Error(message);
  }
}

/**
 * Check and restore session from HttpOnly cookie
 */
export async function getMe() {
  try {
    const res = await authApi.get('/auth/me');
    return res.data?.user || null;
  } catch (error) {
    return null;
  }
}

/**
 * Test protected dashboard endpoints
 */
export async function getMemberDashboard() {
  const res = await authApi.get('/member/dashboard');
  return res.data;
}

export async function getEmployeeDashboard() {
  const res = await authApi.get('/employee/dashboard');
  return res.data;
}

export async function getAdminDashboard() {
  const res = await authApi.get('/admin/dashboard');
  return res.data;
}

// Re-export login for backward compatibility
export const login = loginUser;
export default authApi;

