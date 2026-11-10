import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { RemoteScreen } from '../../components/RemoteScreen';
import { Booking } from '../../utils/types';
import { OrderDetail } from '../../screens/member/BookingFlow';
import { useSession } from '../../context/SessionContext';
import CounterPayment from '../../screens/staff/CounterPayment';
export default function Page(){const {id,collection}=useLocalSearchParams<{id:string;collection?:string}>(),{user}=useSession();if(!user)return <Redirect href="/"/>;const counter=user.role!=='member';return <RemoteScreen<Booking> path={`${counter?'/payments/bookings/':'/bookings/'}${id}`}>{booking=>counter?<CounterPayment initial={booking} collectionOnly={collection==='true'}/>:<OrderDetail initial={booking} onChanged={()=>{}}/>}</RemoteScreen>;}
