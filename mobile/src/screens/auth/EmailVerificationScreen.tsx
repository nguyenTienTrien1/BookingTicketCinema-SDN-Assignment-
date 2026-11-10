import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../services/api';
import { Button, Card, Heading, Muted, Page } from '../../components/ui';
import { colors, s } from '../../theme';

// Existing app/deep links also verify automatically; the token stays inside the URL.
export default function EmailVerificationScreen({ token }: { token: string }) {
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>(token ? 'pending' : 'error');
  const [message, setMessage] = useState(token ? '' : 'Thiếu liên kết xác minh. Vui lòng mở liên kết trong email đăng ký.');
  const request = useRef<{ token: string; promise: Promise<{ message: string }> } | null>(null);
  useEffect(() => {
    if (!token) return;
    let active = true;
    // Reuse the request during React Strict Mode's effect replay: tokens are single-use.
    if (request.current?.token !== token) request.current = { token, promise: api('/auth/verify-email', 'POST', { token }) };
    void request.current.promise.then(result => {
      if (active) { setStatus('success'); setMessage(result.message || 'Tài khoản đã được kích hoạt. Bạn có thể đăng nhập.'); }
    }).catch(error => {
      if (active) { setStatus('error'); setMessage(error.message); }
    });
    return () => { active = false; };
  }, [token]);
  return <Page><Card>
    <Heading>{status === 'pending' ? 'Đang xác minh email' : status === 'success' ? 'Xác minh email thành công' : 'Chưa xác minh được email'}</Heading>
    {status === 'pending' ? <ActivityIndicator color={colors.pink}/> : status === 'error' ? <Text accessibilityRole="alert" style={s.error}>{message}</Text> : <Muted>{message}</Muted>}
    <Button title="Về đăng nhập" onPress={() => router.replace('/')}/>
  </Card></Page>;
}
