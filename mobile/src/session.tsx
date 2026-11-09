import React, { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { api, ApiError, onSessionExpired, restoreSession, saveSession } from './api';
import { User } from './types';
import { router } from 'expo-router';
type Session = { user: User | null; loading: boolean; error: string; login: (result: {user: User; token: string}) => Promise<void>; logout: () => Promise<void>; refresh: () => Promise<void> };
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  async function logout() { await saveSession(null); setUser(null); if(router.canDismiss())router.dismissAll(); }
  async function refresh() { setUser((await api<{user: User}>('/auth/me')).user); }
  useEffect(()=>{onSessionExpired(()=>{setUser(null);setError('Phiên đã hết hạn. Vui lòng đăng nhập lại.');});return()=>onSessionExpired(null);},[]);
  useEffect(() => { (async () => {
    try { if (await restoreSession()) await refresh(); }
    catch (e) { if (e instanceof ApiError && e.status === 401) await logout(); else setError((e as Error).message); }
    finally { setLoading(false); }
  })(); }, []);
  async function login(result: {user: User; token: string}) { await saveSession(result.token); setUser(result.user); setError(''); }
  return <Context.Provider value={{user, loading, error, login, logout, refresh}}>{children}</Context.Provider>;
}
export function useSession() { const context = useContext(Context); if (!context) throw new Error('Thiếu SessionProvider'); return context; }
