import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '../session';
import { AuthScreen } from '../screens/AuthScreen';
import { colors, s } from '../ui';
export default function Index() {
  const {user, loading} = useSession();
  if (loading) return <View style={[s.page,{justifyContent:'center'}]}><ActivityIndicator color={colors.red}/></View>;
  if (user) return <Redirect href="/home" />;
  return <AuthScreen />;
}
