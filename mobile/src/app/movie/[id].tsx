import React from 'react';
import { ActivityIndicator } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { RemoteScreen } from '../../components/RemoteScreen';
import { Movie } from '../../utils/types';
import { MovieDetail } from '../../screens/member/BookingFlow';
import { useSession } from '../../context/SessionContext';
import { Button, Heading, Muted, Page as Screen } from '../../components/ui';

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading } = useSession();
  if (loading) return <Screen><ActivityIndicator /></Screen>;
  if (!user) return <Redirect href="/" />;
  if (user.role !== 'member') return <Redirect href="/staff/booking" />;
  return <RemoteScreen<Movie[]> path="/movies">{movies => {
    const movie = movies.find(item => item._id === id);
    return movie ? <MovieDetail key={movie._id} movie={movie} onBook={show => router.push({ pathname: '/choose/[id]', params: { id: show._id } })} />
      : <Screen><Heading>Phim không còn khả dụng</Heading><Muted>Vui lòng chọn phim khác để xem lịch chiếu.</Muted><Button title="Chọn phim khác" onPress={() => router.replace('/home')} /></Screen>;
  }}</RemoteScreen>;
}
