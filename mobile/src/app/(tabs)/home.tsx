import React from 'react';
import { router } from 'expo-router';
import { Home } from '../../screens/MainScreens';
export default function Page(){return <Home onMovie={movie=>router.push({pathname:'/movie/[id]',params:{id:movie._id}})}/>;}
