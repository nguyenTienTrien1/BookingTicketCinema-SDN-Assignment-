import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { decodeImageUpload } from '../utils/imageUpload';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api').replace(
  /\/$/,
  '',
);
let token: string | null = null;
let sessionExpired: (() => void) | null = null;
export function onSessionExpired(handler: (() => void) | null) {
  sessionExpired = handler;
}
const key = 'cinema.member.session';
// Điện thoại lưu token trong SecureStore; bản xem trên web chỉ giữ token trong bộ nhớ.
export async function restoreSession() {
  token = Platform.OS === 'web' ? null : await SecureStore.getItemAsync(key);
  return token;
}
export async function saveSession(value: string | null) {
  if (Platform.OS !== 'web') {
    if (value) await SecureStore.setItemAsync(key, value);
    else await SecureStore.deleteItemAsync(key);
  }
  token = value;
}
export async function readDraft(key: string) {
  // Chỉ lưu dữ liệu khôi phục như ID đơn; đây không phải bản sao dữ liệu nghiệp vụ.
  return Platform.OS === 'web' ? sessionStorage.getItem(key) : SecureStore.getItemAsync(key);
}
export async function writeDraft(key: string, value: string | null) {
  if (Platform.OS === 'web') {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } else if (value) await SecureStore.setItemAsync(key, value);
  else await SecureStore.deleteItemAsync(key);
}
export async function uploadImage(kind: 'movies' | 'foods', base64: string) {
  // MIME lấy từ byte ảnh thực tế vì ImagePicker có thể chuyển mã ảnh sau khi chọn.
  const { bytes, contentType } = decodeImageUpload(base64);
  const response = await fetch(API_URL + `/${kind}/images`, {
    method: 'POST',
    credentials: 'omit',
    headers: {
      'Content-Type': contentType,
      Authorization: `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true',
    },
    body: bytes.buffer as ArrayBuffer,
  });
  const result = await response.json();
  if (!response.ok) throw new ApiError(result.message || 'Tải ảnh thất bại.', response.status);
  return result.image as string;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  // Mọi API JSON dùng Bearer token; ngắt chờ sau 20 giây nếu máy chủ không phản hồi.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(API_URL + path, {
      method,
      signal: controller.signal,
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error('API không trả JSON. Kiểm tra địa chỉ backend và ngrok.');
    }
    if (!response.ok) {
      if (response.status === 401 && token && !path.startsWith('/auth/')) {
        // Phiên hết hạn ở API được bảo vệ: xóa token và thông báo cho SessionProvider.
        await saveSession(null);
        sessionExpired?.();
      }
      throw new ApiError(data.message || 'Yêu cầu thất bại.', response.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.message.includes('JSON')) throw error;
    throw new Error('Không kết nối được máy chủ. Kiểm tra mạng và địa chỉ API.');
  } finally {
    clearTimeout(timer);
  }
}
export async function apiCsv(path: string, body: unknown): Promise<{ csv: string; filename: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(API_URL + path, {
      method: 'POST', signal: controller.signal, credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const raw = await response.text();
    if (!response.ok) {
      let message = 'Không thể xuất báo cáo. Vui lòng thử lại.';
      try { message = JSON.parse(raw).message || message; } catch { /* Use the readable fallback for non-JSON proxy errors. */ }
      if (response.status === 401 && token) { await saveSession(null); sessionExpired?.(); }
      throw new ApiError(message, response.status);
    }
    if (!response.headers.get('content-type')?.includes('text/csv')) throw new Error('Máy chủ không trả về file CSV. Hãy tải lại báo cáo rồi thử xuất lại.');
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = (match?.[1] || 'revenue_report.csv').replace(/[\\/:*?"<>|]/g, '_');
    return { csv: raw, filename };
  } catch (error) {
    if (error instanceof ApiError || (error instanceof Error && error.message.startsWith('Máy chủ'))) throw error;
    if (error instanceof Error && error.message.includes('JSON')) throw error;
    throw new Error('Không kết nối được máy chủ để xuất báo cáo. Kiểm tra mạng và địa chỉ API.');
  } finally { clearTimeout(timer); }
}
export function imageUrl(path?: string) {
  // URL ngoài giữ nguyên; ảnh upload tương đối phải ghép với địa chỉ backend.
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith('/api/uploads/')) return API_URL.replace(/\/api$/, '') + path;
  return undefined;
}
