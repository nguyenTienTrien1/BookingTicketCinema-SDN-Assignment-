import React from 'react';
import { ActivityIndicator } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { RemoteScreen } from '../../components/RemoteScreen';
import { Showtime } from '../../utils/types';
import { ChooseBooking } from '../../screens/member/BookingFlow';
import { useSession } from '../../context/SessionContext';
import { Button, Heading, Muted, Page as Screen } from '../../components/ui';
export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading } = useSession();
  if (loading) return <Screen><ActivityIndicator /></Screen>;
  if (!user) return <Redirect href="/" />;
  if (user.role !== 'member') return <Redirect href="/staff/booking" />;
  return <RemoteScreen<Showtime[]> path="/movies/showtimes">{shows => {
    const show = shows.find(item => item._id === id && !item.cancelledAt && new Date(item.startTime).getTime() > Date.now());
    return show ? <ChooseBooking key={show._id} show={show} onHistory={() => router.replace('/tickets')} onCreated={booking => router.replace({ pathname: '/order/[id]', params: { id: booking._id } })} />
      : <Screen><Heading>Suất chiếu không còn mở bán</Heading><Muted>Suất chiếu đã bắt đầu, đã hủy hoặc không tồn tại. Vui lòng chọn suất khác.</Muted><Button title="Chọn phim khác" onPress={() => router.replace('/home')} /></Screen>;
  }}</RemoteScreen>;
}
