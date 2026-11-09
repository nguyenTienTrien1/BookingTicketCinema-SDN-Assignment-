import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Heading, Muted } from '../../components/ui';
import { s } from '../../theme/index';
export default function Page(){return <View style={s.content}><Heading>Đã quay về CINEMA+</Heading><Muted>Trở về màn đăng nhập và bấm kiểm tra phiên Google để hoàn tất.</Muted><Button title="Tiếp tục đăng nhập" onPress={()=>router.replace('/')}/></View>;}
