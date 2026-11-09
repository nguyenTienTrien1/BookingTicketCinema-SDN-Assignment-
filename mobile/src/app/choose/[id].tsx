import React from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { RemoteScreen } from '../../RemoteScreen';
import { Showtime } from '../../types';
import { ChooseBooking } from '../../BookingFlow';
import { useSession } from '../../session';
export default function Page(){const {id}=useLocalSearchParams<{id:string}>(),{user}=useSession();if(!user)return <Redirect href="/"/>;return <RemoteScreen<Showtime[]> path="/movies/showtimes">{shows=>{const show=shows.find(item=>item._id===id);return show?<ChooseBooking show={show} counter={user.role!=='member'} onHistory={()=>router.replace(user.role==='member'?'/tickets':'/workspace')} onCreated={booking=>router.replace({pathname:'/order/[id]',params:{id:booking._id}})}/>:null;}}</RemoteScreen>;}
