import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '../context/SessionContext';
import Navigator from '../navigation/AppNavigator';

export default function Layout(){return <SessionProvider><StatusBar style="light"/><Navigator/></SessionProvider>;}
