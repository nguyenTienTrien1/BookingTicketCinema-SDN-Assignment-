import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '../context/SessionContext';
import Navigator from '../navigation/AppNavigator';
import { GoogleAuthProvider } from '../context/GoogleAuthContext';

export default function Layout(){return <SessionProvider><GoogleAuthProvider><StatusBar style="light"/><Navigator/></GoogleAuthProvider></SessionProvider>;}
