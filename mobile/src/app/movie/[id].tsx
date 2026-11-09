import React from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { RemoteScreen } from '../../RemoteScreen';
import { Movie } from '../../types';
import { MovieDetail } from '../../BookingFlow';
import { useSession } from '../../session';
export default function Page(){const {id}=useLocalSearchParams<{id:string}>(),{user}=useSession();if(!user)return <Redirect href="/"/>;if(user.role!=='member')return <Redirect href="/staff/booking"/>;return <RemoteScreen<Movie[]> path="/movies">{movies=>{const movie=movies.find(item=>item._id===id);return movie?<MovieDetail movie={movie} onBook={show=>router.push({pathname:'/choose/[id]',params:{id:show._id}})}/>:null;}}</RemoteScreen>;}
