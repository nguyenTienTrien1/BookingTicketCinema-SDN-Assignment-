import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '../context/SessionContext';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { colors, s } from '../theme/index';
export default function Index() {
  const {user, loading} = useSession();
  if (loading) return <View style={[s.page,{justifyContent:'center'}]}><ActivityIndicator color={colors.red}/></View>;
  if (user) return <Redirect href={user.role === 'member' ? '/home' : '/workspace'} />;
  return <AuthScreen />;
}
