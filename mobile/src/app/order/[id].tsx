import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { RemoteScreen } from '../../RemoteScreen';
import { Booking } from '../../types';
import { OrderDetail } from '../../BookingFlow';
import { useSession } from '../../session';
import CounterPayment from '../../screens/CounterPayment';
export default function Page(){const {id,collection}=useLocalSearchParams<{id:string;collection?:string}>(),{user}=useSession();if(!user)return <Redirect href="/"/>;const counter=user.role!=='member';return <RemoteScreen<Booking> path={`${counter?'/payments/bookings/':'/bookings/'}${id}`}>{booking=>counter?<CounterPayment initial={booking} collectionOnly={collection==='true'}/>:<OrderDetail initial={booking} onChanged={()=>{}}/>}</RemoteScreen>;}
