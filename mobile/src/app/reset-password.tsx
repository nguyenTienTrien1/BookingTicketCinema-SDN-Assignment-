import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
export default function Page(){const {token}=useLocalSearchParams<{token?:string|string[]}>();const value=typeof token==='string'?token:'';return <ResetPasswordScreen key={value} token={value}/>;}
