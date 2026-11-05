import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const authApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
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
    const message = getErrorMessage(error, 'Đăng ký không thành công. Vui lòng thử lại.');
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
    const message = getErrorMessage(error, 'Xác thực email thất bại.');
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
    const message = getErrorMessage(error, 'Gửi lại mã xác thực thất bại.');
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
    const message = getErrorMessage(error, 'Đăng nhập không thành công. Vui lòng thử lại.');
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
    const message = getErrorMessage(error, 'Đăng nhập không thành công. Vui lòng thử lại.');
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
    const message = getErrorMessage(error, 'Đăng xuất thất bại.');
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
    if (error.response?.status === 401) return null;
    throw new Error(getErrorMessage(error, 'Không thể khôi phục phiên đăng nhập.'));
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

// UC-19 has no backend routes yet. These guards deliberately make no HTTP
// request and never acknowledge an email or password update as successful.
// Replace their bodies only after the real API contract is available.
// Local UI interface: resolve true only after backend confirmation; normalize
// rejected links to RESET_LINK_INVALID, and other failures to safe messages.
// Request acknowledgement must be identical for ineligible/unknown emails and
// email delivery failure (UC-19 E1); never expose those distinctions to the UI.
export async function requestPasswordReset(email) {
  throw passwordRecoveryUnavailable();
}

export async function validatePasswordResetToken(token) {
  throw passwordRecoveryUnavailable();
}

export async function resetPassword(token, newPassword, confirmPassword) {
  throw passwordRecoveryUnavailable();
}

function passwordRecoveryUnavailable() {
  const error = new Error('Khôi phục mật khẩu hiện chưa khả dụng. Vui lòng thử lại sau.');
  error.code = 'PASSWORD_RECOVERY_UNAVAILABLE';
  return error;
}


function getErrorMessage(error, fallback) {
  if (!error.response) return 'Không kết nối được máy chủ. Vui lòng kiểm tra kết nối và thử lại.';
  if (error.response.status >= 500) return 'Máy chủ đang gặp lỗi. Vui lòng thử lại sau.';
  return error.response.data?.message || fallback;
}
