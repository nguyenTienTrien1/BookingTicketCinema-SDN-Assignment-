import React from 'react';
import { router, Stack, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '../session';
import { colors } from '../ui';
import { Icon } from '../Icon';
function Navigator(){const path=usePathname(),tab=['/home','/tickets','/workspace','/account','/'].includes(path);return <Stack screenOptions={{headerStyle:{backgroundColor:colors.bg},headerTintColor:'#fff',headerShadowVisible:false,contentStyle:{backgroundColor:colors.bg},headerTitle:()=> <Text style={{color:'white',fontSize:19,fontWeight:'900',letterSpacing:.3}}>CINEMA<Text style={{color:colors.red}}>+</Text></Text>,headerBackTitle:'Quay lại',headerRight:()=>tab?<View style={{flexDirection:'row',gap:6,alignItems:'center'}}><View style={{width:5,height:5,borderRadius:3,backgroundColor:colors.red}}/><Text style={{color:colors.muted,fontSize:9,letterSpacing:1.7}}>YOUR MOVIE NIGHT</Text></View>:<Pressable accessibilityRole="button" accessibilityLabel="Trang chủ" onPress={()=>router.replace('/home')} style={{padding:12}}><Icon name="home" color={colors.pink} size={20}/></Pressable>}}/>;}
export default function Layout(){return <SessionProvider><StatusBar style="light"/><Navigator/></SessionProvider>;}
