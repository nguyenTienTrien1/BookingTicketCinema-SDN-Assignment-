import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import EmailVerificationScreen from '../screens/auth/EmailVerificationScreen';
export default function Page(){const {token}=useLocalSearchParams<{token?:string|string[]}>();const value=typeof token==='string'?token:'';return <EmailVerificationScreen key={value} token={value}/>;}
