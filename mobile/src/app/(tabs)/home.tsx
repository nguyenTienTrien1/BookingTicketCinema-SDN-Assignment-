import React from 'react';
import { Redirect, router } from 'expo-router';
import { Home } from '../../screens/MainScreens';
import { useSession } from '../../session';
export default function Page(){const {user}=useSession();if(user&&user.role!=='member')return <Redirect href="/workspace"/>;return <Home onMovie={movie=>router.push({pathname:'/movie/[id]',params:{id:movie._id}})}/>;}
