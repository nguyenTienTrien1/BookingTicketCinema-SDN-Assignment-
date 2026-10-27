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
 * Member registration (UC-1)
 * @param {{ fullName: string, email: string, password: string, phone?: string }} data
 */
export async function registerUser(data) {
  try {
    const res = await authApi.post('/auth/register', data);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Đăng ký không thành công. Vui lòng thử lại.';
    throw new Error(message);
  }
}

/**
 * Email verification (UC-1, BR-8)
 * @param {string} token
 */
export async function verifyEmail(token) {
  try {
    const res = await authApi.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Xác thực email thất bại.';
    throw new Error(message);
  }
}

/**
 * Resend verification email (BR-8)
 * @param {string} email
 */
export async function resendVerification(email) {
  try {
    const res = await authApi.post('/auth/resend-verification', { email });
    return res.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Gửi lại mã xác thực thất bại.';
    throw new Error(message);
  }
}

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

