import React, { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { api, ApiError, readDraft, writeDraft } from '../services/api';
import { openExternal } from '../services/browser';
import { useSession } from './SessionContext';
import { User } from '../utils/types';

type Purpose = 'login' | 'link-google';
type Pending = { id: string; secret: string; expiresAt: number; purpose: Purpose };
type GoogleAuth = {
  waiting: boolean; starting: boolean; ready: boolean; error: string; notice: string;
  start: (purpose?: Purpose) => Promise<void>; cancel: () => Promise<void>; check: () => Promise<void>;
};
const Context = createContext<GoogleAuth | null>(null);
const storageKey = 'cinema.google.pending';

export function GoogleAuthProvider({ children }: PropsWithChildren) {
  const { login, loading } = useSession();
  const [pending, setPending] = useState<Pending | null>(null);
  const [ready, setReady] = useState(false), [starting, setStarting] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const current = useRef<Pending | null>(null), checking = useRef(false), creating = useRef(false);
  const popup = useRef<Window | null>(null);

  async function remember(value: Pending | null) {
    current.current = value;
    setPending(value);
    try { await writeDraft(storageKey, value ? JSON.stringify(value) : null); }
    catch {
      if (value) throw new Error('Không thể lưu phiên Google an toàn trên thiết bị. Vui lòng thử lại.');
      // A failed cleanup must not leave the visible UI waiting indefinitely.
      setError('Không thể xóa phiên Google đã lưu. Vui lòng khởi động lại app.');
    }
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const saved = await readDraft(storageKey);
        const value = saved ? JSON.parse(saved) : null;
        if (!active) return;
        if (value && /^[a-f0-9]{48}$/.test(value.id) && /^[a-f0-9]{64}$/.test(value.secret) &&
            Number.isFinite(value.expiresAt) && value.expiresAt > Date.now() && ['login', 'link-google'].includes(value.purpose)) {
          current.current = value;
          setPending(value);
        } else if (saved) await writeDraft(storageKey, null);
      } catch { if (active) setError('Không thể khôi phục phiên Google. Vui lòng thử lại.'); }
      finally { if (active) setReady(true); }
    })();
    return () => { active = false; };
  }, []);

  async function check() {
    const value = current.current;
    if (!value || checking.current || loading) return;
    checking.current = true;
    try {
      if (value.expiresAt <= Date.now()) throw new ApiError('Phiên Google đã hết hạn. Vui lòng thử lại.', 410);
      const result = await api<{ status: string; user: User; token: string }>(`/auth/mobile/google/${value.id}/exchange`, 'POST', { secret: value.secret });
      if (current.current?.id !== value.id) return;
      if (result.status === 'complete') {
        await login(result);
        await remember(null);
        popup.current?.close();
        setError('');
        setNotice(value.purpose === 'link-google' ? 'Đã liên kết Google.' : 'Đăng nhập Google thành công.');
        router.replace(value.purpose === 'link-google' ? '/account' : '/home');
      }
    } catch (failure) {
      if (current.current?.id !== value.id) return;
      if (failure instanceof ApiError && [400, 401, 403, 404, 409, 410].includes(failure.status)) {
        await remember(null);
        popup.current?.close();
        setNotice('');
        setError(failure.message);
      } else {
        // Keep the handoff during a temporary network/server failure.
        setNotice('Đang chờ Google. Nếu mất kết nối, app sẽ thử lại khi bạn quay về.');
      }
    } finally { checking.current = false; }
  }
  useEffect(() => {
    if (!pending || loading) return;
    void Promise.resolve().then(check);
    const timer = setInterval(() => { if (Platform.OS === 'web' || AppState.currentState === 'active') void check(); }, 3000);
    const app = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
    const links = Linking.addEventListener('url', () => { void check(); });
    return () => { clearInterval(timer); app.remove(); links.remove(); };
  }, [pending, loading]);

  async function cancel() {
    const value = current.current;
    if (!value || creating.current) return;
    await remember(null);
    popup.current?.close();
    setError('');
    setNotice('Đã hủy đăng nhập Google.');
    void api(`/auth/mobile/google/${value.id}/cancel`, 'POST', { secret: value.secret }).catch(() => {});
  }
  async function start(purpose: Purpose = 'login') {
    if (!ready || creating.current || current.current) return;
    creating.current = true;
    setStarting(true); setError(''); setNotice('');
    // Reserve the web popup during the tap, before awaiting a network call.
    const browser = Platform.OS === 'web' ? window.open('about:blank', 'cinema-google', 'width=480,height=720') : null;
    popup.current = browser;
    try {
      if (Platform.OS === 'web' && !browser) throw new Error('Trình duyệt đã chặn cửa sổ Google. Hãy cho phép cửa sổ bật lên rồi thử lại.');
      const result = await api<{ id: string; secret: string; expiresAt: number; browserUrl: string }>('/auth/mobile/google', 'POST', { purpose, returnTo: Linking.createURL('/auth-return') });
      await remember({ id: result.id, secret: result.secret, expiresAt: result.expiresAt, purpose });
      setNotice('Chọn tài khoản trong trình duyệt Google, sau đó quay lại CINEMA+.');
      if (browser) browser.location.replace(result.browserUrl);
      else void openExternal(result.browserUrl).then(() => check()).catch(async () => {
        if (current.current?.id !== result.id) return;
        await remember(null);
        setNotice(''); setError('Không thể mở trình duyệt Google. Vui lòng thử lại.');
      });
    } catch (failure) {
      await remember(null);
      browser?.close();
      setError((failure as Error).message);
    } finally { creating.current = false; setStarting(false); }
  }
  return <Context.Provider value={{ waiting: !!pending, starting, ready, error, notice, start, cancel, check }}>{children}</Context.Provider>;
}
export function useGoogleAuth() {
  const context = useContext(Context);
  if (!context) throw new Error('Thiếu GoogleAuthProvider');
  return context;
}
