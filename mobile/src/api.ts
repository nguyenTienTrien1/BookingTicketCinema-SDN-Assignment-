import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api').replace(/\/$/, '');
let token: string | null = null;
let sessionExpired: (()=>void)|null = null;
export function onSessionExpired(handler:(()=>void)|null){sessionExpired=handler;}
const key = 'cinema.member.session';
// Browser preview keeps a session only in memory; native devices use encrypted storage.
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
export async function readDraft(key: string) { return Platform.OS === 'web' ? sessionStorage.getItem(key) : SecureStore.getItemAsync(key); }
export async function writeDraft(key: string, value: string | null) {
  if (Platform.OS === 'web') { if(value)sessionStorage.setItem(key,value);else sessionStorage.removeItem(key); }
  else if(value)await SecureStore.setItemAsync(key,value);else await SecureStore.deleteItemAsync(key);
}
export async function uploadImage(kind: 'movies'|'foods', base64: string, mime: string) {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('Ảnh phải nhỏ hơn hoặc bằng 5 MB.');
  const response = await fetch(API_URL + `/${kind}/images`, {method:'POST',credentials:'omit',headers:{'Content-Type':mime,Authorization:`Bearer ${token}`,'ngrok-skip-browser-warning':'true'},body:bytes.buffer});
  const result=await response.json();if(!response.ok)throw new ApiError(result.message||'Tải ảnh thất bại.',response.status);return result.image as string;
}
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(API_URL + path, {
      method, signal: controller.signal, credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { throw new Error('API không trả JSON. Kiểm tra địa chỉ backend và ngrok.'); }
    if (!response.ok) {
      if(response.status===401&&token&&!path.startsWith('/auth/')){await saveSession(null);sessionExpired?.();}
      throw new ApiError(data.message || 'Yêu cầu thất bại.', response.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.message.includes('JSON')) throw error;
    throw new Error('Không kết nối được máy chủ. Kiểm tra mạng và địa chỉ API.');
  } finally { clearTimeout(timer); }
}
export function imageUrl(path?: string) {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith('/api/uploads/')) return API_URL.replace(/\/api$/, '') + path;
  return undefined;
}
export const money = (value = 0) => value.toLocaleString('vi-VN') + ' ₫';
export const when = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
export const statusText = (value: string) => ({ pending: 'Chờ thanh toán', paid: 'Đã thanh toán', cancelled: 'Đã hủy', expired: 'Hết hạn', refunded: 'Đã hoàn tiền', 'refund-requested':'Đang xử lý hoàn điểm' }[value] || value);
