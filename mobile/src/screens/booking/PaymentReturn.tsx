import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../services/api';
import { Button, Heading, Muted } from '../../components/ui';
import { s } from '../../theme/index';
import { useSession } from '../../context/SessionContext';
export default function Page() {
  const { reference } = useLocalSearchParams<{ reference: string }>();
  const { user, loading } = useSession();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    if (!user) return;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setError('');
      if (typeof reference !== 'string' || !reference.trim()) {
        setError('Liên kết thiếu mã giao dịch. Mở lịch sử vé để kiểm tra đơn; không thanh toán lại khi chưa rõ kết quả.');
        return;
      }
      try {
        const result = await api(`${user.role === 'member' ? '/bookings/payment-result/' : '/payments/results/'}${encodeURIComponent(reference)}`);
        if (active) router.replace({ pathname: '/order/[id]', params: { id: result.booking._id } });
      } catch (e) { if (active) setError((e as Error).message); }
    });
    return () => { active = false; };
  }, [user, reference, retry]);
  return <View style={s.content}>
    <Heading>{error ? 'Chưa xác nhận kết quả thanh toán' : 'Đang kiểm tra thanh toán'}</Heading>
    <Muted>Chỉ kết quả xác minh từ máy chủ quyết định trạng thái đơn.</Muted>
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {!!error && !!reference && <Button title="Kiểm tra lại" onPress={() => setRetry(value => value + 1)} />}
    {!loading && !user && <Button title="Đăng nhập để xem kết quả" onPress={() => router.replace('/')} />}
    <Button secondary title="Mở lịch sử vé" onPress={() => router.replace(!user ? '/' : user.role === 'member' ? '/tickets' : '/workspace')} />
  </View>;
}
