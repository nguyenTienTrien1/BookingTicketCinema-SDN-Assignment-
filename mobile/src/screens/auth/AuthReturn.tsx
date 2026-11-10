import React, { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Heading, Muted } from '../../components/ui';
import { useGoogleAuth } from '../../context/GoogleAuthContext';
import { s } from '../../theme';

export default function AuthReturn() {
  const google = useGoogleAuth();
  useEffect(() => {
    if (!google.ready) return;
    void google.check();
    // The provider keeps the exchange alive across route changes.
    router.replace('/');
  }, [google.ready]);
  return <View style={s.content}><Heading>Đang hoàn tất đăng nhập</Heading><Muted>Đang kiểm tra kết quả xác thực Google…</Muted><Button title="Tiếp tục" onPress={() => router.replace('/')}/></View>;
}
