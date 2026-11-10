import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { router } from 'expo-router';
import { api, ApiError } from '../../services/api';
import { useSession } from '../../context/SessionContext';
import { Button, Card, Field, Heading, Muted, Page } from '../../components/ui';
import { colors, s } from '../../theme';

export default function ResetPasswordScreen({ token }: { token: string }) {
  const { logout } = useSession();
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid' | 'unavailable' | 'success'>(/^[a-f0-9]{64}$/.test(token) ? 'checking' : 'invalid');
  const [password, setPassword] = useState(''), [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false), verification = useRef<Promise<unknown> | null>(null);

  function verify() {
    if (!verification.current) verification.current = api(`/auth/reset-password/verify?token=${encodeURIComponent(token)}`);
    return verification.current;
  }
  useEffect(() => {
    if (!/^[a-f0-9]{64}$/.test(token)) return;
    let active = true;
    void verify().then(() => { if (active) setStatus('ready'); }).catch(failure => {
      if (active) { setStatus(failure instanceof ApiError && failure.status === 400 ? 'invalid' : 'unavailable'); setError(failure.message); }
    });
    return () => { active = false; };
  }, [token]);

  async function submit() {
    if (submitting.current || status !== 'ready') return;
    submitting.current = true; setBusy(true); setError('');
    try {
      if (password.trim().length < 6) throw new Error('Mật khẩu mới cần ít nhất 6 ký tự.');
      if (password !== confirmPassword) throw new Error('Xác nhận mật khẩu mới không khớp.');
      await api('/auth/reset-password', 'POST', { token, newPassword: password, confirmPassword });
      setPassword(''); setConfirmPassword(''); setStatus('success');
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 400 && /liên kết/i.test(failure.message)) setStatus('invalid');
      setError((failure as Error).message);
    } finally { submitting.current = false; setBusy(false); }
  }
  async function login() {
    if (busy) return;
    setBusy(true);
    try { if (status === 'success') await logout(); router.replace('/'); }
    catch { setError('Chưa thể quay về đăng nhập. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  }
  return <Page><Card>
    <Heading>{status === 'success' ? 'Đặt lại mật khẩu thành công' : 'Đặt lại mật khẩu'}</Heading>
    {status === 'checking' && <><ActivityIndicator color={colors.pink}/><Muted>Đang kiểm tra liên kết trong email…</Muted></>}
    {status === 'ready' && <>
      <Muted>Nhập mật khẩu mới cho tài khoản CINEMA+ của bạn.</Muted>
      <Field label="Mật khẩu mới" secureTextEntry autoComplete="new-password" editable={!busy} value={password} onChangeText={setPassword}/>
      <Field label="Xác nhận mật khẩu mới" secureTextEntry autoComplete="new-password" editable={!busy} value={confirmPassword} onChangeText={setConfirmPassword}/>
    </>}
    {status === 'invalid' && <Text accessibilityRole="alert" style={s.error}>{error || 'Liên kết đã hết hạn, đã được sử dụng hoặc không hợp lệ. Hãy quay lại Quên mật khẩu và yêu cầu email mới.'}</Text>}
    {status === 'unavailable' && <Muted>Chưa kết nối được máy chủ. Hãy kiểm tra mạng rồi mở lại liên kết trong email.</Muted>}
    {status === 'success' && <Muted>Mật khẩu đã được cập nhật. Hãy đăng nhập bằng mật khẩu mới.</Muted>}
    {!!error && status !== 'invalid' && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {status === 'ready' && <Button busy={busy} title="Đặt lại mật khẩu" onPress={() => void submit()}/>}
    <Button secondary busy={busy} title="Về đăng nhập" onPress={() => void login()}/>
  </Card></Page>;
}
