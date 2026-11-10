import React, { useEffect, useRef } from 'react';
import { Text } from 'react-native';
import { useGoogleAuth } from '../context/GoogleAuthContext';
import { Button, Card, Heading, Muted } from './ui';
import { s } from '../theme';

export default function GoogleLink({ onLinked }: { onLinked: () => Promise<void> }) {
  const google = useGoogleAuth();
  const wasWaiting = useRef(false);
  useEffect(() => {
    if (wasWaiting.current && !google.waiting && google.notice === 'Đã liên kết Google.') void onLinked();
    wasWaiting.current = google.waiting;
  }, [google.waiting, google.notice]);
  return <Card>
    <Heading>Liên kết Google</Heading>
    <Muted>Chọn Google cùng email. Sau đó nhập mật khẩu CINEMA+ hiện tại trên trang xác nhận để liên kết.</Muted>
    <Button secondary busy={google.starting} disabled={google.waiting || !google.ready} title="Liên kết tài khoản Google" onPress={() => void google.start('link-google')}/>
    {google.waiting && <><Button secondary title="Kiểm tra kết quả liên kết" onPress={() => void google.check()}/><Button secondary title="Hủy liên kết Google" onPress={() => void google.cancel()}/></>}
    {!!google.error && <Text accessibilityRole="alert" style={s.error}>{google.error}</Text>}
    {!!google.notice && <Muted>{google.notice}</Muted>}
  </Card>;
}
