import React, { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Tickets } from '../../screens/MainScreens';
export default function Page(){const [version,setVersion]=useState(0);useFocusEffect(useCallback(()=>{setVersion(v=>v+1);},[]));return <Tickets version={version} onOrder={booking=>router.push({pathname:'/order/[id]',params:{id:booking._id}})}/>;}
