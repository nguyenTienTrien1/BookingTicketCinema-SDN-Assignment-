import React from 'react';
import { ActivityIndicator } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { RemoteScreen } from '../../components/RemoteScreen';
import { Booking } from '../../utils/types';
import { OrderDetail } from '../../screens/member/BookingFlow';
import { useSession } from '../../context/SessionContext';
import CounterPayment from '../../screens/staff/CounterPayment';
import { Page as Screen } from '../../components/ui';

export default function Page() {
  const { id, collection } = useLocalSearchParams<{ id: string; collection?: string }>();
  const { user, loading } = useSession();
  if (loading) return <Screen><ActivityIndicator /></Screen>;
  if (!user) return <Redirect href="/" />;
  const counter = user.role !== 'member';
  return <RemoteScreen<Booking> path={`${counter ? '/payments/bookings/' : '/bookings/'}${id}`}>{booking => counter
    ? <CounterPayment key={booking._id} initial={booking} collectionOnly={collection === 'true'} />
    : <OrderDetail key={booking._id} initial={booking} onChanged={() => {}} />
  }</RemoteScreen>;
}
