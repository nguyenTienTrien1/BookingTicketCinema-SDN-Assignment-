import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useSession } from '../context/SessionContext';
export default function Layout(){const {user,loading}=useSession();if(loading)return null;if(user?.role!=='admin')return <Redirect href="/"/>;return <Stack screenOptions={{headerShown:false}}/>;}
