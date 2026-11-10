import React from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { RemoteScreen } from '../../components/RemoteScreen';
import { Showtime } from '../../utils/types';
import { ChooseBooking } from '../../screens/member/BookingFlow';
import { useSession } from '../../context/SessionContext';
export default function Page(){const {id}=useLocalSearchParams<{id:string}>(),{user}=useSession();if(!user)return <Redirect href="/"/>;if(user.role!=='member')return <Redirect href="/staff/booking"/>;return <RemoteScreen<Showtime[]> path="/movies/showtimes">{shows=>{const show=shows.find(item=>item._id===id);return show?<ChooseBooking show={show} onHistory={()=>router.replace('/tickets')} onCreated={booking=>router.replace({pathname:'/order/[id]',params:{id:booking._id}})}/>:null;}}</RemoteScreen>;}
