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

export async function getGoogleChallenge(purpose, signal) {
  const path = purpose === 'login' ? '/auth/google/challenge' : '/auth/google/reauth-challenge';
  const response = await authApi.post(path, { purpose }, { signal });
  if (response.data.clientId !== import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()) {
    throw new Error('Cấu hình đăng nhập Google chưa đồng bộ. Vui lòng tải lại trang hoặc liên hệ quản trị.');
  }
  return response.data.nonce;
}

export async function loginGoogle(credential) {
  try {
    const response = await authApi.post('/auth/google', { credential });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Không thể đăng nhập Google. Vui lòng thử lại.');
  }
}

export async function setLocalPassword(data) {
  const response = await authApi.post('/auth/set-password', data);
  return response.data;
}

export async function linkGoogleAccount(data) {
  const response = await authApi.post('/auth/link-google', data);
  return response.data;
}

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

// Keep the form interface boolean, but confirm every result with the real API.
export async function requestPasswordReset(email) {
  let response;
  try {
    response = await authApi.post('/auth/forgot-password', { email });
  } catch (error) {
    throw passwordRecoveryError(error, 'Không thể gửi yêu cầu lúc này.');
  }
  if (response.data?.success !== true) throw new Error('Máy chủ chưa xác nhận yêu cầu khôi phục mật khẩu.');
  return true;
}

export async function validatePasswordResetToken(token) {
  let response;
  try {
    response = await authApi.get('/auth/reset-password/verify', { params: { token } });
  } catch (error) {
    throw passwordRecoveryError(error, 'Không thể kiểm tra liên kết lúc này.');
  }
  if (response.data?.success !== true || response.data.valid !== true) {
    throw new Error('Máy chủ chưa xác nhận liên kết đặt lại mật khẩu.');
  }
  return true;
}

export async function resetPassword(token, newPassword, confirmPassword) {
  let response;
  try {
    response = await authApi.post('/auth/reset-password', { token, newPassword, confirmPassword });
  } catch (error) {
    throw passwordRecoveryError(error, 'Không thể đặt lại mật khẩu lúc này.');
  }
  if (response.data?.success !== true) throw new Error('Máy chủ chưa xác nhận cập nhật mật khẩu.');
  return true;
}

function passwordRecoveryError(error, fallback) {
  const recoveryError = new Error(getErrorMessage(error, fallback));
  if (error.response?.data?.code === 'RESET_LINK_INVALID') recoveryError.code = 'RESET_LINK_INVALID';
  return recoveryError;
}


function getErrorMessage(error, fallback) {
  if (!error.response) return 'Không kết nối được máy chủ. Vui lòng kiểm tra kết nối và thử lại.';
  if (error.response.status >= 500) return 'Máy chủ đang gặp lỗi. Vui lòng thử lại sau.';
  return error.response.data?.message || fallback;
}
