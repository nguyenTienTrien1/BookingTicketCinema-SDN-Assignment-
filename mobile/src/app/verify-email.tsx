import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { AuthScreen } from '../screens/AuthScreen';
export default function Page(){const {token}=useLocalSearchParams<{token:string}>();return <AuthScreen initialMode="verify" initialToken={token||''}/>;}
