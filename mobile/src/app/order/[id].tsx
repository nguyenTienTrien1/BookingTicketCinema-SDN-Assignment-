import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { RemoteScreen } from '../../RemoteScreen';
import { Booking } from '../../types';
import { OrderDetail } from '../../BookingFlow';
import { useSession } from '../../session';
export default function Page(){const {id}=useLocalSearchParams<{id:string}>(),{user}=useSession();if(!user)return <Redirect href="/"/>;const counter=user.role!=='member';return <RemoteScreen<Booking> path={`${counter?'/payments/bookings/':'/bookings/'}${id}`}>{booking=><OrderDetail initial={booking} counter={counter} onChanged={()=>{}}/>}</RemoteScreen>;}
