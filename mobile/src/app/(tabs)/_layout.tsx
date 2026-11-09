import React from 'react';
import { ActivityIndicator } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useSession } from '../../session';
import { colors } from '../../ui';
import { Icon } from '../../Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export default function Layout() {
  const {user,loading}=useSession();
  const insets=useSafeAreaInsets();
  if(loading)return <ActivityIndicator />;
  if(!user)return <Redirect href="/"/>;
  return <Tabs screenOptions={{headerShown:false,tabBarStyle:{height:64+insets.bottom,backgroundColor:'#11131b',borderTopColor:colors.border,paddingTop:4,paddingBottom:Math.max(4,insets.bottom)},tabBarItemStyle:{paddingVertical:4},tabBarIconStyle:{width:22,height:22},tabBarLabelStyle:{fontSize:11,lineHeight:14,flexShrink:0,fontWeight:'600',marginTop:3,marginBottom:0},tabBarActiveTintColor:colors.pink,tabBarInactiveTintColor:'#7f879b'}}>
    <Tabs.Screen name="home" options={{title:'Khám phá',tabBarIcon:({color})=><Icon name="home" color={typeof color==='string'?color:colors.muted}/>}}/><Tabs.Screen name="tickets" options={{title:'Vé của tôi',href:user.role==='member'?undefined:null,tabBarIcon:({color})=><Icon name="ticket" color={typeof color==='string'?color:colors.muted}/>}}/><Tabs.Screen name="workspace" options={{title:'Tác vụ',href:user.role!=='member'?undefined:null,tabBarIcon:({color})=><Icon name="grid" color={typeof color==='string'?color:colors.muted}/>}}/><Tabs.Screen name="account" options={{title:'Tài khoản',tabBarIcon:({color})=><Icon name="user" color={typeof color==='string'?color:colors.muted}/>}}/>
  </Tabs>;
}
